import {sqlite} from "./client.ts";
export function preferences() {
 return sqlite.prepare("SELECT minutes,time_of_day,week_start,theme FROM preference WHERE id=1").get() as {minutes:number;time_of_day:string;week_start:0|1;theme:string}|undefined ?? {minutes:30,time_of_day:"Any time",week_start:1 as const,theme:"system"};
}
const legacyTables=["interview","rollup","extraction_answer","log_extraction","entry_time","skill_event","proposal","review","plan_item","profile_fact","state_snapshot","log_entry","skill","charter","journey","preference"] as const;

const v2Tables=["route_step","learning_route","guide_turn","guide_conversation","bridge_review","atlas_redirect","atlas_alias","entity_link","resource","document_revision","document","knowledge_observation","atlas_relation","atlas_membership","graph_event","atlas_node","migration_issue","notebook_search"] as const;
export function personalTables(){
 const installed=new Set((sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(row=>row.name));
 return [...v2Tables.filter(name=>installed.has(name)),...legacyTables];
}
export function clearPersonalData(){
 sqlite.transaction(()=>{
  for(const table of personalTables())sqlite.exec(`DELETE FROM ${table}`);
 })();
}
