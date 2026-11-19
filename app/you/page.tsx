import {sqlite} from "@/lib/db/client";
import {preferences} from "@/lib/db/personal";
import {DeleteDataForm} from "@/components/features/delete-data";
import {PrefsForm} from "@/components/features/prefs-form";
import {ReminderControl} from "@/components/features/practice-reminder";
import {ReviewSheet} from "@/components/features/review-sheet";
import {AppShell} from "@/components/v2/shell";
import {Head} from "@/components/v2/ui";
import Link from "next/link";
import {editFact} from "./actions";

export default async function Settings({searchParams}: PageProps<"/you">) {
  const prefs = preferences(), query = await searchParams;
  const facts = sqlite.prepare("SELECT f.id,f.text FROM profile_fact f WHERE f.status='active' ORDER BY f.created_at DESC").all() as {id: string; text: string}[];
  const kb = sqlite.prepare("SELECT (SELECT COUNT(*) FROM document WHERE status='active') AS notes,(SELECT COUNT(*) FROM log_entry) AS sessions,(SELECT COUNT(*) FROM journey WHERE status='active') AS goals").get() as {notes: number; sessions: number; goals: number};
  const live = process.env.AI_PROVIDER !== "stub", n = (k: number, one: string, many = one + "s") => `${k.toLocaleString()} ${k === 1 ? one : many}`;
  return <AppShell active="Settings"><div className="page page--read settings">
    <Head title="Settings" />
    <section><h2>Preferences</h2><PrefsForm prefs={prefs} reminder={<ReminderControl />} /></section>
    <section><h2>Guide</h2><div className="rows-s">
      <div className="srow"><div><b>AI</b><p>{live ? "Runs through Codex on this computer. It reads a copy of your goal, notes and sessions, and every change it suggests waits for you." : "Offline: answers are placeholders. Set AI_PROVIDER to use Codex."}</p></div><span className={"status " + (live ? "on" : "off")}>{live ? (process.env.AI_MODEL || "Codex") : "Offline"}</span></div>
      <div className="srow"><div><b>Knowledge base</b><p>What the Guide draws on: {n(kb.notes, "note")}, {n(kb.sessions, "session")} across {n(kb.goals, "goal")}.</p></div><Link className="btn btn--quiet btn--sm" href="/notebook">Open notes</Link></div>
    </div></section>
    <section><h2>What I have noticed <span className="count">{facts.length || ""}</span></h2><p className="hint">The Guide uses only what is listed here. Edit or delete anything that is wrong.</p>
      {facts.length === 0 ? <p className="muted">Nothing yet. I note things as you log sessions.</p> :
        <ul className="rows-s facts">{facts.map(f => <li key={f.id}><details><summary><span>{f.text}</span><i>Edit</i></summary>
          <form action={editFact.bind(null, f.id)} className="form"><textarea name="text" defaultValue={f.text} rows={2} maxLength={500} aria-label="Fact" /><div className="actions"><button className="btn btn--sm" name="intent" value="save">Save</button><button className="btn btn--quiet btn--sm" name="intent" value="delete">Delete</button></div></form></details></li>)}</ul>}</section>
    <section><h2>Your data</h2>
      <div className="rows-s">
        <div className="srow"><div><b>Export</b><p>Everything you have written, as a file.</p></div><div className="actions"><a className="btn btn--quiet btn--sm" href="/api/export">JSON</a><a className="btn btn--quiet btn--sm" href="/api/export?format=markdown">Markdown</a></div></div>
        <div className="srow danger"><div><b>Reset everything</b><p>Deletes all goals, sessions, notes and chats. A backup is saved first.</p></div><Link className="btn btn--danger btn--sm" href="/you?delete=1">Reset…</Link></div>
      </div></section>
    {query.delete === "1" && <ReviewSheet home="/you"><h2>Reset your whole profile?</h2><p className="prose" style={{marginBottom: 16}}>This removes every goal, session, note, chat and preference, and the agent’s workspace files. A backup of the database is saved in the <code>data</code> folder first. Export first if you also want a readable copy.</p><DeleteDataForm /></ReviewSheet>}
  </div></AppShell>;
}
