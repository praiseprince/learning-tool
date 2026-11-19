"use server";
import {randomUUID} from "node:crypto";
import {after} from "next/server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {sqlite} from "@/lib/db/client";
import {requireV2} from "@/lib/v2/access";
import {ensureNotebook,storeDocument,revisionById} from "@/lib/v2/notebook";
import {extractRevision,observationSuggestion} from "@/lib/v2/extract";
import {event} from "@/lib/v2/atlas";
export async function newNote(data:FormData){
 requireV2();const id=randomUUID();
 const result=storeDocument({id,base:null,title:String(data.get("title")||"Untitled note"),body:String(data.get("body")||""),kind:String(data.get("kind")||"note"),source:String(data.get("source")||""),journey:null});
 if(String(data.get("body")||"").trim())after(()=>extractRevision(result.revision));
 redirect("/notebook/d/"+id);
}
export async function saveRevision(id:string,base:string,title:string,body:string){
 requireV2();ensureNotebook();
 const result=storeDocument({id,base,title,body,kind:"note",journey:null});
 if(result.changed)after(()=>extractRevision(result.revision));
 return result.revision;
}
export async function retryRevision(id:string){
 requireV2();ensureNotebook();
 await extractRevision(id);revalidatePath("/notebook","layout");
}
export async function addSource(data:FormData){
 requireV2();ensureNotebook();
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
 requireV2();ensureNotebook();
 sqlite.transaction(()=>{
  const p=sqlite.prepare("SELECT diff_json,source_ref,status FROM proposal WHERE id=? AND kind='facet_update'").get(id) as {diff_json:string;source_ref:string;status:string}|undefined;
  if(!p||!["pending","deferred","unsupported"].includes(p.status))return;
  const intent=data.get("intent"),now=new Date().toISOString();
  if(intent==="accept"){
   const change=observationSuggestion.parse(JSON.parse(p.diff_json)),source=revisionById(p.source_ref);
   if(p.status==="unsupported"||!source||!source.content_md.includes(change.quote))throw Error("This quotation cannot support the change.");
   const scope=String(data.get("scope")??change.scope).trim().slice(0,500);
   if(!scope)throw Error("Describe what the quote supports.");
   const o={id:randomUUID(),node_id:change.nodeId,kind:change.kind,source_kind:"document_revision",source_id:source.id,quote:change.quote,observed_at:source.created_at,recorded_at:now,journey:null};
   sqlite.prepare("INSERT INTO knowledge_observation VALUES (@id,@node_id,@kind,@source_kind,@source_id,@quote,@observed_at,@recorded_at,@journey)").run(o);
   event("accept","observation",o.id,null,{...o,scope},id);
  }else if(intent!=="dismiss"&&intent!=="defer")throw Error("Unknown decision.");
  sqlite.prepare("UPDATE proposal SET status=?,resolved_at=? WHERE id=?").run(intent==="accept"?"accepted":intent==="dismiss"?"rejected":"deferred",now,id);
 })();revalidatePath("/notebook/inbox");
}
