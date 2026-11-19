"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sqlite } from "@/lib/db/client";
import { codexJson } from "@/lib/ai/codex";
import { initialInterview, loadInterview, type Interview } from "@/lib/db/interview";

const goalSchema=z.object({title:z.string().min(1).max(100),goal:z.string().max(1200),criterion:z.string().max(1200),question:z.string().max(400)});
const assessmentSchema=z.object({question:z.string().max(400),summary:z.string().max(1000),skill:z.string().max(100),level:z.number().int().min(0).max(5).nullable(),evidence:z.string().max(400),source:z.enum(["Self-report","Observed answer","Unassessed"])});

function update(id:string,revision:number,state:Interview) {
  return sqlite.prepare("UPDATE interview SET body=?,revision=revision+1 WHERE id=? AND revision=? AND completed=0").run(JSON.stringify(state),id,revision).changes;
}
export async function advanceInterview(id:string,revision:number,data:FormData) {
  if(!z.uuid().safeParse(id).success) throw Error("Invalid interview.");
  const saved=loadInterview(id);
  if(saved?.completed) redirect(`/j/${id}`);
  const here=`/new?draft=${id}`;
  if((saved?.revision??0)!==revision) redirect(here);
  const state=saved?.state??initialInterview();
  const field=(name:string,max=1200)=>String(data.get(name)??"").trim().slice(0,max);
  const intent=field("intent");
  if(state.stage==="confirm") {
    state.title=field("title",100); state.goal=field("goal"); state.criterion=field("criterion");
    if(!state.title || !state.goal || !state.criterion) throw Error("Complete the goal and success criterion.");
    state.stage="baseline"; state.question="What have you already tried toward this goal, and how did it go?";
    update(id,revision,state); redirect(here);
  }
  if(state.stage==="review") {
    const summary=field("summary");
    const hue = Number(field("hue"));
    if (![100,355,150,215,55,300].includes(hue)) throw Error("Choose a notebook color.");
    const originalSummary=state.summary;
    state.summary=summary;
    if(summary!==originalSummary) {state.source="Learner correction";state.level=null;}
    const level = field("level");
    if (state.skill && !level) state.level=null;
    if (state.skill && level && /^[0-5]$/.test(level) && Number(level)!==state.level) {
      state.level=Number(level);state.source="Learner correction";
    }
    const now=new Date().toISOString();
    sqlite.transaction(()=>{
      if(!update(id,revision,state)) return;
      const proposal=JSON.stringify(state);
      sqlite.prepare("INSERT INTO proposal VALUES (?,?,'journey_draft',?,'applied',?,?,?)").run(randomUUID(),id,proposal,id,now,now);
      sqlite.prepare("INSERT INTO journey(id,name,domain,hue,start_date,status,created_at) VALUES (?,?,'general',?,?,'active',?)").run(id,state.title,hue,now.slice(0,10),now);
      sqlite.prepare("INSERT INTO charter(id,journey_id,version,goal,why,done_looks_like,starting_point,created_at) VALUES (?,?,1,?,'',?,?,?)").run(randomUUID(),id,state.goal,state.criterion,summary,now);
      if(state.skill && state.level!==null) sqlite.prepare("INSERT INTO skill(id,journey_id,name,description,level,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(randomUUID(),id,state.skill,state.evidence,state.level,now,now);
      sqlite.prepare("INSERT INTO state_snapshot(id,journey_id,summary,created_at) VALUES (?,?,?,?)").run(randomUUID(),id,summary,now);
      sqlite.prepare("UPDATE interview SET completed=1 WHERE id=?").run(id);
    })();
    redirect(`/j/${id}`);
  }
  if(state.stage==="baseline" && intent==="skip") {
    state.stage="review";state.pending=false;state.summary="Starting level not yet assessed.";state.source="Unassessed";state.skill="";state.level=null;state.evidence="";
    update(id,revision,state);redirect(here);
  }
  if(!state.pending) {
    const answer=field("answer",2000);
    if(!answer) throw Error("Write an answer first.");
    state.turns.push({stage:state.stage,question:state.question,answer,inputKey:`interview-${saved?id:"new"}-${revision}`});state.pending=true;
    const changed=saved?update(id,revision,state):sqlite.prepare("INSERT OR IGNORE INTO interview(id,revision,body) VALUES (?,1,?)").run(id,JSON.stringify(state)).changes;
    if(!changed) redirect(here);
    revision++;
  }
  const answers=state.turns.filter(t=>t.stage===state.stage).map(t=>t.answer);
  try {
    if(state.stage==="goal") {
      const result=process.env.AI_PROVIDER==="stub"?{title:answers[0].slice(0,100),goal:answers[0],criterion:answers[1]??"",question:answers.length===1?"What would you do to tell whether you had reached that goal?":""}:
        await codexJson(goalSchema,"Interview the learner about their goal only. Update their editable notebook title, outcome and observable success criterion. Ask one targeted follow-up only if the outcome or criterion is unclear. Do not ask for details already supplied. An exploratory milestone is valid. Leave question empty when ready for learner confirmation.\n"+JSON.stringify(state.turns));
      Object.assign(state,result);
      if(!result.question || answers.length>=4) state.stage="confirm";
    } else {
      const result=process.env.AI_PROVIDER==="stub"?{question:answers.length===1?"Can you give a small example of what you can do independently?":"",summary:answers.at(-1)!,skill:"",level:null,evidence:answers.at(-1)!.slice(0,400),source:"Self-report"}:
        await codexJson(assessmentSchema,"Assess only the confirmed goal. Ask one small domain-specific diagnostic when a demonstration would inform the first exercise. If the learner is new or unsure, accept uncertainty. Once enough is known, leave question empty. Distinguish self-report from an observed answer. Use an exact quote from a baseline answer for evidence. Only assign a 0–5 skill level to a directly demonstrated ability; otherwise use null. Never infer pronunciation or physical execution from text.\n"+JSON.stringify(state));
      Object.assign(state,result);
      if(!result.question || answers.length>=3) state.stage="review";
      if(!result.evidence || !answers.some(a=>a.includes(result.evidence))) {state.evidence="";state.level=null;state.source="Unassessed";state.summary="Starting level not yet assessed.";}
      if(state.source!=="Observed answer") state.level=null;
    }
    state.pending=false;
    sqlite.transaction(()=>{
      if(update(id,revision,state)) sqlite.prepare("INSERT INTO proposal VALUES (?,?,'interview_turn',?,'applied',?,?,?)").run(randomUUID(),id,JSON.stringify(state),id,new Date().toISOString(),new Date().toISOString());
    })();
  } catch { redirect(here+"&retry=1"); }
  redirect(here);
}
