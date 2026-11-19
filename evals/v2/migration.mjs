import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
const directory=await mkdtemp(join(tmpdir(),"marginalia-migration-"));
process.env.DATABASE_URL=join(directory,"fixture.db");
try{
 execFileSync(process.execPath,["scripts/seed-demo.mjs"],{env:process.env});
 const {sqlite}=await import("../../lib/db/client.ts");
 const {ensureAtlas,insertRelation,projection}=await import("../../lib/v2/atlas.ts");
 const entries=()=>sqlite.prepare("SELECT * FROM log_entry ORDER BY id").all();
 const before=entries();
 sqlite.prepare("UPDATE skill SET prereq_ids_json=? WHERE id='piano-0'").run('["dangling","piano-0"]');
 ensureAtlas();ensureAtlas();
 const count=table=>sqlite.prepare(`SELECT count(*) n FROM ${table}`).get().n;
 assert.equal(count("atlas_node"),count("skill"));
 assert.equal(count("knowledge_observation"),count("skill_event"));
 assert.equal(count("migration_issue"),2);
 const [a,b]=projection("piano").nodes;
 insertRelation(a.id,b.id,"requires","Fixture relation","user");
 assert.throws(()=>insertRelation(b.id,a.id,"requires","Would form a cycle","user"));
 assert.deepEqual(before,entries());
 for(const o of sqlite.prepare("SELECT o.quote,e.raw_text FROM knowledge_observation o JOIN log_entry e ON e.id=o.source_id WHERE o.source_kind='log_entry'").all())assert.ok(o.raw_text.includes(o.quote));
 console.log("Atlas migration: counts reconcile, invalid edges isolated, strict cycle rejected, original entries byte-identical.");
 sqlite.close();
}finally{await rm(directory,{recursive:true,force:true});}
