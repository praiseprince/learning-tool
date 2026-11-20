import {sqlite} from "@/lib/db/client";
import {preferences} from "@/lib/db/personal";
import {DeleteDataForm} from "@/components/features/delete-data";
import {PrefsForm} from "@/components/features/prefs-form";
import {ReminderControl} from "@/components/features/practice-reminder";
import {ReviewSheet} from "@/components/features/review-sheet";
import {AppShell} from "@/components/v2/shell";
import {Head} from "@/components/v2/ui";
import Link from "next/link";
import {chooseAi, editFact} from "./actions";
import {aiModel, aiProvider, installed, PROVIDERS, PROVIDER_NAME} from "@/lib/ai/provider";
import {firecrawlBin, firecrawlUp} from "@/lib/agent/firecrawl";
import {ensureAgent} from "@/lib/agent/jobs";
import {CONTINUES, WARM_MS} from "@/lib/agent/session";

export default async function Settings({searchParams}: PageProps<"/you">) {
  const prefs = preferences(), query = await searchParams;
  const facts = sqlite.prepare("SELECT f.id,f.text FROM profile_fact f WHERE f.status='active' ORDER BY f.created_at DESC").all() as {id: string; text: string}[];
  const kb = sqlite.prepare("SELECT (SELECT COUNT(*) FROM document WHERE status='active') AS notes,(SELECT COUNT(*) FROM log_entry) AS sessions,(SELECT COUNT(*) FROM journey WHERE status='active') AS goals").get() as {notes: number; sessions: number; goals: number};
  ensureAgent();
  const fc = await firecrawlUp(), k = (x: number) => x >= 10_000 ? `${Math.round(x / 1000)}k` : x.toLocaleString();
  const use = sqlite.prepare("SELECT COUNT(*) turns,AVG(json_extract(usage_json,'$.input')) input,SUM(json_extract(usage_json,'$.cached'))*1.0/NULLIF(SUM(json_extract(usage_json,'$.input')),0) cached,SUM(json_extract(usage_json,'$.resumed')) resumed FROM (SELECT usage_json FROM agent_job WHERE usage_json IS NOT NULL ORDER BY created_at DESC LIMIT 30)").get() as {turns: number; input: number | null; cached: number | null; resumed: number | null};
  const ai = aiProvider(), n = (k: number, one: string, many = one + "s") => `${k.toLocaleString()} ${k === 1 ? one : many}`;
  return <AppShell active="Settings"><div className="page page--read settings">
    <Head title="Settings" />
    <section><h2>Preferences</h2><PrefsForm prefs={prefs} reminder={<ReminderControl />} /></section>
    <section><h2>Guide</h2><div className="rows-s">
      <div className="srow"><div><b>AI</b><p>{ai === "stub" ? "Offline: answers are placeholders. Unset AI_PROVIDER=stub to use Codex or Claude Code." : `Runs through ${PROVIDER_NAME[ai]} on this computer${aiModel(ai) ? ` (${aiModel(ai)})` : ""}. It reads what it needs from your goals, notes, map and chat, and every change it suggests waits for you.`}</p></div>
        {ai === "stub" ? <span className="status off">Offline</span> :
          <form action={chooseAi} className="seg-s" role="group" aria-label="AI">{PROVIDERS.map(p => <button key={p} name="ai" value={p} aria-pressed={ai === p} disabled={!installed(p)} title={installed(p) ? undefined : `${PROVIDER_NAME[p]} is not installed`}>{PROVIDER_NAME[p]}</button>)}</form>}</div>
      {ai !== "stub" && <div className="srow"><div><b>Conversation</b><p>{CONTINUES[ai] ? `Continues while you are active, so the Guide does not re-read what it already has. After ${WARM_MS / 60_000} minutes away, or once it gets long, the next message starts fresh from your knowledge base. “Start fresh” under a reply does it any time.` : `Each message starts fresh with a short brief of where you are, and opens only what else it needs from your knowledge base (with ${PROVIDER_NAME[ai]}, continuing a session costs more than starting over).`} Nothing is compacted or lost.{use.turns ? ` Last ${n(use.turns, "turn")}: about ${k(Math.round(use.input ?? 0))} tokens in per turn, ${Math.round((use.cached ?? 0) * 100)}% from cache, ${use.resumed ?? 0} continued.` : ""}</p></div></div>}
      <div className="srow"><div><b>Web reading</b><p>{fc ? "Firecrawl Local runs on this computer, with no account or key: the Guide reads whole pages with JavaScript rendered, and suggested links are checked the same way. Nothing is sent to Firecrawl." : firecrawlBin() ? "Firecrawl Local is installed but did not start. The Guide uses its built-in web search instead." : "Firecrawl Local is not installed (it needs Rust: run npm run setup:firecrawl). The Guide uses its built-in web search instead."}</p></div><span className={"status " + (fc ? "on" : "off")}>{fc ? "Connected" : "Off"}</span></div>
      <div className="srow"><div><b>Knowledge base</b><p>What the Guide draws on: {n(kb.notes, "note")}, {n(kb.sessions, "session")} across {n(kb.goals, "goal")}.</p></div><Link className="btn btn--quiet btn--sm" href="/notebook">Open notes</Link></div>
    </div></section>
    <section id="noticed"><h2>What I have noticed <span className="count">{facts.length || ""}</span></h2><p className="hint">The Guide reads these in every goal. It adds one only when you tap “Remember this” in the chat. Edit or delete anything that is wrong.</p>
      {facts.length === 0 ? <p className="muted">Nothing yet. I note things as you log sessions.</p> :
        <ul className="rows-s facts">{facts.map(f => <li key={f.id}><details><summary><span>{f.text}</span><i>Edit</i></summary>
          <form action={editFact.bind(null, f.id)} className="form"><textarea name="text" defaultValue={f.text} rows={2} maxLength={500} aria-label="Fact" /><div className="actions"><button className="btn btn--sm" name="intent" value="save">Save</button><button className="btn btn--quiet btn--sm" name="intent" value="delete">Delete</button></div></form></details></li>)}</ul>}</section>
    <section><h2>Your data</h2>
      <div className="rows-s">
        <div className="srow"><div><b>Export</b><p>Everything you have written, as a file. The .zip also has every file you shared and every file the Guide made.</p></div><div className="actions"><a className="btn btn--quiet btn--sm" href="/api/export?format=zip">Everything (.zip)</a><a className="btn btn--quiet btn--sm" href="/api/export">JSON</a><a className="btn btn--quiet btn--sm" href="/api/export?format=markdown">Markdown</a></div></div>
        <div className="srow danger"><div><b>Reset everything</b><p>Deletes all goals, sessions, notes, chats and shared files. A backup of all of it is saved first.</p></div><Link className="btn btn--danger btn--sm" href="/you?delete=1">Reset…</Link></div>
      </div></section>
    {query.delete === "1" && <ReviewSheet home="/you"><h2>Reset your whole profile?</h2><p className="prose" style={{marginBottom: 16}}>This removes every goal, session, note, chat and preference, and the agent’s workspace files. A backup of the database is saved in the <code>data</code> folder first. Export first if you also want a readable copy.</p><DeleteDataForm /></ReviewSheet>}
  </div></AppShell>;
}
