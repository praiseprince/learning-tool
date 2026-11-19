"use server";
import {after} from "next/server";
import {summarizePastPeriod} from "@/lib/ai/rollup";
import {randomUUID} from "node:crypto";
import {redirect} from "next/navigation";
import {sqlite} from "@/lib/db/client";
export async function saveSkill(journey:string,id:string|null,data:FormData) {
 const name=String(data.get("name")||"").trim(),level=Number(data.get("level"));
 if(!name || name.length>100 || !Number.isInteger(level) || level<0 ||level>5)throw Error("Check the skill name and level.");
 const note=String(data.get("note")||"").slice(0,1000),now=new Date().toISOString();
 sqlite.transaction(()=>{
   if(!sqlite.prepare("SELECT 1 FROM journey WHERE id=?").get(journey))throw Error("Journey unavailable.");
   const parents=[...new Set(data.getAll("prerequisite").map(String))];
   const graph=new Map((sqlite.prepare("SELECT id,prereq_ids_json FROM skill WHERE journey_id=? AND archived=0").all(journey) as {id:string;prereq_ids_json:string}[]).map(row=>[row.id,JSON.parse(row.prereq_ids_json) as string[]]));
   const visited=new Set<string>();
   const reachesSelf=(key:string):boolean=>{
     if(key===id)return true;
     if(visited.has(key))return false;
     visited.add(key);return (graph.get(key)??[]).some(reachesSelf);
   };
   if(parents.some(parent=>!graph.has(parent)||reachesSelf(parent)))throw Error("Choose prerequisites that do not depend on this skill.");
   const dependencies=JSON.stringify(parents);
   if(!id) {sqlite.prepare("INSERT INTO skill(id,journey_id,name,description,level,prereq_ids_json,user_edited_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(randomUUID(),journey,name,note,level,dependencies,now,now,now);return;}
   const old=sqlite.prepare("SELECT level FROM skill WHERE journey_id=? AND id=?").get(journey,id) as {level:number}|undefined;
   if(!old)throw Error("Skill unavailable.");
   sqlite.prepare("UPDATE skill SET name=?,description=?,level=?,prereq_ids_json=?,archived=?,user_edited_at=?,updated_at=? WHERE id=?").run(name,note,level,dependencies,data.get("intent")==="archive"?1:0,now,now,id);
   if(old.level!==level) sqlite.prepare("INSERT INTO skill_event VALUES (?,?,?, ?,?,?,?)").run(randomUUID(),id,"",level,level-old.level,"Manual level edit",now);
 })();
 redirect(`/j/${journey}/skills`);
}
export async function markSeen(journey:string,asOf:string) {
 if(!Number.isFinite(Date.parse(asOf)) || Date.parse(asOf)>Date.now())return;
 const previous=sqlite.prepare("SELECT last_seen_at FROM journey WHERE id=?").get(journey) as {last_seen_at:string|null}|undefined;
 if(previous && (!previous.last_seen_at || Date.parse(asOf)-Date.parse(previous.last_seen_at)>3600000)) {
   after(async()=>{try {await summarizePastPeriod(journey);} catch { /* Retry on a later visit. */ }});
 }
 sqlite.prepare("UPDATE journey SET last_seen_at=? WHERE id=? AND (last_seen_at IS NULL OR last_seen_at<?)").run(asOf,journey,asOf);
}
