import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { format, parseISO, isValid } from "date-fns";
import { getJourney } from "@/lib/db/queries";
import { sqlite } from "@/lib/db/client";
import { Button } from "@/components/ui/button";

export default async function Log({ params }: PageProps<"/j/[id]/log">) {
  const { id } = await params;
  const journey = await getJourney(id);
  if (!journey) notFound();
  const entryId = randomUUID();
  async function save(data: FormData) {
    "use server";
    const note = String(data.get("note") ?? "").trim();
    const rest = data.get("kind") === "rest";
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
    sqlite.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,energy,kind,occurred_on,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
      .run(entryId, id, note || "Rest day", minutes, energy || null, rest ? "rest" : "practice", date, now.toISOString());
    redirect(rest ? `/j/${id}?saved=1` : `/j/${id}?saved=1&entry=${entryId}`);
  }
  return <main className="onboarding">
    <Link href={`/j/${id}`} className="back-link">← {journey.name}</Link>
    <h1>Log a session</h1>
    <form action={save}>
      <label>Session date<input type="date" name="date" required defaultValue={format(new Date(),"yyyy-MM-dd")} max={format(new Date(),"yyyy-MM-dd")} /></label>
      <label>What did you do?<textarea name="note" required maxLength={8000} placeholder="What clicked, or where did you get stuck?" /></label>
      <label>Minutes (optional)<input name="minutes" type="number" min="0" max="600" /></label>
      <label>Energy<select name="energy" defaultValue=""><option value="">Unspecified</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <Button>Save entry</Button>
      <Button variant="ghost" name="kind" value="rest" formNoValidate>Log a rest day</Button>
    </form>
  </main>;
}
