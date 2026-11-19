import {z} from "zod";
import {randomUUID} from "node:crypto";
import {sqlite} from "../db/client.ts";
import {ensureGuide,conversation} from "./guide.ts";
import {event} from "./atlas.ts";
const text=z.string().trim().min(1).max(1500);
export const routeDraft=z.object({
 goal:text,why:z.string().max(1500),background:z.string().max(1500),success:text,constraints:z.string().max(1500),
 steps:z.array(z.object({key:z.string().regex(/^[a-z0-9_-]{1,50}$/),title:text,necessity:z.enum(["core","helpful_context","optional_tangent"]),reason:text,approach:text,minutes:z.number().int().min(1).max(600),dependencies:z.array(z.string()).max(12)})).min(1).max(12)
});
export type Draft=z.infer<typeof routeDraft>;
export function validateDraft(input:unknown){
 const d=routeDraft.parse(input),known=new Set<string>();
 for(const s of d.steps){
  if(known.has(s.key)||s.dependencies.some(k=>!known.has(k)))throw Error("Order each step after its prerequisites and use unique keys.");
  known.add(s.key);
 }
 return d;
}
export function ensureRoutes(){
 ensureGuide();
 sqlite.exec(`CREATE TABLE IF NOT EXISTS learning_route(id TEXT PRIMARY KEY,journey_id TEXT NOT NULL REFERENCES journey(id),charter_id TEXT NOT NULL REFERENCES charter(id),revision INTEGER NOT NULL,status TEXT NOT NULL,supersedes_id TEXT REFERENCES learning_route(id),created_at TEXT NOT NULL,UNIQUE(journey_id,revision));
 CREATE UNIQUE INDEX IF NOT EXISTS learning_active ON learning_route(journey_id) WHERE status='active';
 CREATE TABLE IF NOT EXISTS route_step(id TEXT PRIMARY KEY,route_id TEXT NOT NULL REFERENCES learning_route(id),node_id TEXT NOT NULL REFERENCES atlas_node(id),position INTEGER NOT NULL,content_json TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS route_step_node ON route_step(node_id);`);
}
export function offerRoute(threadId:string,input:unknown){
 ensureRoutes();const draft=validateDraft(input),thread=conversation(threadId);
 if(!thread)throw Error("Conversation unavailable.");
 const base=sqlite.prepare("SELECT id FROM learning_route WHERE journey_id=? AND status='active'").get(thread.context_id) as {id:string}|undefined;
 const id=randomUUID();
 sqlite.prepare("INSERT INTO proposal VALUES(?,?,'guide_route',?,'pending',?,?,NULL)").run(id,thread.context_id||"",JSON.stringify({promptVersion:1,schemaVersion:1,draft,base:base?.id||null}),threadId,new Date().toISOString());
 return id;
}
export function approveRoute(id:string,edits:{goal:string;success:string;background:string}){
 ensureRoutes();
 return sqlite.transaction(()=>{
  const p=sqlite.prepare("SELECT * FROM proposal WHERE id=? AND kind='guide_route' AND status='pending'").get(id) as {source_ref:string;diff_json:string}|undefined;
  if(!p)throw Error("This draft has already been reviewed.");
  const {draft,base}=JSON.parse(p.diff_json),d=validateDraft({...draft,...edits}),thread=conversation(p.source_ref)!;
  const journey=thread.context_id||randomUUID(),now=new Date().toISOString();
  const previous=sqlite.prepare("SELECT id,revision FROM learning_route WHERE journey_id=? AND status='active'").get(journey) as {id:string;revision:number}|undefined;
  if((previous?.id||null)!==base)throw Error("The route changed. Draft a new revision.");
  if(!thread.context_id)sqlite.prepare("INSERT INTO journey(id,name,domain,hue,start_date,status,created_at) VALUES(?,?,'learning',215,?,'active',?)").run(journey,d.goal.slice(0,100),now.slice(0,10),now);
  const charter=randomUUID(),route=randomUUID();
  sqlite.prepare("INSERT INTO charter(id,journey_id,version,goal,why,done_looks_like,constraints,starting_point,created_at) SELECT ?,?,coalesce(max(version),0)+1,?,?,?,?,?,? FROM charter WHERE journey_id=?").run(charter,journey,d.goal,d.why,d.success,d.constraints,d.background,now,journey);
  if(previous)sqlite.prepare("UPDATE learning_route SET status='superseded' WHERE id=?").run(previous.id);
  sqlite.prepare("INSERT INTO learning_route VALUES(?,?,?,?,'active',?,?)").run(route,journey,charter,(previous?.revision||0)+1,base,now);
  for(const [i,s] of d.steps.entries()){
   let n=sqlite.prepare("SELECT n.id FROM atlas_node n JOIN atlas_membership m ON m.node_id=n.id WHERE m.journey_id=? AND n.label=? COLLATE NOCASE ORDER BY n.id LIMIT 1").get(journey,s.title) as {id:string}|undefined;
   if(!n){
    const node={id:randomUUID(),label:s.title,kind:"concept",description:s.reason,origin:"guide",legacy_id:null};
    sqlite.prepare("INSERT INTO atlas_node VALUES(@id,@label,@kind,@description,@origin,@legacy_id)").run(node);
    sqlite.prepare("INSERT INTO atlas_membership VALUES(?,?)").run(node.id,journey);
    event("create","node",node.id,null,node,id);n=node;
   }
   sqlite.prepare("INSERT INTO route_step VALUES(?,?,?,?,?)").run(randomUUID(),route,n.id,i,JSON.stringify(s));
  }
  sqlite.prepare("UPDATE guide_conversation SET context_id=?,status='active',updated_at=? WHERE id=?").run(journey,now,thread.id);
  sqlite.prepare("UPDATE proposal SET status='accepted',resolved_at=?,diff_json=? WHERE id=?").run(now,JSON.stringify({promptVersion:1,schemaVersion:1,draft:d,base,route}),id);
  return route;
 })();
}

export function localRoute(goal:string,answers:string[],manual:string):Draft{
 const words=answers.join(" ").toLowerCase();
 const marx=/marx/.test(words),focus=[...answers].reverse().find(a=>/econom|capital|surplus|philosoph|dialectic/i.test(a))||goal,economics=/econom|capital|surplus/i.test(focus);
 const labels=manual?[manual]:marx?(economics?["Commodity and value","Surplus value","Debates about value"]:["Historical materialism","Hegelian dialectics","Alienation in the early manuscripts"]):[goal.slice(0,160),"A worked example","An alternative approach"];
 const reasons=marx?(economics?["Distinguish use value from exchange value when reading Capital.","Tracing a working day connects production to Marx’s account of profit.","Later critiques give you a comparison after a first reading."]:["This is a starting point for exploring how Marx relates ideas to material life.","Marx’s critique of Hegel helps explain his use of dialectics. A short introduction is enough for this goal.","An early text gives you another angle on the relation between work and freedom."]):["Work directly on the outcome you described.","A concrete example can reveal what you still need to understand.","Compare approaches if the first one leaves a question open."];
 return {goal,why:"",background:answers[2]||"",success:answers[1]||"Describe or demonstrate one example in your own words.",constraints:answers[3]||"",steps:labels.map((title,i)=>({key:"step-"+i,title,necessity:(["core","helpful_context","optional_tangent"] as const)[i],reason:reasons[i],approach:manual||("Find one example of "+title+" and record how it relates to your goal."),minutes:i===0?15:20,dependencies:i?["step-0"]:[]}))};
}
