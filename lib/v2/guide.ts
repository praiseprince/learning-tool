import {randomUUID} from "node:crypto";
import {sqlite} from "../db/client.ts";
import {ensureNotebook} from "./notebook.ts";

export type Conversation={id:string;context_id:string|null;title:string;status:string;updated_at:string};
export type Turn={id:string;role:string;raw_markdown:string;created_at:string};
export function ensureGuide(){
 ensureNotebook();
 sqlite.exec(`CREATE TABLE IF NOT EXISTS guide_conversation(id TEXT PRIMARY KEY,context_id TEXT REFERENCES journey(id),title TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS guide_turn(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES guide_conversation(id),role TEXT NOT NULL,raw_markdown TEXT NOT NULL,model_info_json TEXT NOT NULL,source_refs_json TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS guide_thread ON guide_turn(conversation_id,created_at);
 CREATE TRIGGER IF NOT EXISTS guide_index_turn AFTER INSERT ON guide_turn BEGIN
 INSERT INTO notebook_search VALUES('conversation',NEW.conversation_id,(SELECT title FROM guide_conversation WHERE id=NEW.conversation_id),NEW.raw_markdown); END;`);
}
export function conversation(id:string){
 ensureGuide();
 return sqlite.prepare("SELECT * FROM guide_conversation WHERE id=?").get(id) as Conversation|undefined;
}
export function turns(id:string){
 return sqlite.prepare("SELECT * FROM guide_turn WHERE conversation_id=? ORDER BY rowid").all(id) as Turn[];
}
export function appendTurn(id:string,role:"learner"|"guide",text:string,provider:string){
 const now=new Date().toISOString(),turnId=randomUUID();
 if(role==="guide")sqlite.prepare("INSERT INTO proposal VALUES(?,'','guide_reply',?,'accepted',?,?,?)").run(randomUUID(),JSON.stringify({turnId,text,provider}),id,now,now);
 sqlite.prepare("INSERT INTO guide_turn VALUES(?,?,?,?,?,'[]',?)").run(turnId,id,role,text,JSON.stringify({provider,promptVersion:1,schemaVersion:1}),now);
 sqlite.prepare("UPDATE guide_conversation SET updated_at=? WHERE id=?").run(now,id);
}
export function startConversation(goal:string,journey:string|null){
 ensureGuide();
 const title=goal.trim(),id=randomUUID(),now=new Date().toISOString();
 if(!title||title.length>1500)throw Error("Describe your goal in up to 1,500 characters.");
 sqlite.transaction(()=>{
  sqlite.prepare("INSERT INTO guide_conversation VALUES(?,?,?,'interview',?,?)").run(id,journey,title,now,now);
  appendTurn(id,"learner",title,"learner");
 })();
 return id;
}
