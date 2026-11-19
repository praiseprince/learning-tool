import Link from "next/link";
import {format} from "date-fns";
import {preferences} from "@/lib/db/personal";
import {dueSkills, stats, weeklyNote} from "@/lib/v2/stats";
import {LEVELS} from "@/lib/v2/goals";
import {V2Shell} from "@/components/v2/shell";
import {GoalName, Head, Meter} from "@/components/v2/ui";
import {Calendar, Levels, Trend, WeekBars, Weekdays} from "@/components/v2/charts";

export const dynamic = "force-dynamic";
const num = (n: number) => n.toLocaleString("en");
const plural = (n: number, w: string) => `${num(n)} ${w}${n === 1 ? "" : "s"}`;

export default function Progress() {
  const week = preferences().week_start, s = stats(week), note = weeklyNote(week), due = dueSkills(undefined, 21, 8);
  const diff = s.cur.minutes - s.prev.minutes;
  return <V2Shell active="Progress"><div className="page">
    <Head title="Progress" />
    <p className="lead-line">{s.total ? `${plural(s.activeDays, "day")} of practice in the last ${s.weeks} weeks, ${num(s.total)} minutes in all. This week: ${plural(s.cur.sessions, "session")}, ${num(s.cur.minutes)} minutes${s.prev.minutes ? (diff === 0 ? ", the same as last week." : `, ${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} than last week.`) : "."}` : "Nothing recorded yet. Log a session on Today and this page fills in."}</p>

    <div className="bento" style={{marginTop: 32}}>
      {note.hasData && <section className="tile cell s4" aria-labelledby="wk"><h2 id="wk">Last week, {note.range}</h2>
        <p className="prose">You practised on {plural(note.last.days, "day")}: {plural(note.last.n, "session")}, {num(note.last.m)} minutes{note.delta ? `, ${Math.abs(note.delta)} ${note.delta > 0 ? "more" : "fewer"} than the week before` : ""}.
          {note.up.length > 0 && <> Moved up: {note.up.map((u, i) => <span key={u.name}>{i ? ", " : ""}<b>{u.name}</b> ({LEVELS[u.a]} → {LEVELS[u.b]})</span>)}.</>}
          {note.stuck.length > 0 && <> Where it caught: “{note.stuck[0]}”.</>}
          {note.quiet.length > 0 && <> Quiet for 10+ days: {note.quiet.join(", ")}.</>}</p></section>}
      <section className={"tile cell " + (note.hasData ? "s2" : "s6")}><h2>Worth revisiting</h2><p className="hint">Reached “Learning” or better, no evidence for 3 weeks. A nudge, not a failure.</p>
        {due.length ? <ul className="rows">{due.slice(0, 4).map(d => <li key={d.id}><Link className="row" href={`/?goal=${d.goal}`}><div><div className="t">{d.name}</div><p className="s">{d.days} days ago</p></div></Link></li>)}</ul> : <p className="muted">Nothing is overdue.</p>}</section>

      {s.total > 0 && <>
        <section className="tile cell s3"><h2>Practice calendar</h2><Calendar days={s.days} weekStart={week} /></section>
        <section className="tile cell s3"><h2>When you practise</h2><p className="hint">Minutes by weekday, last {s.weeks} weeks.</p><Weekdays minutes={s.weekday} weekStart={week} /></section>
        <section className="tile cell s6"><h2>Minutes per week</h2><WeekBars goals={s.perGoal} weeks={s.weeks} /></section></>}

      <section className="tile cell s6"><h2>By goal</h2>
        {s.perGoal.length ? <ul className="rows">{s.perGoal.map(g => <li key={g.id}><Link className="row row--stat" href={`/goals/${g.id}`}>
          <div><div className="t"><GoalName name={g.name} hue={g.hue} /></div><Levels levels={g.levels} hue={g.hue} />
            <p className="s num">{g.skills} skills · {g.evidenced} with evidence · average {LEVELS[Math.round(g.average)]} · {g.sessions} {g.sessions === 1 ? "session" : "sessions"}{g.last ? ` · last ${g.last}` : ""}</p></div>
          <div className="m"><Trend values={g.weekly} hue={g.hue} /><span className="num">{num(g.minutes30)} min / 30 days</span></div></Link></li>)}</ul> : <p className="muted">No active goals.</p>}</section>

      {s.movers.length > 0 && <section className="tile cell s6"><h2>Moved up in the last 30 days</h2><ul className="rows">{s.movers.map(m => <li key={m.node}><Link className="row" href={`/atlas/n/${m.node}`}><div className="t">{m.skill}</div><div className="m"><Meter level={m.to} label={LEVELS[m.to]} /><br />{LEVELS[m.from]} → {LEVELS[m.to]}</div></Link></li>)}</ul></section>}
    </div>
    <p className="muted small" style={{marginTop: 32}}>All figures are counts of sessions and skill events you recorded, {format(new Date(), "d MMM yyyy")}. No scores are invented.</p>
  </div></V2Shell>;
}
