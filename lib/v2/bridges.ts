import {randomUUID} from "node:crypto";
import {sqlite} from "../db/client.ts";
import {ensureAtlas,insertRelation,event} from "./atlas.ts";

export function ensureBridges(){
 ensureAtlas();
 sqlite.exec(`CREATE TABLE IF NOT EXISTS atlas_alias(node_id TEXT NOT NULL REFERENCES atlas_node(id),label TEXT NOT NULL COLLATE NOCASE,PRIMARY KEY(node_id,label));
 CREATE INDEX IF NOT EXISTS alias_label ON atlas_alias(label);
 CREATE TABLE IF NOT EXISTS bridge_review(source TEXT NOT NULL REFERENCES atlas_node(id),target TEXT NOT NULL REFERENCES atlas_node(id),proposal_id TEXT UNIQUE NOT NULL REFERENCES proposal(id),PRIMARY KEY(source,target));`);
}
export type Candidate={source:string;target:string;label:string;first:string;second:string;firstContext:string;secondContext:string};
export function candidates():Candidate[]{
 ensureBridges();
 return sqlite.prepare(`WITH names AS (SELECT id AS node_id,lower(trim(label)) AS label FROM atlas_node UNION SELECT node_id,lower(trim(label)) FROM atlas_alias)
 SELECT a.node_id AS source,b.node_id AS target,min(a.label) AS label,n.label AS first,m.label AS second,n.description AS firstContext,m.description AS secondContext FROM names a JOIN names b ON a.label=b.label AND a.node_id<b.node_id
 JOIN atlas_node n ON n.id=a.node_id JOIN atlas_node m ON m.id=b.node_id
 WHERE a.label NOT IN ('practice','learning','skill','study','introduction','basics')
 AND EXISTS(SELECT 1 FROM atlas_membership x JOIN atlas_membership y ON x.journey_id<>y.journey_id WHERE x.node_id=n.id AND y.node_id=m.id)
 AND NOT EXISTS(SELECT 1 FROM bridge_review r WHERE r.source=n.id AND r.target=m.id)
 AND NOT EXISTS(SELECT 1 FROM atlas_relation r WHERE r.source=n.id AND r.target=m.id AND r.kind='cross_domain_bridge')
 GROUP BY a.node_id,b.node_id ORDER BY a.node_id,b.node_id LIMIT 8`).all() as Candidate[];
}
export function recordBridge(pair:Candidate,rationale:string,meaning:string){
 ensureBridges();
 return sqlite.transaction(()=>{
  if(sqlite.prepare("SELECT 1 FROM bridge_review WHERE source=? AND target=?").get(pair.source,pair.target))return;
  const id=randomUUID();
  sqlite.prepare("INSERT INTO proposal VALUES(?,'','bridge',?,'pending',?,?,NULL)").run(id,JSON.stringify({...pair,rationale,meaning}),pair.source,new Date().toISOString());
  sqlite.prepare("INSERT INTO bridge_review VALUES(?,?,?)").run(pair.source,pair.target,id);
 })();
}
export function decideBridge(id:string,intent:string,rationale:string,kind:string){
 ensureBridges();
 sqlite.transaction(()=>{
  const row=sqlite.prepare("SELECT b.source,b.target,p.status FROM bridge_review b JOIN proposal p ON p.id=b.proposal_id WHERE p.id=?").get(id) as {source:string;target:string;status:string}|undefined;
  if(!row||!["pending","deferred"].includes(row.status))return;
  if(!["accept","dismiss","defer"].includes(intent))throw Error("Choose a review decision.");
  if(intent==="accept"){
   if(!rationale.trim()||rationale.length>1200)throw Error("Explain this connection in 1–1200 characters.");
   insertRelation(row.source,row.target,kind,rationale,"review",id);
  }
  sqlite.prepare("UPDATE proposal SET status=?,resolved_at=? WHERE id=?").run(intent==="accept"?"accepted":intent==="dismiss"?"rejected":"deferred",new Date().toISOString(),id);
 })();
}
export function addAlias(node:string,label:string){
 ensureBridges();label=label.trim();
 if(!label||label.length>160)throw Error("Enter a name of up to 160 characters.");
 sqlite.transaction(()=>{
  if(sqlite.prepare("INSERT OR IGNORE INTO atlas_alias VALUES(?,?)").run(node,label).changes)event("add","alias",node+"/"+label,null,{node,label});
 })();
}

export function mergeConcept(source:string,target:string,undo=false){
 ensureBridges();
 sqlite.transaction(()=>{
  const redirects=sqlite.prepare("SELECT source,target FROM atlas_redirect WHERE source IN (?,?) OR target=?").all(source,target,source) as {source:string;target:string}[];
  if(undo){
   if(!redirects.some(r=>r.source===source&&r.target===target))throw Error("This merge has changed.");
   sqlite.prepare("DELETE FROM atlas_redirect WHERE source=? AND target=?").run(source,target);
   event("undo","redirect",source,{source,target},null);
  }else{
   if(source===target||redirects.length)throw Error("Choose distinct, unmerged concepts.");
   const cycle=sqlite.prepare(`WITH RECURSIVE edges(a,b,kind) AS (
    SELECT CASE WHEN r.source=@source THEN @target ELSE coalesce(s.target,r.source) END,
           CASE WHEN r.target=@source THEN @target ELSE coalesce(t.target,r.target) END,r.kind
    FROM atlas_relation r LEFT JOIN atlas_redirect s ON s.source=r.source LEFT JOIN atlas_redirect t ON t.source=r.target WHERE r.kind IN ('requires','part_of')),
    path(a,b,kind) AS (SELECT * FROM edges UNION SELECT p.a,e.b,p.kind FROM path p JOIN edges e ON e.a=p.b AND e.kind=p.kind)
    SELECT 1 FROM path WHERE a=b LIMIT 1`).get({source,target});
   if(cycle)throw Error("These concepts have a prerequisite or parent relationship that prevents merging.");
   sqlite.prepare("INSERT INTO atlas_redirect VALUES(?,?)").run(source,target);
   event("merge","redirect",source,null,{source,target});
  }
 })();
}
