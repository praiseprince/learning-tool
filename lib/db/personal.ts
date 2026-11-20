import {dirname,join,resolve} from "node:path";
import {existsSync,readdirSync,readFileSync,renameSync,rmSync,statSync} from "node:fs";
import {sqlite} from "./client.ts";
import {workspaceRoot} from "../agent/workspace.ts";
export function preferences() {
 return sqlite.prepare("SELECT minutes,time_of_day,week_start,theme FROM preference WHERE id=1").get() as {minutes:number;time_of_day:string;week_start:0|1;theme:string}|undefined ?? {minutes:30,time_of_day:"Any time",week_start:1 as const,theme:"system"};
}
const legacyTables=["interview","rollup","extraction_answer","log_extraction","entry_time","skill_event","proposal","review","plan_item","profile_fact","state_snapshot","log_entry","skill","charter","journey","preference"] as const;

const v2Tables=["chat_event","plan_mark","agent_job","route_step","learning_route","guide_turn","guide_conversation","bridge_review","atlas_redirect","atlas_alias","entity_link","resource","document_revision","document","knowledge_observation","atlas_relation","atlas_membership","graph_event","atlas_node","migration_issue","notebook_search"] as const;
export function personalTables(){
 const installed=new Set((sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(row=>row.name));
 return [...v2Tables.filter(name=>installed.has(name)),...legacyTables];
}
/** Copies the whole database next to itself before anything is deleted, so a reset can always be undone by hand. Returns the backup path. */
export function backupBeforeReset(what="reset"){
 const dir=dirname(resolve(sqlite.name)),file=join(dir,`backup-before-${what}-${new Date().toISOString().replace(/[:.]/g,"-")}.db`);
 sqlite.exec(`VACUUM INTO '${file.replaceAll("'","''")}'`);
 return file;
}
export function clearPersonalData(){
 sqlite.transaction(()=>{
  for(const table of personalTables())sqlite.exec(`DELETE FROM ${table}`);
 })();
}
/** Clears the agent's per-goal workspaces. Uploads and generated files are kept beside the database backup (`keepAs`), never just deleted. */
export function clearWorkspaces(keepAs?:string){
 const root=workspaceRoot(); if(!existsSync(root))return;
 try { if(keepAs){ renameSync(root,keepAs); return; } } catch { /* another disk: fall through */ }
 try { rmSync(root,{recursive:true,force:true}); } catch { /* nothing to remove */ }
}
/** Files that belong to the learner: what they shared (inbox/) and what the Guide made for them (out/). Context and job logs are derived and left out. */
export function workspaceFiles(){
 const root=workspaceRoot(),out:{path:string;data:Buffer;date:Date}[]=[]; if(!existsSync(root))return out;
 const walk=(dir:string,rel:string)=>{ for(const e of readdirSync(dir,{withFileTypes:true})){ const p=join(dir,e.name),r=`${rel}/${e.name}`; if(e.isDirectory())walk(p,r); else if(e.isFile()){ const st=statSync(p); if(st.size<=50*1024*1024)out.push({path:r,data:readFileSync(p),date:st.mtime}); } } };
 for(const goal of readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name)){
  if(existsSync(join(root,goal,"inbox")))walk(join(root,goal,"inbox"),`files/${goal}/shared`);
  if(existsSync(join(root,goal,"out")))walk(join(root,goal,"out"),`files/${goal}/made-by-the-guide`);
 }
 return out;
}
