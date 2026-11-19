import {format,startOfWeek,startOfMonth,parseISO,addDays,addMonths} from "date-fns";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {sqlite} from "../db/client";
import {preferences} from "../db/personal";
import {codexJson} from "./codex";

export async function summarizePastPeriod(journey:string) {
 const now=new Date(),weekStartsOn=preferences().week_start;
 const dates=sqlite.prepare("SELECT DISTINCT occurred_on FROM log_entry WHERE journey_id=? ORDER BY occurred_on DESC").all(journey) as {occurred_on:string}[];
 const existing=new Set((sqlite.prepare("SELECT period||period_start AS key FROM rollup WHERE journey_id=?").all(journey) as {key:string}[]).map(row=>row.key));
 for(const period of ["week","month"] as const) {
  const start=(date:Date)=>period==="week"?startOfWeek(date,{weekStartsOn}):startOfMonth(date);
  const current=format(start(now),"yyyy-MM-dd");
  const from=dates.map(row=>format(start(parseISO(row.occurred_on)),"yyyy-MM-dd")).find(date=>date<current&&!existing.has(period+date));
  if(!from)continue;
  const to=format(period==="week"?addDays(parseISO(from),7):addMonths(parseISO(from),1),"yyyy-MM-dd");
  const entries=sqlite.prepare("SELECT raw_text FROM log_entry WHERE journey_id=? AND occurred_on>=? AND occurred_on<? ORDER BY occurred_on,created_at LIMIT 100").all(journey,from,to) as {raw_text:string}[];
  const text=entries.map(row=>row.raw_text).join("\n").slice(0,8000);
  const {summary}=process.env.AI_PROVIDER==="stub"?{summary:text.slice(0,500)}:await codexJson(z.object({summary:z.string().min(1).max(600)}),`Summarize this completed ${period} of learning in two sentences for future planning.\n${text}`);
  sqlite.transaction(()=>{
   if(!sqlite.prepare("SELECT 1 FROM journey WHERE id=?").get(journey))return;
   const id=randomUUID(),at=now.toISOString();
   const added=sqlite.prepare("INSERT OR IGNORE INTO rollup VALUES (?,?,?,?,?,?)").run(id,journey,period,from,summary,at);
   if(added.changes) sqlite.prepare("INSERT INTO proposal VALUES (?,?,'rollup',?,'applied',?,?,?)").run(randomUUID(),journey,JSON.stringify({summary}),id,at,at);
  })();
  return;
 }
}
