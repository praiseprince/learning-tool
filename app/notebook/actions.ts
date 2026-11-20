"use server";
import {requireSignedIn} from "@/lib/signed-in";
import {randomUUID} from "node:crypto";
import {after} from "next/server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {sqlite} from "@/lib/db/client";
import {requireV2} from "@/lib/v2/access";
import {ensureNotebook,storeDocument,revisionById} from "@/lib/v2/notebook";
import {extractRevision,observationSuggestion} from "@/lib/v2/extract";
import {event} from "@/lib/v2/atlas";
import {refine, REFINE_MAX} from "@/lib/v2/refine";
export async function newNote(data:FormData){
 await requireSignedIn(); requireV2();const id=randomUUID();
 const goal=String(data.get("goal")||""),journey=goal&&sqlite.prepare("SELECT 1 FROM journey WHERE id=?").get(goal)?goal:null;
 const result=storeDocument({id,base:null,title:String(data.get("title")||"Untitled note"),body:String(data.get("body")||""),kind:String(data.get("kind")||"note"),source:String(data.get("source")||""),journey});
 if(String(data.get("body")||"").trim())after(()=>extractRevision(result.revision));
 redirect("/notebook/d/"+id);
}
export async function saveRevision(id:string,base:string,title:string,body:string){
 await requireSignedIn(); requireV2();ensureNotebook();
 const result=storeDocument({id,base,title,body,kind:"note",journey:null});
 if(result.changed)after(()=>extractRevision(result.revision));
 return result.revision;
}
export async function retryRevision(id:string){
 await requireSignedIn(); requireV2();ensureNotebook();
 await extractRevision(id);revalidatePath("/notebook","layout");
}
export async function addSource(data:FormData){
 await requireSignedIn(); requireV2();ensureNotebook();
 const field=(key:string)=>String(data.get(key)||"").trim();
 const id=randomUUID(),title=field("title"),url=field("url"),kind=field("kind");
 if(!title||title.length>240||!["book","article","video","file","website"].includes(kind)||url&& !/^https?:$/.test(new URL(url).protocol))throw Error("Enter a title and a valid source.");
 const notes=field("notes").slice(0,10000),creator=field("creator").slice(0,200);
 sqlite.transaction(()=>{
 sqlite.prepare("INSERT INTO resource VALUES(?,?,?,?,?,?,'user_added',?)").run(id,kind,title,creator,url,notes,new Date().toISOString());
 sqlite.prepare("INSERT INTO notebook_search VALUES('resource',?,?,?)").run(id,title,creator+" "+notes);
 })();redirect("/notebook/s/"+id);
}
export async function resolveObservation(id:string,data:FormData){
 await requireSignedIn(); requireV2();ensureNotebook();
 sqlite.transaction(()=>{
  const p=sqlite.prepare("SELECT diff_json,source_ref,status FROM proposal WHERE id=? AND kind='facet_update'").get(id) as {diff_json:string;source_ref:string;status:string}|undefined;
  if(!p||!["pending","deferred","unsupported"].includes(p.status))return;
  const intent=data.get("intent"),now=new Date().toISOString();
  if(intent==="accept"){
   const change=observationSuggestion.parse(JSON.parse(p.diff_json)),source=revisionById(p.source_ref);
   if(p.status==="unsupported"||!source||!source.content_md.includes(change.quote))throw Error("This quotation cannot support the change.");
   const scope=String(data.get("scope")??change.scope).trim().slice(0,500);
   if(!scope)throw Error("Describe what the quote supports.");
   const raw=JSON.parse(p.diff_json);
   let nodeId=change.nodeId;
   if(raw.newConcept){
    const existing=sqlite.prepare("SELECT id FROM atlas_node WHERE label=? COLLATE NOCASE ORDER BY id LIMIT 1").get(raw.label) as {id:string}|undefined;
    nodeId=existing?.id||nodeId;
    if(!existing){
     const node={id:nodeId,label:raw.label,kind:"concept",description:scope,origin:"review",legacy_id:null};
     sqlite.prepare("INSERT INTO atlas_node VALUES(@id,@label,@kind,@description,@origin,@legacy_id)").run(node);
     event("create","node",nodeId,null,node,id);
    }
    const journey=sqlite.prepare("SELECT journey_id FROM document WHERE id=?").get(source.document_id) as {journey_id:string|null};
    if(journey.journey_id)sqlite.prepare("INSERT OR IGNORE INTO atlas_membership VALUES(?,?)").run(nodeId,journey.journey_id);
    sqlite.prepare("INSERT OR IGNORE INTO entity_link VALUES(?,'revision',?,'node',?,?,?)").run(randomUUID(),source.id,nodeId,raw.label,JSON.stringify({quote:change.quote}));
   }
   const o={id:randomUUID(),node_id:nodeId,kind:change.kind,source_kind:"document_revision",source_id:source.id,quote:change.quote,observed_at:source.created_at,recorded_at:now,journey:null};
   sqlite.prepare("INSERT INTO knowledge_observation VALUES (@id,@node_id,@kind,@source_kind,@source_id,@quote,@observed_at,@recorded_at,@journey)").run(o);
   event("accept","observation",o.id,null,{...o,scope},id);
  }else if(intent!=="dismiss"&&intent!=="defer")throw Error("Unknown decision.");
  sqlite.prepare("UPDATE proposal SET status=?,resolved_at=? WHERE id=?").run(intent==="accept"?"accepted":intent==="dismiss"?"rejected":"deferred",now,id);
 })();revalidatePath("/notebook/inbox");
}

export async function undoAccepted(id:string){
 await requireSignedIn(); requireV2();ensureNotebook();
 sqlite.transaction(()=>{
  const p=sqlite.prepare("SELECT kind,status FROM proposal WHERE id=?").get(id) as {kind:string;status:string}|undefined;
  if(!p||p.status!=="accepted"||!["bridge","facet_update"].includes(p.kind))return;
  const row=sqlite.prepare("SELECT entity_id,after_json FROM graph_event WHERE proposal_id=? ORDER BY rowid DESC LIMIT 1").get(id) as {entity_id:string;after_json:string}|undefined;
  if(!row)return;
  const observation=p.kind==="facet_update",table=observation?"knowledge_observation":"atlas_relation";
  if(sqlite.prepare(`DELETE FROM ${table} WHERE id=?`).run(row.entity_id).changes){
   const created=sqlite.prepare("SELECT entity_id,after_json FROM graph_event WHERE proposal_id=? AND entity='node' AND action='create'").get(id) as {entity_id:string;after_json:string}|undefined;
   if(created){
    const n=created.entity_id;
    const linked=sqlite.prepare("SELECT 1 FROM atlas_relation WHERE source=? OR target=? UNION ALL SELECT 1 FROM knowledge_observation WHERE node_id=? UNION ALL SELECT 1 FROM entity_link WHERE to_kind='node' AND to_id=? AND from_id<>(SELECT source_ref FROM proposal WHERE id=?) LIMIT 1").get(n,n,n,n,id);
    if(!linked){
     sqlite.prepare("DELETE FROM entity_link WHERE to_kind='node' AND to_id=? AND from_id=(SELECT source_ref FROM proposal WHERE id=?)").run(n,id);
     sqlite.prepare("DELETE FROM atlas_membership WHERE node_id=?").run(n);
     sqlite.prepare("DELETE FROM atlas_node WHERE id=?").run(n);
     event("undo","node",n,JSON.parse(created.after_json),null,id);
    }
   }
   event("undo",observation?"observation":"relation",row.entity_id,JSON.parse(row.after_json),null,id);
   sqlite.prepare("UPDATE proposal SET status='undone',resolved_at=? WHERE id=?").run(new Date().toISOString(),id);
  }
 })();revalidatePath("/notebook/inbox");
}

export async function setNoteGoal(id:string,goal:string){
 await requireSignedIn(); requireV2();ensureNotebook();
 const journey=goal&&sqlite.prepare("SELECT 1 FROM journey WHERE id=?").get(goal)?goal:null;
 sqlite.prepare("UPDATE document SET journey_id=? WHERE id=?").run(journey,id);
 revalidatePath("/notebook","layout");
}

export async function refineNote(text:string){
 await requireSignedIn(); requireV2();
 if(!text.trim())return {markdown:text,how:"basic" as const,note:"There is nothing to tidy yet."};
 if(text.length>REFINE_MAX)return {markdown:text,how:"basic" as const,note:"This note is too long to tidy in one go. Split it first."};
 return refine(text);
}
