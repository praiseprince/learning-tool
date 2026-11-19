import { randomUUID } from "node:crypto";
import { sqlite } from "../db/client.ts";

export const relationKinds = ["requires","helps_understand","part_of","contrasts_with","applies_to","related_to","cross_domain_bridge"] as const;
export type NodeKind = "concept" | "skill" | "question" | "topic";
export type AtlasNode = {id:string; label:string; kind:NodeKind; description:string; origin:string; legacy_id:string|null};
export type Relation = {id:string; source:string; target:string; kind:string; rationale:string; origin:string};
export type Observation = {id:string; node_id:string; kind:string; source_kind:string; source_id:string; quote:string; observed_at:string; recorded_at:string; journey:string|null};
let initialized=false;

export function event(kind:string,entity:string,id:string,before:unknown,after:unknown,proposal:string|null=null) {
  sqlite.prepare("INSERT INTO graph_event VALUES(?,?,?,?,?,?,?,?)").run(randomUUID(),kind,entity,id,JSON.stringify(before),JSON.stringify(after),proposal,new Date().toISOString());
}
export function insertRelation(source:string,target:string,kind:string,rationale:string,origin:string,proposal:string|null=null) {
  if(!relationKinds.includes(kind as typeof relationKinds[number])||!rationale.trim()) throw Error("Choose a relation and explain it.");
  if(source===target) throw Error("Choose two different nodes.");
  if(["related_to","contrasts_with","cross_domain_bridge"].includes(kind)&&source>target) [source,target]=[target,source];
  if(["requires","part_of"].includes(kind)) {
    const cycle=sqlite.prepare(`WITH RECURSIVE path(id) AS (SELECT ? UNION SELECT r.target FROM atlas_relation r JOIN path ON path.id=r.source WHERE r.kind=?) SELECT 1 FROM path WHERE id=?`).get(target,kind,source);
    if(cycle) throw Error("This link would form a cycle.");
  }
  const id=randomUUID();
  sqlite.prepare("INSERT INTO atlas_relation VALUES (?,?,?,?,?,?)").run(id,source,target,kind,rationale,origin);
  event("create","relation",id,null,{id,source,target,kind,rationale,origin},proposal);
  return id;
}
export function ensureAtlas(){
  if(initialized)return;
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(()=>{
    sqlite.exec(`CREATE TABLE IF NOT EXISTS schema_migration(id TEXT PRIMARY KEY,applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS atlas_node(id TEXT PRIMARY KEY,label TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('concept','skill','question','topic')),description TEXT NOT NULL,origin TEXT NOT NULL,legacy_id TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS atlas_membership(node_id TEXT NOT NULL REFERENCES atlas_node(id),journey_id TEXT NOT NULL REFERENCES journey(id),PRIMARY KEY(node_id,journey_id));
    CREATE TABLE IF NOT EXISTS atlas_relation(id TEXT PRIMARY KEY,source TEXT NOT NULL REFERENCES atlas_node(id),target TEXT NOT NULL REFERENCES atlas_node(id),kind TEXT NOT NULL,rationale TEXT NOT NULL,origin TEXT NOT NULL,UNIQUE(source,target,kind));
    CREATE INDEX IF NOT EXISTS atlas_target ON atlas_relation(target,kind);
    CREATE TABLE IF NOT EXISTS knowledge_observation(id TEXT PRIMARY KEY,node_id TEXT NOT NULL REFERENCES atlas_node(id),kind TEXT NOT NULL,source_kind TEXT NOT NULL,source_id TEXT NOT NULL,quote TEXT NOT NULL,observed_at TEXT NOT NULL,recorded_at TEXT NOT NULL,journey TEXT);
    CREATE INDEX IF NOT EXISTS knowledge_node ON knowledge_observation(node_id,observed_at);
    CREATE TABLE IF NOT EXISTS graph_event(id TEXT PRIMARY KEY,action TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT NOT NULL,before_json TEXT,after_json TEXT,proposal_id TEXT,recorded_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS migration_issue(id TEXT PRIMARY KEY,detail TEXT NOT NULL);`);
    if(sqlite.prepare("SELECT 1 FROM schema_migration WHERE id='atlas-1'").get())return;
    const skills=sqlite.prepare("SELECT * FROM skill ORDER BY id").all() as {id:string;name:string;description:string|null;journey_id:string;parent_id:string|null;prereq_ids_json:string}[];
    for(const s of skills){
      const id="legacy-"+s.id;
      const n={id,label:s.name,kind:"skill",description:s.description||"",origin:"import",legacy_id:s.id};
      sqlite.prepare("INSERT INTO atlas_node VALUES (@id,@label,@kind,@description,@origin,@legacy_id)").run(n);
      sqlite.prepare("INSERT INTO atlas_membership VALUES (?,?)").run(id,s.journey_id);
      event("import","node",id,null,n);
    }
    const issue=sqlite.prepare("INSERT OR REPLACE INTO migration_issue VALUES (?,?)");
    for(const s of skills){
      let parents:unknown;
      try{parents=JSON.parse(s.prereq_ids_json);}catch{parents=null;}
      if(!Array.isArray(parents)){issue.run(s.id+":prerequisites","Unreadable prerequisite list");parents=[];}
      const links=(parents as unknown[]).map(target=>({target,kind:"requires"}));
      if(s.parent_id) links.push({target:s.parent_id,kind:"part_of"});
      for(const {target,kind} of links) {
        try{insertRelation("legacy-"+s.id,"legacy-"+target,kind,"Imported from the original skill record.","import");}
        catch(e){issue.run([s.id,kind,target].join(":"),String(e));}
      }
    }
    const observations=sqlite.prepare(`SELECT v.*, e.raw_text,e.occurred_on,e.journey_id FROM skill_event v LEFT JOIN log_entry e ON e.id=v.entry_id ORDER BY v.at,v.id`).all() as {id:string;skill_id:string;entry_id:string;evidence_quote:string;at:string;raw_text:string|null;occurred_on:string|null;journey_id:string|null}[];
    for(const v of observations){
      const node="legacy-"+v.skill_id;
      if(!sqlite.prepare("SELECT 1 FROM atlas_node WHERE id=?").get(node)){issue.run(v.id,"Missing legacy skill");continue;}
      const anchored=!!v.evidence_quote&&!!v.raw_text?.includes(v.evidence_quote);
      if(v.entry_id&&!anchored)issue.run(v.id,"Entry quotation could not be verified; linked to the original skill event.");
      const o={id:"event-"+v.id,node_id:node,kind:"legacy_skill_event",source_kind:anchored?"log_entry":"skill_event",source_id:anchored?v.entry_id:v.id,quote:v.evidence_quote,observed_at:v.occurred_on||v.at,recorded_at:v.at,journey:v.journey_id};
      sqlite.prepare("INSERT INTO knowledge_observation VALUES(@id,@node_id,@kind,@source_kind,@source_id,@quote,@observed_at,@recorded_at,@journey)").run(o);
      event("import","observation",o.id,null,o);
    }
    sqlite.prepare("INSERT INTO schema_migration VALUES('atlas-1',?)").run(new Date().toISOString());
  })();
  initialized=true;
}
export function projection(journey?:string) {
  ensureAtlas();
  const nodes=(journey?sqlite.prepare("SELECT n.* FROM atlas_node n JOIN atlas_membership m ON m.node_id=n.id WHERE m.journey_id=? ORDER BY n.label,n.id").all(journey):sqlite.prepare("SELECT * FROM atlas_node ORDER BY label,id").all()) as AtlasNode[];
  const ids=new Set(nodes.map(n=>n.id));
  const edges=(sqlite.prepare("SELECT * FROM atlas_relation ORDER BY id").all() as Relation[]).filter(e=>ids.has(e.source)&&ids.has(e.target));
  return {nodes,edges};
}
