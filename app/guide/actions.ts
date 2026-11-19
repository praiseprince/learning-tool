"use server";
import {instruction} from "@/lib/v2/prompts";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {localRoute,offerRoute,approveRoute,routeDraft} from "@/lib/v2/route";
import {z} from "zod";
import {sqlite} from "@/lib/db/client";
import {codexJson} from "@/lib/ai/codex";
import {requireV2} from "@/lib/v2/access";
import {appendTurn,conversation,startConversation,turns} from "@/lib/v2/guide";

async function respond(id:string){
 const thread=conversation(id);if(!thread)throw Error("Conversation unavailable.");
 const history=turns(id),last=history.at(-1);
 if(last?.role!=="learner")return;
 const learner=history.filter(t=>t.role==="learner");
 const provider=process.env.AI_PROVIDER==="stub"?"stub":"codex";
 const response=z.object({question:z.string().min(1).max(700)});
 const scoped=history.slice(-14).map(t=>({role:t.role,text:t.raw_markdown.slice(0,2000)}));
 const questions=[`What would you like to be able to do or explain when you reach “${thread.title}”?`,"What have you tried already, and where does it start to feel difficult?","What time, materials, or other constraints should your route take into account?","What would make this plan feel worth following?"];
 let guidance="";
 const active=thread.context_id?sqlite.prepare("SELECT r.id,c.goal FROM learning_route r JOIN charter c ON c.id=r.charter_id WHERE r.journey_id=? AND r.status='active'").get(thread.context_id) as {id:string;goal:string}|undefined:null;
 let routeContext:unknown=null;
 if(active){
  const steps=(sqlite.prepare("SELECT content_json FROM route_step WHERE route_id=? ORDER BY position LIMIT 12").all(active.id) as {content_json:string}[]).map(r=>JSON.parse(r.content_json) as {title:string;minutes:number;reason:string;approach:string});
  const words=last.raw_markdown.toLowerCase(),time=words.match(/(\d+)\s*(?:min|minute)/);
  const step=steps.find(s=>s.title.toLowerCase().split(/\s+/).some(w=>w.length>3&&words.includes(w)))||steps[0];
  if(time){const fit=steps.find(s=>s.minutes<=Number(time[1]));guidance=fit?fit.approach+" Allow about "+fit.minutes+" minutes.":"Use the time to write one question about "+step.title+" in your notebook.";}
  else if(/source|research|search|read/.test(words))guidance="Search for “"+step.title+" introduction” and “"+step.title+" primary text”. Save a source you choose in your notebook.";
  else guidance=step.reason+" "+step.approach;
  routeContext={goal:active.goal,steps};
 }
 const result=guidance?(provider==="stub"?{question:guidance}:await codexJson(response,await instruction(/source|research|search|read/i.test(last.raw_markdown)?"resource":"guide")+"\n"+JSON.stringify({turns:scoped,routeContext}))):provider==="stub"?{question:questions[Math.min(learner.length-1,questions.length-1)]}:await codexJson(response,await instruction("interview")+"\n"+JSON.stringify(scoped));
 sqlite.transaction(()=>{
  if(turns(id).at(-1)?.id===last.id)appendTurn(id,"guide",result.question,provider);
 })();
}
export async function begin(data:FormData){
 requireV2();const id=startConversation(String(data.get("goal")||""),String(data.get("journey")||"")||null);
 let failed=false;try{await respond(id);}catch{failed=true;}
 redirect("/guide?thread="+id+(failed?"&unavailable=1":""));
}
export async function reply(id:string,data:FormData){
 requireV2();if(!conversation(id))throw Error("Conversation unavailable.");
 const answer=String(data.get("answer")||"").trim();
 if(answer&&answer.length<=4000)appendTurn(id,"learner",answer,"learner");
 let failed=false;try{await respond(id);}catch{failed=true;}
 revalidatePath("/guide");redirect("/guide?thread="+id+(failed?"&unavailable=1":""));
}

export async function draftRoute(id:string,data:FormData){
 requireV2();
 const thread=conversation(id);if(!thread)throw Error("Conversation unavailable.");
 const history=turns(id).filter(t=>t.role==="learner").map(t=>t.raw_markdown);
 const manual=String(data.get("manual")||"").trim();
 const prior=thread.context_id?sqlite.prepare("SELECT content_json FROM route_step WHERE route_id=(SELECT id FROM learning_route WHERE journey_id=? AND status='active') ORDER BY position LIMIT 12").all(thread.context_id):[];
 const stub=localRoute(thread.title,history,manual);
 let pid;
 try{
  const draft=manual||process.env.AI_PROVIDER==="stub"?stub:await codexJson(routeDraft,await instruction("charter")+"\n"+await instruction(prior.length?"replan":"route")+"\n"+JSON.stringify({learner:history.slice(-18),prior}));
  pid=offerRoute(id,draft);
 }catch{redirect("/guide?thread="+id+"&unavailable=1");}
 redirect("/guide?thread="+id+"&proposal="+pid);
}
export async function acceptRoute(thread:string,proposal:string,data:FormData){
 requireV2();approveRoute(proposal,{goal:String(data.get("goal")||""),success:String(data.get("success")||""),background:String(data.get("background")||"")});
 redirect("/guide?thread="+thread);
}
