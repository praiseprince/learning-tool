import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFileSync,spawn} from "node:child_process";
import {chromium} from "playwright";
import Database from "better-sqlite3";

const browser=await chromium.launch();
try {
 for(const provider of ["stub","codex"]){
  const directory=await mkdtemp(join(tmpdir(),"marginalia-extraction-"));
  const env={...process.env,DATABASE_URL:join(directory,"test.db"),MARGINALIA_V2:"1",AI_PROVIDER:provider,PATH:directory+":"+process.env.PATH};
  await writeFile(join(directory,"codex"),"#!/bin/sh\nexit 1\n",{mode:0o755});
  execFileSync(process.execPath,["scripts/seed-demo.mjs"],{env});
  const port=Number(process.env.NOTE_TEST_PORT||3192)+(provider==="stub"?0:1),base="http://127.0.0.1:"+port;
  const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(port)],{env,stdio:"ignore"});
  const page=await browser.newPage();
  const db=new Database(env.DATABASE_URL);
  try{
   for(let attempt=0;attempt<60;attempt++){
    try{if((await fetch(base+"/notebook")).ok)break;}catch{}
    await new Promise(r=>setTimeout(r,150));
   }
   await page.goto(base+"/notebook");
   await page.getByLabel("New page title").fill("Practice notes");
   await page.getByRole("button",{name:"Create page"}).click();
   const body="I encountered [[Scales]] and [[Pedaling]].\n\n$$\\badcommand{ $$";
   await page.locator("textarea.v2-writing").fill(body);
   await page.getByRole("status").filter({hasText:/^Saved$/}).waitFor();
   const note=page.url();
   await page.getByRole("button",{name:"Preview"}).click();
   await page.getByRole("link",{name:"Scales",exact:true}).waitFor();
   assert.ok((await page.locator(".v2-prose").innerText()).includes("\\badcommand"));
   assert.ok((await (await fetch(note+"/export")).text()).endsWith("\n---\n"+body));
   if(provider==="stub"){
    await page.goto(base+"/notebook/inbox");
    await page.getByRole("button",{name:"Accept"}).first().click();
    await page.getByRole("button",{name:"Dismiss"}).nth(1).waitFor({state:"detached"});
    await page.getByRole("button",{name:"Dismiss"}).click();
    await page.getByText("Nothing waiting for review.").waitFor();
    assert.equal(db.prepare("SELECT count(*) n FROM knowledge_observation WHERE source_kind='document_revision'").get().n,1);
    await page.getByText("Recently accepted",{exact:true}).click();
    await page.getByRole("button",{name:"Undo acceptance"}).click();
    await page.getByRole("button",{name:"Undo acceptance"}).waitFor({state:"detached"});
    assert.equal(db.prepare("SELECT count(*) n FROM knowledge_observation WHERE source_kind='document_revision'").get().n,0);
    await page.goto(note);
    await page.locator("textarea.v2-writing").fill("An idea: [[Overtone series]].");
    await page.getByRole("status").filter({hasText:/^Saved$/}).waitFor();
    await page.goto(base+"/notebook/inbox");
    await page.getByRole("heading",{name:"New concept · Overtone series"}).waitFor();
    await page.getByRole("button",{name:"Accept",exact:true}).click();
    await page.getByText("Nothing waiting for review.").waitFor();
    assert.ok(db.prepare("SELECT id FROM atlas_node WHERE label='Overtone series'").get());
    await page.getByText("Recently accepted",{exact:true}).click();
    await page.getByRole("button",{name:"Undo acceptance"}).click();
    await page.getByRole("button",{name:"Undo acceptance"}).waitFor({state:"detached"});
    assert.ok(!db.prepare("SELECT id FROM atlas_node WHERE label='Overtone series'").get());
   }else{
    for(let i=0;i<100;i++){
     if(db.prepare("SELECT 1 FROM document_revision WHERE extraction_status='failed'").get())break;
     await new Promise(r=>setTimeout(r,100));
    }
    await page.goto(note);
    await page.getByRole("button",{name:"Retry suggestions"}).waitFor();
    assert.equal(await page.locator("textarea.v2-writing").inputValue(),body);
   }
   console.log(provider+" notebook acceptance passed");
  }finally{db.close();await page.close();server.kill();await rm(directory,{recursive:true,force:true});}
 }
}finally{await browser.close();}
