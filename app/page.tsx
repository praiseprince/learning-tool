import { v2Enabled } from "@/lib/v2/flag";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { sqlite } from "@/lib/db/client";
import { preferences } from "@/lib/db/personal";

export const dynamic = "force-dynamic";

type Journey = { id: string; name: string; status: string; goal: string | null };

export default function Home() {
  const now = new Date();
  const week = startOfWeek(now, { weekStartsOn: preferences().week_start });
  const activity = sqlite.prepare(`
    SELECT COUNT(*) AS sessions, COUNT(DISTINCT e.occurred_on) AS days,
           COALESCE(SUM(COALESCE(t.minutes, e.minutes, 0)), 0) AS minutes
    FROM log_entry e LEFT JOIN entry_time t ON t.entry_id = e.id
    WHERE e.kind = 'practice' AND e.occurred_on BETWEEN ? AND ?
  `).get(format(week, "yyyy-MM-dd"), format(now, "yyyy-MM-dd")) as { sessions: number; days: number; minutes: number };
  const journeys = sqlite.prepare(`
    SELECT j.id, j.name, j.status, (SELECT goal FROM charter WHERE journey_id = j.id ORDER BY version DESC LIMIT 1) AS goal
    FROM journey j ORDER BY j.last_seen_at DESC, j.name COLLATE NOCASE
  `).all() as Journey[];
  const drafts = sqlite.prepare("SELECT id,body FROM interview WHERE completed=0 ORDER BY rowid DESC").all() as {id:string;body:string}[];
  const active = journeys.filter(journey => journey.status === "active");
  const inactive = journeys.filter(journey => journey.status !== "active");

  function courseList(courses: Journey[]) {
    return courses.map(course => <Link className="course-row" key={course.id} href={`/j/${course.id}`}>
      <div><h3>{course.name}</h3>{course.goal && <p className="reading-small">{course.goal}</p>}</div>
      <ArrowUpRight size={22} strokeWidth={1.5} aria-hidden="true" />
    </Link>);
  }

  return <main className="learning-home">
    <header className="dashboard-header"><strong>Marginalia</strong>{v2Enabled()&&<Link className="text-link" href="/atlas">Open atlas</Link>}<Link className="text-link" href="/you">You</Link></header>
    <h1>Your learning</h1>
    <section aria-labelledby="week-heading"><h2 id="week-heading">This week</h2>
      <dl className="learning-stats">{[[activity.sessions, "Sessions"], [activity.minutes, "Minutes"], [activity.days, "Practice days"]].map(([value, label]) =>
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    {drafts.length>0 && <section><h2>Continue an interview</h2>{drafts.map(draft=>{const state=JSON.parse(draft.body);return <Link className="course-row" key={draft.id} href={`/new?draft=${draft.id}`}>{state.title || state.turns[0]?.answer || "New notebook"}<ArrowUpRight size={22}/></Link>;})}</section>}
    <section><div className="dashboard-header"><h2>Your journeys</h2><Link href={v2Enabled()?"/guide":"/new"} className="text-link"><Plus size={18} aria-hidden="true"/> New journey</Link></div>
      {active.length ? courseList(active) : <p className="reading">Start a journey for a course, a skill, or something you want to explore.</p>}
      {inactive.length > 0 && <details><summary>Paused and archived ({inactive.length})</summary>{courseList(inactive)}</details>}
    </section>
  </main>;
}
