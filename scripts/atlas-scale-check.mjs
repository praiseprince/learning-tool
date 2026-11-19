import {execFileSync,spawn} from "node:child_process";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {chromium} from "playwright";
const directory=await mkdtemp(join(tmpdir(),"atlas-scale-")),browser=await chromium.launch();
try{
 await mkdir("design/current/v2",{recursive:true});
 for(const n of [3,30,200,1000]){
  const file=join(directory,n+".db");
  execFileSync(process.execPath,["scripts/seed-v2-fixture.mjs",file,String(n)]);
  const port=3181,url=`http://127.0.0.1:${port}/j/scale/atlas`;
  const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(port)],{stdio:"ignore",env:{...process.env,MARGINALIA_V2:"1",AI_PROVIDER:"stub",DATABASE_URL:file}});
  try{
   for(let i=0;i<50;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
   for(const width of [390,1280])for(const theme of ["light","dark"]){
    const page=await browser.newPage({viewport:{width,height:width===390?844:800},colorScheme:theme});
    await page.goto(url,{waitUntil:"domcontentloaded"});await page.locator(".react-flow__node:visible").first().waitFor();
    await page.screenshot({path:`design/current/v2/scale-${n}-${width}-${theme}.png`});
    await page.getByRole("button",{name:"Show outline"}).click();
    if(await page.locator(".v2-outline li").count()!==n)throw Error("Incomplete outline");
    await page.close();
   }
  }finally{const stopped=new Promise(r=>server.once("exit",r));server.kill();await stopped;}
 }
 console.log("All four fixture sizes rendered; complete outlines verified.");
}finally{await browser.close();await rm(directory,{recursive:true,force:true});}
