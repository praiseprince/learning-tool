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
const {storeDocument}=await import("../lib/v2/notebook.ts");
const {startConversation,appendTurn}=await import("../lib/v2/guide.ts");
const {offerRoute,approveRoute,localRoute}=await import("../lib/v2/route.ts");
storeDocument({id:"overtones",base:null,title:"Listening for overtones",kind:"note",journey:"piano",body:"A single piano note contains more than one frequency. Compare [[String partials]] with [[Harmonics]].\n\n$$f_n=n f_1$$"});
const goal="Understand Marx’s philosophy";
const guide=startConversation(goal,null);
appendTurn(guide,"guide","What would you like to explain in your own words?","stub");
appendTurn(guide,"learner","Explain how historical materialism shapes a reading of a text.","learner");
const draft=localRoute(goal,[goal,"Explain Marx’s method using a short passage."],"");
approveRoute(offerRoute(guide,draft),{goal,success:draft.success,background:"Read a short introduction."});
startConversation("Understand why a violin string resonates","physics");
sqlite.close();
console.log(JSON.stringify({guide}));
