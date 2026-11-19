import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
const dir=await mkdtemp(join(tmpdir(),"atlas-bridge-"));
process.env.DATABASE_URL=join(dir,"fixture.db");
try{
 execFileSync(process.execPath,["scripts/seed-demo.mjs"]);
 const {sqlite}=await import("../../lib/db/client.ts");
 const {mergeConcept,ensureBridges,addAlias,candidates,recordBridge,decideBridge}=await import("../../lib/v2/bridges.ts");
 const {acceptedAt}=await import("../../lib/v2/history.ts");
 ensureBridges();
 for(const [id,journey,label,description] of [
  ["music-harmonics","piano","String partials","A vibrating piano string sounds its fundamental and higher harmonics."],
  ["wave-harmonics","physics","Harmonics","Standing waves vibrate at integer multiples of the fundamental."]]){
  sqlite.prepare("INSERT INTO atlas_node VALUES(?,?,'concept',?,'user',NULL)").run(id,label,description);
  sqlite.prepare("INSERT INTO atlas_membership VALUES(?,?)").run(id,journey);
  (await import("../../lib/v2/atlas.ts")).event("create","node",id,null,{id,label,description,kind:"concept",origin:"user",legacy_id:null});
 }
 addAlias("music-harmonics","Harmonics");
 const pair=candidates().find(p=>p.label==="harmonics");
 assert.ok(pair);
 for(const decision of ["dismiss","accept"]){
  sqlite.exec("SAVEPOINT decision");
  recordBridge(pair,"A string produces standing waves at integer multiples of its fundamental frequency.","application");
  const {proposal_id}=sqlite.prepare("SELECT proposal_id FROM bridge_review").get();
  decideBridge(proposal_id,decision,"The pitches come from the string’s standing-wave modes.","cross_domain_bridge");
  assert.ok(!candidates().some(p=>p.label==="harmonics"));
  assert.equal(acceptedAt(new Date().toISOString().slice(0,10)).edges.filter(e=>e.kind==="cross_domain_bridge").length,decision==="accept"?1:0);
  assert.equal(acceptedAt("2000-01-01").nodes.length,0);
  sqlite.exec("ROLLBACK TO decision");
  sqlite.exec("RELEASE decision");
 }
 const {projection}=await import("../../lib/v2/atlas.ts");
 mergeConcept("music-harmonics","wave-harmonics");
 assert.ok(projection("piano").nodes.some(n=>n.id==="wave-harmonics"));
 assert.ok(!projection().nodes.some(n=>n.id==="music-harmonics"));
 mergeConcept("music-harmonics","wave-harmonics",true);
 assert.ok(projection("piano").nodes.some(n=>n.id==="music-harmonics"));
 console.log("Alias candidates, independent review, dismissal retention and historical replay passed.");
 sqlite.close();
}finally{await rm(dir,{recursive:true,force:true});}
