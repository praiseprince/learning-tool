import Link from "next/link";
import {format, startOfWeek} from "date-fns";
import {sqlite} from "@/lib/db/client";
import {preferences} from "@/lib/db/personal";
import {goalDetail, goals, inactiveGoals} from "@/lib/v2/goals";
import {ago} from "@/lib/v2/when";
import {setGoalStatus} from "./actions";
import {V2Shell} from "@/components/v2/shell";
import {GoalName, Head} from "@/components/v2/ui";

export default function Goals() {
  const list = goals().sort((a, b) => (b.last ?? "").localeCompare(a.last ?? "") || b.sessions - a.sessions || a.name.localeCompare(b.name)), parked = inactiveGoals(), start = format(startOfWeek(new Date(), {weekStartsOn: preferences().week_start}), "yyyy-MM-dd");
  const weekMin = sqlite.prepare("SELECT COALESCE(SUM(COALESCE(t.minutes,e.minutes,0)),0) AS m FROM log_entry e LEFT JOIN entry_time t ON t.entry_id=e.id WHERE e.journey_id=? AND e.kind='practice' AND e.occurred_on>=?");
  return <V2Shell active="Goals"><div className="page">
    <Head title="Goals" lede="What you are learning, and where you have got to." actions={<Link className="btn" href="/goals/new">Add a goal</Link>} />
    {list.length ? <ul className="goal-list">{list.map(g => {
      const d = goalDetail(g.id), steps = d?.steps ?? [], cur = d?.current ?? 0, m = (weekMin.get(g.id, start) as {m: number}).m;
      return <li key={g.id} style={{"--hue": g.hue} as React.CSSProperties}><Link href={`/goals/${g.id}`}>
        <div className="gl-h"><h2><i className="gm" aria-hidden="true" />{g.name}</h2>{g.last && <span className="muted small">{ago(g.last)}</span>}</div>
        {steps.length > 0 && <div className="gl-road"><p className="small"><span className="muted">Now</span> <bdi>{steps[cur]?.title ?? "Roadmap complete"}</bdi><span className="muted num"> · {Math.min(cur + 1, steps.length)} of {steps.length}</span></p>
          <span className="road-bar" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i < cur ? "done" : i === cur ? "here" : ""} />)}</span></div>}
        {g.position && <p className="gl-pos clamp-2" dir="auto">{g.position}</p>}
        <p className="meta num">{g.sessions} {g.sessions === 1 ? "session" : "sessions"}{m ? ` · ${m} min this week` : " · nothing yet this week"}</p></Link></li>;
    })}</ul>
      : parked.length ? <p className="muted">Nothing active. Resume a goal below, or add a new one.</p> : <div className="empty"><p className="prose">No goals yet. Tell me what you want to learn and I will turn it into a roadmap, a map of skills and a first plan.</p><Link className="btn" href="/goals/new">Add your first goal</Link></div>}
    {parked.length > 0 && <section className="section"><h2>Paused and archived</h2><p className="hint">Hidden from the chat, the Map and search. Nothing is deleted.</p>
      <ul className="rows">{parked.map(g => <li key={g.id}><div className="row"><Link href={`/goals/${g.id}`} className="t"><GoalName name={g.name} hue={g.hue} /><span className="muted small" style={{fontWeight: 400}}> · {g.status}</span></Link>
        <form action={setGoalStatus.bind(null, g.id, "active")}><button className="btn btn--quiet btn--sm">Resume</button></form></div></li>)}</ul></section>}
  </div></V2Shell>;
}
