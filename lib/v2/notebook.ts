import { randomUUID } from "node:crypto";
import { sqlite } from "../db/client.ts";
import { ensureAtlas } from "./atlas.ts";

export type DocumentRow={id:string;title:string;kind:string;current_revision_id:string;journey_id:string|null;status:string;created_at:string;updated_at:string};
export type Revision={id:string;document_id:string;content_md:string;author_kind:string;based_on_revision_id:string|null;created_at:string;extraction_status:string};
export type Resource={id:string;kind:string;title:string;creator:string;url:string;notes:string;origin:string;created_at:string};
export type WikiLink={label:string;nodeId:string};
let ready=false;
export function ensureNotebook(){
 if(ready)return;
 ensureAtlas();
 sqlite.transaction(()=>{
 sqlite.exec(`CREATE TABLE IF NOT EXISTS document(id TEXT PRIMARY KEY,title TEXT NOT NULL,kind TEXT NOT NULL,current_revision_id TEXT NOT NULL,journey_id TEXT REFERENCES journey(id),status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS document_revision(id TEXT PRIMARY KEY,document_id TEXT NOT NULL REFERENCES document(id),content_md TEXT NOT NULL,author_kind TEXT NOT NULL,based_on_revision_id TEXT REFERENCES document_revision(id),created_at TEXT NOT NULL,extraction_status TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS revision_document ON document_revision(document_id,created_at);
 CREATE TABLE IF NOT EXISTS resource(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,creator TEXT NOT NULL,url TEXT NOT NULL,notes TEXT NOT NULL,origin TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS entity_link(id TEXT PRIMARY KEY,from_kind TEXT NOT NULL,from_id TEXT NOT NULL,to_kind TEXT NOT NULL,to_id TEXT NOT NULL,label TEXT NOT NULL,anchor TEXT NOT NULL,UNIQUE(from_kind,from_id,to_kind,to_id,label));
 CREATE INDEX IF NOT EXISTS link_back ON entity_link(to_kind,to_id);
 CREATE VIRTUAL TABLE IF NOT EXISTS notebook_search USING fts5(kind UNINDEXED,id UNINDEXED,title,body);`);
 if(!sqlite.prepare("SELECT 1 FROM schema_migration WHERE id='notebook-1'").get()){
  sqlite.exec(`INSERT INTO notebook_search SELECT 'entry',e.id,j.name,e.raw_text FROM log_entry e JOIN journey j ON j.id=e.journey_id;
  CREATE TRIGGER IF NOT EXISTS notebook_new_entry AFTER INSERT ON log_entry BEGIN INSERT INTO notebook_search VALUES('entry',NEW.id,(SELECT name FROM journey WHERE id=NEW.journey_id),NEW.raw_text); END;
  CREATE TRIGGER IF NOT EXISTS notebook_delete_entry AFTER DELETE ON log_entry BEGIN DELETE FROM notebook_search WHERE kind='entry' AND id=OLD.id; END;`);
  sqlite.prepare("INSERT INTO schema_migration VALUES ('notebook-1',?)").run(new Date().toISOString());
 }
 if(!sqlite.prepare("SELECT 1 FROM schema_migration WHERE id='notebook-event-search'").get()){
  sqlite.exec(`INSERT INTO notebook_search SELECT 'skill_event',e.id,s.name,e.evidence_quote FROM skill_event e JOIN skill s ON s.id=e.skill_id;
  CREATE TRIGGER notebook_skill_event AFTER INSERT ON skill_event BEGIN INSERT INTO notebook_search VALUES('skill_event',NEW.id,(SELECT name FROM skill WHERE id=NEW.skill_id),NEW.evidence_quote); END;
  CREATE TRIGGER notebook_delete_skill_event AFTER DELETE ON skill_event BEGIN DELETE FROM notebook_search WHERE kind='skill_event' AND id=OLD.id; END;`);
  sqlite.prepare("INSERT INTO schema_migration VALUES ('notebook-event-search',?)").run(new Date().toISOString());
 }
 })();ready=true;
}
export function documentById(id:string){
 ensureNotebook();
 return sqlite.prepare("SELECT * FROM document WHERE id=? AND status='active'").get(id) as DocumentRow|undefined;
}
export function revisionById(id:string){
 return sqlite.prepare("SELECT * FROM document_revision WHERE id=?").get(id) as Revision|undefined;
}
export function wikiLinks(revision:string):WikiLink[]{
 return sqlite.prepare("SELECT label,to_id AS nodeId FROM entity_link WHERE from_kind='revision' AND from_id=? AND to_kind='node'").all(revision) as WikiLink[];
}
export function storeDocument(input:{id:string;base:string|null;title:string;body:string;kind:string;journey:string|null;source?:string}){
 ensureNotebook();
 const {id,base,body}=input,title=input.title.trim()||"Untitled note";
 if(title.length>240||body.length>120000||!["note","reflection","source note","exploration","summary"].includes(input.kind))throw Error("Check the title, length and note type.");
 return sqlite.transaction(()=>{
  const old=documentById(id),now=new Date().toISOString();
  if(old&&old.title===title&&revisionById(old.current_revision_id)?.content_md===body)return {revision:old.current_revision_id,changed:false};
  if((old?.current_revision_id??null)!==base)throw Error("A newer revision is available. Your draft is still on this device.");
  const revision=randomUUID();
  if(!old)sqlite.prepare("INSERT INTO document VALUES (?,?,?,?,?,'active',?,?)").run(id,title,input.kind,revision,input.journey,now,now);
  else sqlite.prepare("UPDATE document SET title=?,current_revision_id=?,updated_at=? WHERE id=?").run(title,revision,now,id);
  sqlite.prepare("INSERT INTO document_revision VALUES(?,?,?,'learner',?,?,?)").run(revision,id,body,base,now,body.trim()?"pending":"done");
  const previous=new Map(base?wikiLinks(base).map(l=>[l.label,l.nodeId]):[]);
  for(const match of body.matchAll(/\[\[([^\]\n]{1,160})\]\]/g)){
   const label=match[1].trim(),known=previous.get(label);
   const candidates=known?[{id:known}]:sqlite.prepare("SELECT id FROM atlas_node WHERE label=? COLLATE NOCASE LIMIT 2").all(label) as {id:string}[];
   if(candidates.length===1)sqlite.prepare("INSERT OR IGNORE INTO entity_link VALUES(?,'revision',?,'node',?,?,?)").run(randomUUID(),revision,candidates[0].id,label,JSON.stringify({start:match.index,end:match.index+match[0].length}));
  }
  if(input.source&&sqlite.prepare("SELECT 1 FROM resource WHERE id=?").get(input.source))sqlite.prepare("INSERT OR IGNORE INTO entity_link VALUES(?,'document',?,'resource',?,'source','{}')").run(randomUUID(),id,input.source);
  sqlite.prepare("DELETE FROM notebook_search WHERE kind='document' AND id=?").run(id);
  sqlite.prepare("INSERT INTO notebook_search VALUES('document',?,?,?)").run(id,title,body);
  return {revision,changed:true};
 })();
}
export function searchNotebook(query:string){
 ensureNotebook();const terms=query.match(/[\p{L}\p{N}]+/gu)?.slice(0,10)||[];
 if(!terms.length)return [];
 return sqlite.prepare("SELECT kind,id,title,snippet(notebook_search,3,'','','…',18) AS excerpt FROM notebook_search WHERE notebook_search MATCH ? ORDER BY rank LIMIT 50").all(terms.map(w=>'"'+w+'"').join(" AND ")) as {kind:string;id:string;title:string;excerpt:string}[];
}
