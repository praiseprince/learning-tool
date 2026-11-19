import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const dir=await mkdtemp(join(tmpdir(),"marginalia-context-"));
process.env.DATABASE_URL=join(dir,"test.db");
try {
 const {sqlite}=await import("../lib/db/client.ts");
 const {buildContext}=await import("../lib/ai/context.ts");
 const insert=sqlite.prepare("INSERT INTO log_entry(id,journey_id,raw_text,kind,occurred_on,created_at) VALUES (?,?,?,'practice',?,?)");
 const today=new Date().toISOString().slice(0,10);
 for(let i=0;i<100;i++)insert.run(String(i),"piano","a".repeat(8000),today,today);
 insert.run("old","piano","cadence with the left hand","2020-01-01",today);
 insert.run("other","physics","cadence across journals","2020-01-01",today);
 const context=buildContext("piano","left hand cadence");
 assert.ok(context.length<21200);
 assert.ok(context.includes("cadence with the left hand"));
 assert.ok(!context.includes("across journals"));
 sqlite.close();console.log("Long-history context and journey isolation passed.");
} finally { await rm(dir,{recursive:true,force:true}); }
