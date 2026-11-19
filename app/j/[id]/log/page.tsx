import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { format } from "date-fns";
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
    sqlite.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,kind,occurred_on,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
      .run(entryId, id, note || "Rest day", minutes, rest ? "rest" : "practice", format(now, "yyyy-MM-dd"), now.toISOString());
    redirect(`/j/${id}?saved=1`);
  }
  return <main className="onboarding">
    <Link href={`/j/${id}`} className="back-link">← {journey.name}</Link>
    <h1>Log a session</h1>
    <form action={save}>
      <label>What did you do?<textarea name="note" required maxLength={8000} placeholder="What clicked, or where did you get stuck?" /></label>
      <label>Minutes (optional)<input name="minutes" type="number" min="0" max="600" /></label>
      <Button>Save entry</Button>
      <Button variant="ghost" name="kind" value="rest" formNoValidate>Log a rest day</Button>
    </form>
  </main>;
}
