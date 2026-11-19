import {existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";
const target=process.argv[2],size=Number(process.argv[3]||30);
if(!target||existsSync(target)||![3,30,200,1000].includes(size))throw Error("Supply a new database path and a fixture size of 3, 30, 200 or 1000.");
process.env.DATABASE_URL=resolve(target);
execFileSync(process.execPath,["scripts/seed-demo.mjs"],{env:process.env});
const {sqlite}=await import("../lib/db/client.ts");
const {ensureAtlas,insertRelation,event}=await import("../lib/v2/atlas.ts");
ensureAtlas();
const at="2026-11-19T10:00:00.000Z";
sqlite.transaction(()=>{
 sqlite.prepare("INSERT INTO journey(id,name,domain,hue,start_date,status,created_at) VALUES ('scale','Concept index','fixture',215,'2026-11-19','active',?)").run(at);
 for(let i=0;i<size;i++){
  const id="scale-"+i,node={id,label:"Concept "+(i+1),kind:"concept",description:"Scale fixture",origin:"user",legacy_id:null};
  sqlite.prepare("INSERT INTO atlas_node VALUES(@id,@label,@kind,@description,@origin,@legacy_id)").run(node);
  sqlite.prepare("INSERT INTO atlas_membership VALUES(?,'scale')").run(id);event("create","node",id,null,node);
  if(i)insertRelation(id,"scale-"+Math.floor((i-1)/3),"part_of","Fixture hierarchy","user");
 }
})();
sqlite.close();console.log("Created disposable local atlas with "+size+" nodes.");
