import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawn,execFileSync} from "node:child_process";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {chromium,devices} from "playwright";
const directory=await mkdtemp(join(tmpdir(),"marginalia-v2-shots-"));
const env={...process.env,DATABASE_URL:join(directory,"fixture.db"),AI_PROVIDER:"stub",MARGINALIA_V2:"1"};
execFileSync(process.execPath,["scripts/seed-bridge-fixture.mjs",env.DATABASE_URL],{env});
const port=3179,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(port)],{env,stdio:"ignore"});
const browser=await chromium.launch();
try{
 for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error("Screenshot host exited.");try{if((await fetch(base+"/atlas")).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 await mkdir("design/current/v2",{recursive:true});
 for(const [width,height] of [[390,844],[768,1024],[1280,800],[1440,900]])for(const theme of ["light","dark"]){
  const page=await browser.newPage({...(width===768?devices["iPad (gen 7)"]:{}),viewport:{width,height},colorScheme:theme,reducedMotion:"reduce"});
  for(const [name,route] of [["guide","/guide"],["global","/atlas"],["history","/atlas/history"],["notebook","/notebook"],["inbox","/notebook/inbox"],["local","/j/piano/atlas"],["node","/atlas/n/legacy-piano-0"]]){
   const response=await page.goto(base+route,{waitUntil:"domcontentloaded"});
   if(response.status()!==200)throw Error(`${route} returned ${response.status()}`);
   await page.getByRole("heading",{level:1}).waitFor();
   if(name==="local")await page.locator(".react-flow__node").first().waitFor();
   await page.evaluate(()=>document.fonts.ready);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error("Horizontal overflow: "+route);
   await page.screenshot({path:`design/current/v2/${name}-${width}-${theme}.png`,fullPage:true});
  }
  const citation=page.getByRole("link",{name:"Open original entry"}).first();
  if(width===768){
   if(await page.evaluate(()=>navigator.maxTouchPoints)<1)throw Error("Touch emulation is disabled.");
   await citation.tap();
  }else await citation.click();
  await page.waitForURL(/\/journal\?entry=/);
  if(width===768&&theme==="light"){
   await page.goto(base+"/atlas");
   await page.getByText("Filter concepts",{exact:true}).tap();
   await page.locator("select[name=area]").selectOption("piano");
   await page.getByLabel("With recorded evidence").check();
   await page.getByRole("button",{name:"Apply filters"}).tap();
   await page.waitForURL(url=>url.searchParams.get("area")==="piano"&&url.searchParams.get("evidence")==="yes");
   await page.getByRole("button",{name:"Show outline"}).tap();
   await page.locator(".v2-outline li").first().waitFor();
  }
  await page.close();
 }
 console.log("V2 atlas and citation checks passed at four widths in both themes.");
}finally{await browser.close();server.kill();await rm(directory,{recursive:true,force:true});}
