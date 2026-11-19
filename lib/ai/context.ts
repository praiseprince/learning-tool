import {format,subDays} from "date-fns";
import {sqlite} from "../db/client.ts";

function limited(label:string,rows:unknown[],tokens:number) {
  return label+"\n"+rows.map(row=>JSON.stringify(row)).join("\n").slice(0,tokens*4);
}
export function buildContext(journey:string,task:string) {
  const week=format(subDays(new Date(),6),"yyyy-MM-dd");
  const facts=sqlite.prepare("SELECT text FROM profile_fact WHERE status='active' ORDER BY edited_at DESC,created_at DESC LIMIT 40").all();
  const prefs=sqlite.prepare("SELECT minutes,time_of_day,week_start FROM preference WHERE id=1").all();
  const goal=sqlite.prepare("SELECT goal,why,done_looks_like,deadline,constraints,starting_point FROM charter WHERE journey_id=? ORDER BY version DESC LIMIT 1").all(journey);
  const state=sqlite.prepare("SELECT summary FROM state_snapshot WHERE journey_id=? ORDER BY created_at DESC LIMIT 1").all(journey);
  const skills=sqlite.prepare("SELECT id,name,level FROM skill WHERE journey_id=? AND archived=0 ORDER BY updated_at DESC LIMIT 100").all(journey);
  const recent=sqlite.prepare("SELECT occurred_on,substr(raw_text,1,3000) AS text FROM log_entry WHERE journey_id=? AND occurred_on>=? ORDER BY occurred_on DESC,created_at DESC LIMIT 30").all(journey,week);
  const summaries=sqlite.prepare("SELECT period,period_start,summary FROM rollup WHERE journey_id=? ORDER BY period_start DESC LIMIT 12").all(journey);
  const words=[...new Set(task.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])].filter(word=>!["the","and","you","your","with","this","that","for"].includes(word)).slice(0,8);
  const score=words.map(()=>"CAST(instr(lower(raw_text),?)>0 AS INTEGER)").join("+");
  const older=words.length?sqlite.prepare(`SELECT occurred_on,substr(raw_text,1,1600) AS text,(${score}) AS score FROM log_entry WHERE journey_id=? AND occurred_on<? AND score>0 ORDER BY score DESC,occurred_on DESC LIMIT 8`).all(...words,journey,week):[];
  return [limited("Profile and preferences",[...prefs,...facts],500),limited("Goal",goal,600),limited("Current state",state,400),limited("Skills",skills,600),limited("Recent entries",recent,1500),limited("Summaries",summaries,800),limited("Related older entries",older,800)].join("\n\n");
}
