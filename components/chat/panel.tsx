import Link from "next/link";
import {format, startOfWeek} from "date-fns";
import {sqlite} from "@/lib/db/client";
import {preferences} from "@/lib/db/personal";
import {goalDetail, history, skillRows, LEVELS} from "@/lib/v2/goals";
import {materials} from "@/lib/v2/materials";
import {savePointer} from "@/app/chat-actions";
import {Meter} from "@/components/v2/ui";
import {currentWeek, doneDays} from "@/lib/agent/week";
import {nextDays} from "@/lib/agent/tasks";

/** Everything about the goal on one scrolling panel: where you are, the roadmap, materials, skills, evidence, this week. No tabs. */
export function GoalPanel({goal}: {goal: string}) {
  const d = goalDetail(goal); if (!d) return null;
  const {goal: g, steps, current} = d, mats = materials(goal).filter(m => m.status !== "dropped"), skills = skillRows(goal), h = history(goal);
  const start = format(startOfWeek(new Date(), {weekStartsOn: preferences().week_start}), "yyyy-MM-dd");
  const wk = sqlite.prepare("SELECT COUNT(*) AS n,COUNT(DISTINCT occurred_on) AS days,COALESCE(SUM(COALESCE(t.minutes,e.minutes,0)),0) AS m FROM log_entry e LEFT JOIN entry_time t ON t.entry_id=e.id WHERE e.journey_id=? AND e.kind='practice' AND e.occurred_on>=?").get(goal, start) as {n: number; days: number; m: number};
  const week = currentWeek(goal), today = nextDays(1)[0], did = doneDays(goal, week?.days.map(x => x.date) ?? []);
  const active = skills.filter(s => s.level > 0 && s.level < 4).slice(0, 6), solid = skills.filter(s => s.level >= 4).length;
  return <div className="gp">
    <section><h2>{g.name}</h2><p className="muted clamp-4" title={g.position || g.goal}>{g.position || g.goal}</p>
      {steps[current] && <p className="now"><span className="pin">Now</span> {steps[current].title}</p>}
      <p className="small"><Link className="link" href={`/goals/${goal}`}>Goal details</Link></p></section>

    <section><h3>This week</h3><p className="num">{wk.n ? `${wk.n} session${wk.n > 1 ? "s" : ""}, ${wk.m} minutes, ${wk.days} day${wk.days > 1 ? "s" : ""}` : "No sessions yet this week."}</p>
      {week ? <ol className="wk-mini">{week.days.map(x => <li key={x.date} className={(x.date === today ? "today " : "") + (x.minutes === 0 ? "rest " : "") + (did.has(x.date) ? "done" : "")} title={x.minutes ? `${x.focus}, ${x.minutes} min` : "Rest"}>
        <span className="num">{new Date(x.date + "T12:00").toLocaleDateString("en-GB", {weekday: "short"})}</span><span className="f">{x.minutes ? x.focus : "Rest"}</span>{did.has(x.date) ? <span aria-label="done">✓</span> : x.minutes ? <span className="muted num">{x.minutes}′</span> : null}</li>)}</ol>
        : <p className="muted small">No week plan. Say “plan my week”.</p>}</section>

    {steps.length > 0 && <section><h3>Roadmap</h3><ol className="mini-toc">{steps.map((s, i) => <li key={i} className={i === current ? "here" : i < current ? "done" : ""}>{s.title}{i === current && <span className="pin">here</span>}</li>)}</ol></section>}

    <section><h3>Materials</h3>
      {mats.length ? <ul className="mini-list">{mats.slice(0, 4).map(m => <li key={m.id}><p className="mt">{m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer">{m.title}</a> : m.title}<span className="muted small"> · {m.kind}</span></p>
        <form action={savePointer.bind(null, goal, m.id)} className="ptr-form"><input name="pointer" defaultValue={m.pointer} placeholder="Add page or time" aria-label={`Where you are in ${m.title}`} maxLength={140} /><button className="btn btn--text small">Save</button></form></li>)}</ul>
        : <p className="muted small">None yet. Say “find materials” or add one in <Link className="link" href={`/goals/${goal}?tab=materials`}>details</Link>.</p>}</section>

    <section><h3>Skills</h3>
      {active.length ? <ul className="mini-list">{active.map(s => <li key={s.id} className="skill-line"><Link href={`/atlas/n/${s.node}`}>{s.name}</Link><Meter level={s.level} label={LEVELS[s.level]} /></li>)}</ul> : <p className="muted small">None in progress yet.</p>}
      <p className="small muted">{skills.length} {skills.length === 1 ? "skill" : "skills"}, {solid} solid. <Link className="link" href={`/atlas?goal=${goal}`}>Open the map</Link></p></section>

    {h.moves.length > 0 && <section><h3>Recent evidence</h3><ul className="mini-list">{h.moves.slice(0, 2).map(m => <li key={m.id}><p className="small"><b>{m.skill}</b> <span className="muted">{m.at.slice(0, 10)}</span></p><p className="quote small">“{m.quote}”</p></li>)}</ul></section>}
  </div>;
}
