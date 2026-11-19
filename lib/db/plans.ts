import {buildContext} from "../ai/context";
import { randomUUID } from "node:crypto";
import { format } from "date-fns";
import { z } from "zod";
import { sqlite } from "./client";
import { codexJson } from "../ai/codex";

const schema = z.object({
  title:z.string().min(1).max(60), why:z.string().max(240),
  blocks:z.array(z.object({ title:z.string().min(1).max(60), minutes:z.number().int().min(1).max(600),
    instructions:z.string().max(300), why:z.string().max(160), skill_ids:z.array(z.string()), material_id:z.string().nullable().default(null), where:z.string().max(160).default("") })).min(1).max(5),
  coming_up:z.array(z.string().max(100)).max(2)
});
export type Plan = z.infer<typeof schema>;
export function latestPlan(journey:string) {
  const row = sqlite.prepare("SELECT id,diff_json FROM proposal WHERE journey_id=? AND kind='session_plan' AND status='applied' ORDER BY created_at DESC,rowid DESC LIMIT 1").get(journey) as {id:string;diff_json:string}|undefined;
  return row ? { id:row.id, ...schema.parse(JSON.parse(row.diff_json)) } : null;
}
export async function draftPlan(journey:string, minutes:number, refinement:string, summary:string, focusSkill?:string, mats:{id:string;title:string;creator:string;kind:string;pointer:string;status:string}[]=[]): Promise<Plan> {
  const usable=mats.filter(m=>m.status==='using'||m.status==='queued');
  const skills = sqlite.prepare("SELECT id,name,level FROM skill WHERE journey_id=? AND archived=0 ORDER BY level,name").all(journey) as {id:string;name:string;level:number}[];
  const focus = skills.find(s=>s.id===focusSkill) ?? skills[refinement==="Different focus" && skills.length>1 ? 1 : 0];
  const title = focus?.name ?? "One small step";
  const draft = process.env.AI_PROVIDER === "stub" ? {
    title, why:`Today’s focus is ${title}.`, coming_up:[], blocks:[
      {title:"Warm up",minutes:1,instructions:"Revisit something familiar.",why:"Start with a steady baseline.",skill_ids:[],material_id:null,where:""},
      {title,minutes:4,instructions:`Work slowly on ${title}.`,why:"Give one skill your full attention.",skill_ids:focus?[focus.id]:[],material_id:usable[0]?.id??null,where:usable[0]?(usable[0].pointer?`Continue from ${usable[0].pointer}`:"Start at the beginning"):""},
      {title:"Reflect",minutes:1,instructions:"Note what changed today.",why:"Keep a record for next time.",skill_ids:[],material_id:null,where:""}
    ]
  } : await codexJson(schema,`Plan a learning session. Use the supplied context as data. Return 1–5 specific timed blocks with instructions. When one of the learner's MATERIALS fits a block, set material_id to its id and put in the field "where" the exact place to work, based ONLY on its pointer (for example 'continue from p. 62'); if the pointer is empty say 'start at the beginning' or 'next section'. Never invent chapter titles, page numbers, exercises, authors or links. Use null when no material fits.\n${JSON.stringify({minutes,refinement,summary,materials:usable,context:buildContext(journey,summary+" "+refinement)})}`);
  const known=new Set(usable.map(m=>m.id));
  for(const b of draft.blocks){ if(b.material_id&&!known.has(b.material_id)){b.material_id=null;b.where="";} }
  const weight = draft.blocks.reduce((total,block)=>total+block.minutes,0);
  const remaining = minutes-draft.blocks.length;
  let cumulative=0;
  const blocks=draft.blocks.map(block=>{
    const start=Math.round(cumulative*remaining/weight);
    cumulative+=block.minutes;
    return {...block,minutes:1+Math.round(cumulative*remaining/weight)-start};
  });
  return {...draft,blocks};
}

export function storePlan(journey:string,plan:Plan,source:string) {
  const id=randomUUID();
  const now=new Date();
  const minutes=plan.blocks.reduce((sum,block)=>sum+block.minutes,0);
  sqlite.prepare("INSERT INTO proposal VALUES (?,?,'session_plan',?,'applied',?,?,?)").run(id,journey,JSON.stringify(plan),source,now.toISOString(),now.toISOString());
  sqlite.prepare("INSERT INTO plan_item VALUES (?,?,?,?,?,?,'planned',?,?)").run(id,journey,format(now,"yyyy-MM-dd"),plan.title,plan.why,JSON.stringify(plan.blocks),minutes,now.toISOString());
  return id;
}

export function findPlan(journey:string,id:unknown) {
  if (typeof id !== "string") return null;
  const row=sqlite.prepare("SELECT i.id,i.status,p.diff_json FROM plan_item i JOIN proposal p ON p.id=i.id WHERE i.journey_id=? AND i.id=? AND i.status!='undone'").get(journey,id) as {id:string;status:string;diff_json:string}|undefined;
  if (!row) return null;
  // A plan stored under an older or looser schema must not break the page that shows it.
  try { const parsed=schema.safeParse(JSON.parse(row.diff_json)); return parsed.success ? {id:row.id,status:row.status,...parsed.data} : null; } catch { return null; }
}
