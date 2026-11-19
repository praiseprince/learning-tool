import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { sqlite } from "@/lib/db/client";
import { EntryReview } from "@/components/features/entry-review";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJourneyView } from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { WeekLines } from "@/components/marks/week-lines";
import { Mark } from "@/components/marks/mark";

export const dynamic = "force-dynamic";

export default async function Home({ params, searchParams }: PageProps<"/j/[id]">) { const { id } = await params; const view = await getJourneyView(id); if (!view) notFound(); const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const today = format(now, "yyyy-MM-dd");
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const key = format(date, "yyyy-MM-dd");
    const entries = view.entries.filter(entry => entry.occurredOn === key);
    const practice = entries.filter(entry => entry.kind === "practice");
    return { label: format(date, "EEE"), minutes: practice.reduce((total, entry) => total + (entry.minutes ?? 0), 0),
      rest: !practice.length && entries.some(entry => entry.kind === "rest"), today: key === today, future: key > today };
  });
  const sessions = view.entries.filter(entry => entry.kind === "practice");
  const totalMinutes = sessions.reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
  const practiceDays = new Set(sessions.map(entry => entry.occurredOn)).size;
  const query = await searchParams;
  const saved = query.saved === "1";
  const entry = view.entries.find(row => row.id === query.entry && row.kind !== "rest");
  return <main className="journey" style={{ "--hue": view.journey.hue } as React.CSSProperties}><header className="topbar"><Link href="/new" className="journey-pill"><i />{view.journey.name}</Link><span>Day {Math.max(1, differenceInCalendarDays(now, parseISO(view.journey.startDate)) + 1)}</span></header>{saved && <p role="status">Entry saved.</p>}{entry && <EntryReview entry={entry.id} names={Object.fromEntries(view.skills.map(skill=>[skill.id,skill.name]))} resolution={(sqlite.prepare("SELECT status FROM proposal WHERE source_ref=?").get(entry.id) as {status:string}|undefined)?.status} />}<section className="home-hero"><h1>Start small, stay close.</h1><p className="reading">A first session gives you somewhere gentle to begin.</p><div className="session-preview"><p><span>0:00</span> Settle in <small>5 min</small></p><p><span>0:05</span> Work one small piece <small>15 min</small></p><p><span>0:20</span> Notice what changed <small>10 min</small></p></div><div className="cluster"><Chip>15</Chip><Chip selected>30</Chip><Chip>60</Chip><Chip>Other</Chip></div><Button>Start session</Button></section><section><h2>This week</h2><WeekLines days={days} /><Link className="text-link" href={`/j/${id}/log`}>Log a session</Link></section><section><h2>Practice to date</h2><p className="reading-small">{sessions.length} {sessions.length === 1 ? "session" : "sessions"} across {practiceDays} practice {practiceDays === 1 ? "day" : "days"} · {totalMinutes} recorded minutes</p></section><section><h2>Where you are</h2><p className="reading"><Mark deep>{view.state?.summary || view.charter?.startingPoint || "Starting from where you are today."}</Mark></p><small>Updated today</small></section><section><h2>Skills</h2><p className="reading-small">{view.skills.length} skills ready to take shape.</p><Link className="text-link" href={`/j/${id}/skills`}>See skills</Link></section></main>; }
