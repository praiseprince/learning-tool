"use server";
import {requireSignedIn} from "@/lib/signed-in";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { sqlite } from "@/lib/db/client";
import { requireV2 } from "@/lib/v2/access";
import { event,insertRelation } from "@/lib/v2/atlas";
export async function createNode(journey:string,data:FormData) {
  await requireSignedIn(); requireV2();
  const label=String(data.get("label")??"").trim(),kind=String(data.get("kind")),description=String(data.get("description")??"").trim();
  if(!label||label.length>160||description.length>3000||!["concept","skill","topic","question"].includes(kind))throw Error("Check the concept details.");
  const id=randomUUID(),proposal=randomUUID(),now=new Date().toISOString();
  sqlite.transaction(()=>{
    const n={id,label,kind,description,origin:"user",legacy_id:null};
    sqlite.prepare("INSERT INTO proposal VALUES(?,?,'node_create',?,'accepted',?,?,?)").run(proposal,journey,JSON.stringify(n),id,now,now);
    sqlite.prepare("INSERT INTO atlas_node VALUES(@id,@label,@kind,@description,@origin,@legacy_id)").run(n);
    if(journey)sqlite.prepare("INSERT INTO atlas_membership VALUES(?,?)").run(id,journey);
    event("create","node",id,null,n,proposal);
  })();
  redirect("/atlas/n/"+id);
}
export async function linkNodes(source:string,data:FormData) {
  await requireSignedIn(); requireV2();
  const target=String(data.get("target")),kind=String(data.get("kind")),rationale=String(data.get("rationale")??"").trim();
  if(rationale.length>1000)throw Error("Keep the explanation under 1,000 characters.");
  const id=randomUUID(),now=new Date().toISOString();
  try{sqlite.transaction(()=>{
    sqlite.prepare("INSERT INTO proposal VALUES(?,'','relation_create',?,'accepted',?,?,?)").run(id,JSON.stringify({source,target,kind,rationale}),source,now,now);
    insertRelation(source,target,kind,rationale,"user",id);
  })();}catch{redirect("/atlas/n/"+encodeURIComponent(source)+"?linkError=1");}
  redirect("/atlas/n/"+encodeURIComponent(source));
}

export async function assessNode(node:string,data:FormData){
 await requireSignedIn(); requireV2();const value=String(data.get("assessment")||"");
 if(!["unknown","uncertain","developing","comfortable"].includes(value))throw Error("Choose an assessment.");
 const now=new Date().toISOString(),id=randomUUID();
 sqlite.transaction(()=>{
  if(!sqlite.prepare("SELECT 1 FROM atlas_node WHERE id=?").get(node))throw Error("Concept unavailable.");
  const before=sqlite.prepare("SELECT after_json FROM graph_event WHERE entity='self_assessment' AND entity_id=? ORDER BY rowid DESC LIMIT 1").get(node) as {after_json:string}|undefined;
  sqlite.prepare("INSERT INTO proposal VALUES(?,'','self_assessment',?,'accepted',?,?,?)").run(id,JSON.stringify({node,value}),node,now,now);
  event("assess","self_assessment",node,before?JSON.parse(before.after_json):null,{node,value},id);
 })();redirect("/atlas/n/"+node);
}
