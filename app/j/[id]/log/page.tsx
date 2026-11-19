import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { format, parseISO, isValid } from "date-fns";
import { findPlan } from "@/lib/db/plans";
import { EntryReview } from "@/components/features/entry-review";
import { ReviewSheet } from "@/components/features/review-sheet";
import { getJourney } from "@/lib/db/queries";
import { sqlite } from "@/lib/db/client";
import {LogComposer} from "@/components/features/log-composer";

export default async function Log({ params, searchParams }: PageProps<"/j/[id]/log">) {
  const { id } = await params;
  const journey = await getJourney(id);
  if (!journey) notFound();
  const query = await searchParams;
  const plan=findPlan(id,query.plan);
  const reviewId = typeof query.entry === "string" ? query.entry : "";
  const review = sqlite.prepare("SELECT e.id,p.status FROM log_entry e LEFT JOIN proposal p ON p.source_ref=e.id AND p.kind='extraction' WHERE e.journey_id=? AND e.id=? AND e.kind!='rest'").get(id,reviewId) as {id:string;status?:string}|undefined;
  const changes = review?.status === "applied" ? sqlite.prepare(`SELECT s.name,v.level_after AS level,v.delta FROM skill_event v JOIN skill s ON s.id=v.skill_id WHERE v.entry_id=? AND v.delta!=0 ORDER BY v.rowid`).all(review.id) as {name:string;level:number;delta:number}[] : [];
  const summary = review?.status === "applied" ? sqlite.prepare("SELECT summary FROM state_snapshot WHERE source_entry_id=?").get(review.id) as {summary:string}|undefined : undefined;
  const activity = review?.status === "applied" ? sqlite.prepare(`SELECT SUM(COALESCE(t.minutes,e.minutes,0)) AS minutes FROM log_entry e LEFT JOIN entry_time t ON t.entry_id=e.id WHERE e.journey_id=? AND e.kind='practice' AND e.occurred_on=?`).get(id,format(new Date(),"yyyy-MM-dd")) as {minutes:number|null} : undefined;
  const skills = review ? sqlite.prepare("SELECT id,name FROM skill WHERE journey_id=?").all(id) as {id:string;name:string}[] : [];
  const entryId = randomUUID();
  async function save(data: FormData) {
    "use server";
    const note = String(data.get("note") ?? "").trim();
    const rest = data.get("kind") === "rest" || /^rest day(?:$|[.,!])/i.test(note);
    const duration = String(data.get("minutes") ?? "").trim();
    const minutes = rest || !duration ? null : Number(duration);
    if (!rest && !note) redirect(`/j/${id}/log?empty=1`);
    if (note.length > 8000 || (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 600))) throw Error("Check your entry and minutes.");
    if (!(await getJourney(id))) notFound();
    const now = new Date();
    const date = String(data.get("date") ?? "");
    if (!isValid(parseISO(date)) || format(parseISO(date), "yyyy-MM-dd") !== date || date > format(now,"yyyy-MM-dd")) throw Error("Choose today or an earlier date.");
    const energy = data.get("energy");
    if (energy && !["low","medium","high"].includes(String(energy))) throw Error("Unknown energy.");
    sqlite.transaction(() => {
      sqlite.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,energy,kind,occurred_on,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
      .run(entryId, id, note || "Rest day", minutes, energy || null, rest ? "rest" : "practice", date, now.toISOString());
      if (!rest) sqlite.prepare("INSERT OR IGNORE INTO log_extraction VALUES (?,'queued',NULL,?)").run(entryId,now.toISOString());
    })();
    redirect(rest ? `/j/${id}?saved=1` : `/j/${id}/log?entry=${entryId}`);
  }
  return <main className="onboarding">
    <Link href={`/j/${id}`} className="back-link">← {journey.name}</Link>
    <h1>Log a session</h1>
    <LogComposer save={save} date={format(new Date(),"yyyy-MM-dd")} text={plan?.blocks.map(block=>block.title).join(", ")??""} minutes={plan?.blocks.reduce((sum,block)=>sum+block.minutes,0)}/>
    {review && <ReviewSheet home={`/j/${id}`}><EntryReview key={review.id} entry={review.id} changes={changes} minutes={activity?.minutes ?? 0} summary={summary?.summary} resolution={review.status} names={Object.fromEntries(skills.map(skill=>[skill.id,skill.name]))}/></ReviewSheet>}
  </main>;
}
