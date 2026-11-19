"use server";
import {randomUUID} from "node:crypto";
import {redirect} from "next/navigation";
import {sqlite} from "@/lib/db/client";
export async function saveSkill(journey:string,id:string|null,data:FormData) {
 const name=String(data.get("name")||"").trim(),level=Number(data.get("level"));
 if(!name || name.length>100 || !Number.isInteger(level) || level<0 ||level>5)throw Error("Check the skill name and level.");
 const note=String(data.get("note")||"").slice(0,1000),now=new Date().toISOString();
 sqlite.transaction(()=>{
   if(!sqlite.prepare("SELECT 1 FROM journey WHERE id=?").get(journey))throw Error("Journey unavailable.");
   if(!id) {sqlite.prepare("INSERT INTO skill(id,journey_id,name,description,level,user_edited_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(randomUUID(),journey,name,note,level,now,now,now);return;}
   const old=sqlite.prepare("SELECT level FROM skill WHERE journey_id=? AND id=?").get(journey,id) as {level:number}|undefined;
   if(!old)throw Error("Skill unavailable.");
   sqlite.prepare("UPDATE skill SET name=?,description=?,level=?,archived=?,user_edited_at=?,updated_at=? WHERE id=?").run(name,note,level,data.get("intent")==="archive"?1:0,now,now,id);
   if(old.level!==level) sqlite.prepare("INSERT INTO skill_event VALUES (?,?,?, ?,?,?,?)").run(randomUUID(),id,"",level,level-old.level,"Manual level edit",now);
 })();
 redirect(`/j/${journey}/skills`);
}
export async function markSeen(journey:string,asOf:string) {
 if(!Number.isFinite(Date.parse(asOf)) || Date.parse(asOf)>Date.now())return;
 sqlite.prepare("UPDATE journey SET last_seen_at=? WHERE id=? AND (last_seen_at IS NULL OR last_seen_at<?)").run(asOf,journey,asOf);
}
