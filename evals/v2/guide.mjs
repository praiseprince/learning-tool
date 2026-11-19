import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
const dir=await mkdtemp(join(tmpdir(),"guide-route-"));
process.env.DATABASE_URL=join(dir,"test.db");
try{
 const {startConversation,conversation}=await import("../../lib/v2/guide.ts");
 const {localRoute,approveRoute,offerRoute,validateDraft}=await import("../../lib/v2/route.ts");
 const {sqlite}=await import("../../lib/db/client.ts");
 const goal="Understand Marx’s philosophy",thread=startConversation(goal,null);
 const d=localRoute(goal,[goal,"Explain historical materialism"],"");
 assert.equal(d.steps[1].title,"Hegelian dialectics");
 assert.equal(localRoute("Marx economics",["Marx economics"],"").steps[1].title,"Surplus value");
 assert.throws(()=>validateDraft({...d,steps:[{...d.steps[0],dependencies:["step-0"]}]}));
 const approve=p=>approveRoute(p,{goal,success:d.success,background:"Beginner"});
 approve(offerRoute(thread,d));
 const stale=offerRoute(thread,d);
 approve(offerRoute(thread,d));
 assert.throws(()=>approve(stale));
 assert.ok(conversation(thread).context_id);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM learning_route WHERE status='active'").get().n,1);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM charter").get().n,2);
 console.log("Goal-specific routes, dependency validation, version retention and stale draft protection passed.");
 sqlite.close();
}finally{await rm(dir,{recursive:true,force:true});}
