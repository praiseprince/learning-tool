import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {execFileSync} from "node:child_process";
const path=process.argv[2];
if(!path||existsSync(path))throw Error("Choose a new database file for this demonstration.");
process.env.DATABASE_URL=resolve(path);
execFileSync(process.execPath,["scripts/seed-demo.mjs"]);
const {sqlite}=await import("../lib/db/client.ts");
const {ensureBridges,addAlias}=await import("../lib/v2/bridges.ts");
const {event}=await import("../lib/v2/atlas.ts");
ensureBridges();
const now=new Date().toISOString();
sqlite.transaction(()=>{
 sqlite.prepare("INSERT INTO journey(id,name,domain,hue,start_date,status,created_at) VALUES ('running','Running','movement',120,?,'active',?)").run(now.slice(0,10),now);
 for(const [id,journey,label,description] of [
  ["piano-partials","piano","String partials","A piano string produces several pitches at once. Its upper partials influence the sound of a note."],
  ["physics-harmonics","physics","Harmonics","Standing waves on a string have frequencies at integer multiples of its fundamental frequency."],
  ["running-pace","running","Conversational pace","Find a sustainable pace for a continuous easy run."]]){
  const node={id,label,kind:"concept",description,origin:"user",legacy_id:null};
  sqlite.prepare("INSERT INTO atlas_node VALUES(@id,@label,@kind,@description,@origin,@legacy_id)").run(node);
  sqlite.prepare("INSERT INTO atlas_membership VALUES(?,?)").run(id,journey);
  event("create","node",id,null,node);
 }
 addAlias("piano-partials","Harmonics");
})();
sqlite.close();
