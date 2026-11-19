import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const dir=await mkdtemp(join(tmpdir(),"marginalia-pages-"));
process.env.DATABASE_URL=join(dir,"fixture.db");
try{
 execFileSync(process.execPath,["scripts/seed-demo.mjs"]);
 const {storeDocument,wikiLinks,revisionById,searchNotebook}=await import("../../lib/v2/notebook.ts");
 const {sqlite}=await import("../../lib/db/client.ts");
 const body="# Tempo\n\n[[Scales]]\n\n$$a^2+b^2=c^2$$\n\n| key | mode |\n| --- | --- |\n| D | minor |";
 const input={id:"doc",base:null,title:"Tempo",kind:"note",journey:"piano",body};
 const first=storeDocument(input);
 assert.equal(revisionById(first.revision).content_md,body);
 assert.equal(wikiLinks(first.revision)[0].nodeId,"legacy-piano-1");
 sqlite.prepare("UPDATE atlas_node SET label='Major scales' WHERE id='legacy-piano-1'").run();
 const second=storeDocument({...input,base:first.revision,body:body+"\nAgain."});
 assert.equal(wikiLinks(second.revision)[0].nodeId,"legacy-piano-1");
 assert.throws(()=>storeDocument({...input,base:first.revision,body:"Stale"}));
 assert.equal(revisionById(first.revision).content_md,body);
 assert.equal(searchNotebook("Tempo")[0].id,"doc");
 console.log("Markdown/math bytes, stable links, revision conflicts and FTS retrieval passed.");
 sqlite.close();
}finally{await rm(dir,{recursive:true,force:true});}
