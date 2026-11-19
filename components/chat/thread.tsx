import Link from "next/link";
import {sqlite} from "@/lib/db/client";
import {findPlan} from "@/lib/db/plans";
import {events, marks, state} from "@/lib/chat/events";
import {getJob} from "@/lib/agent/jobs";
import {materials} from "@/lib/v2/materials";
import {Markdown} from "@/components/v2/markdown";
import {JobView} from "@/components/v2/job-view";
import {EntryReview} from "@/components/features/entry-review";
import {cancelJobInline} from "@/app/chat-actions";
import {Live} from "./live";
import {MinutesCard, PlanCard, QuizCard, SaveAnswer, SuggestionCard, WeekCard} from "./cards";
import {doneDays, weekById} from "@/lib/agent/week";
import {nextDays} from "@/lib/agent/tasks";

function LogCard({goal, entry, minutes}: {goal: string; entry: string; minutes: number | null}) {
  const row = sqlite.prepare("SELECT e.id,e.minutes,p.status FROM log_entry e LEFT JOIN proposal p ON p.source_ref=e.id AND p.kind='extraction' WHERE e.journey_id=? AND e.id=?").get(goal, entry) as {id: string; minutes: number | null; status?: string} | undefined;
  if (!row) return <p className="msg-note">Session saved.</p>;
  const applied = row.status === "applied";
  const changes = applied ? sqlite.prepare("SELECT s.name,v.level_after AS level,v.delta FROM skill_event v JOIN skill s ON s.id=v.skill_id WHERE v.entry_id=? AND v.delta!=0 ORDER BY v.rowid").all(entry) as {name: string; level: number; delta: number}[] : [];
  const summary = applied ? sqlite.prepare("SELECT summary FROM state_snapshot WHERE source_entry_id=?").get(entry) as {summary: string} | undefined : undefined;
  const names = Object.fromEntries((sqlite.prepare("SELECT id,name FROM skill WHERE journey_id=?").all(goal) as {id: string; name: string}[]).map(s => [s.id, s.name]));
  return <div className="card log"><p className="card-t">Session saved</p><EntryReview key={entry} entry={entry} changes={changes} minutes={row.minutes ?? minutes ?? 0} summary={summary?.summary} resolution={row.status} names={names} /></div>;
}

type Ev = ReturnType<typeof events>[number];
/** A suggestion is only shown when its stored payload has the fields its card needs. */
const showable = (kind: string, p: any) => kind === "agent_material" ? !!p?.suggestion?.title : kind === "agent_action" ? !!p?.title : kind === "agent_evidence" ? !!p?.quote && !!p?.skillName : false; // eslint-disable-line @typescript-eslint/no-explicit-any
const parse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

/** The conversation: every message and card for one goal, oldest first. One broken message never takes the thread down with it. */
export function Thread({goal}: {goal: string}) {
  const evs = events(goal), st = state(goal), last = evs.at(-1)?.seq ?? 0, mats = materials(goal), byId = Object.fromEntries(mats.map(m => [m.id, m]));
  const one = (e: Ev) => {
    if (e.kind === "user") return <div key={e.seq} className="msg user"><p>{String(e.payload.text ?? "")}</p>{e.payload.files?.length ? <ul className="files" aria-label="Attached files">{(e.payload.files as string[]).map((f, i) => <li key={i} title={f}>{f}</li>)}</ul> : null}</div>;
    if (e.kind === "guide") return <div key={e.seq} className={"msg guide" + (e.payload.tone === "error" ? " error" : "")}><div className="md"><Markdown text={String(e.payload.markdown ?? "")} /></div>
      {e.payload.tone !== "error" && String(e.payload.markdown ?? "").length > 280 && <SaveAnswer goal={goal} seq={e.seq} saved={e.payload.saved} />}
      {e.payload.sources?.length ? <details className="sources"><summary>Based on {e.payload.sources.length} {e.payload.sources.length === 1 ? "thing" : "things"} from your history</summary><ul>{e.payload.sources.map((s: {kind: string; ref: string; quote: string}, i: number) => <li key={i}><span className="muted">{s.ref}</span>{s.quote ? <> “{s.quote}”</> : null}</li>)}</ul></details> : null}</div>;
    if (e.kind === "minutes") return <div key={e.seq} className="msg guide"><MinutesCard goal={goal} note={e.payload.note ?? ""} active={e.seq === last} /></div>;
    if (e.kind === "working") return <div key={e.seq} className="msg guide"><p className="working"><i aria-hidden="true" />{e.payload.label}… this takes about 20 seconds.</p></div>;
    if (e.kind === "job") { const j = getJob(e.payload.job); if (!j) return null; const searches = j.steps.filter(s => s.kind === "search").length;
      return <div key={e.seq} className="msg guide">{j.status === "running" ? <JobView job={e.payload.job} cancel={cancelJobInline.bind(null, goal, e.payload.job)} /> : <p className="msg-note">{`Worked on it for ${Math.max(1, Math.round((new Date(j.finished_at ?? j.created_at).getTime() - new Date(j.created_at).getTime()) / 1000))}s${searches ? `, ${searches} ${searches === 1 ? "search" : "searches"}` : ""}.`}</p>}</div>; }
    if (e.kind === "plan") { const p = findPlan(goal, e.payload.plan); if (!p) return <p key={e.seq} className="msg-note">This plan could not be shown.</p>;
      return <div key={e.seq} className="msg guide wide"><PlanCard goal={goal} planId={p.id} title={p.title} why={p.why} saved={p.status === "finished"} initial={marks(p.id)}
        blocks={p.blocks.map(b => { const m = b.material_id ? byId[b.material_id] : undefined; return {title: b.title, minutes: b.minutes, instructions: b.instructions, why: b.why, where: b.where ?? "", material: m ? {id: m.id, title: m.title, creator: m.creator, url: m.url, kind: m.kind, pointer: m.pointer} : null}; })} /></div>; }
    if (e.kind === "log") return <div key={e.seq} className="msg guide wide"><LogCard goal={goal} entry={e.payload.entry} minutes={e.payload.minutes ?? null} /></div>;
    if (e.kind === "suggestions") { const ids: string[] = Array.isArray(e.payload.ids) ? e.payload.ids : [];
      const rows = ids.length ? sqlite.prepare(`SELECT id,kind,diff_json FROM proposal WHERE id IN (${ids.map(() => "?").join(",")}) AND status='pending'`).all(...ids) as {id: string; kind: string; diff_json: string}[] : [];
      const items = rows.map(r => ({id: r.id, kind: r.kind, payload: parse(r.diff_json)})).filter(r => showable(r.kind, r.payload));
      return <div key={e.seq} className="msg guide wide">{items.length ? <SuggestionCard goal={goal} items={items} /> : <p className="msg-note">Suggestions handled.</p>}</div>; }
    if (e.kind === "week") { const w = weekById(goal, e.payload.week); if (!w) return <p key={e.seq} className="msg-note">This week plan could not be shown.</p>;
      return <div key={e.seq} className="msg guide wide"><WeekCard goal={goal} id={w.id} review={w.review} days={w.days} status={w.status} done={[...doneDays(goal, w.days.map(d => d.date))]} today={nextDays(1)[0]} /></div>; }
    if (e.kind === "quiz") { const qs = Array.isArray(e.payload.questions) ? (e.payload.questions as {q: string; a: string; skill: string; source: string}[]).filter(q => q?.q) : []; if (!qs.length) return <p key={e.seq} className="msg-note">This quiz could not be shown.</p>;
      return <div key={e.seq} className="msg guide wide"><QuizCard goal={goal} seq={e.seq} title={String(e.payload.title ?? "Quiz")} questions={qs} results={e.payload.results} answers={qs.map((q, i) => <Markdown key={i} text={String(q.a ?? "")} />)} /></div>; }
    if (e.kind === "note") return <div key={e.seq} className="msg guide"><div className="card"><p className="card-t">{String(e.payload.title ?? "A new note")}</p><p className="actions">{e.payload.doc && <Link className="link" href={`/notebook/d/${e.payload.doc}`}>Open the note</Link>}{(e.payload.files ?? []).map((f: {title: string; href: string}, i: number) => <a key={i} className="link file" href={f.href} title={f.title}>{f.title}</a>)}</p></div></div>;
    return null;
  };
  return <div className="thread" role="log" aria-live="polite" aria-label="Conversation with the Guide">
    {evs.length === 0 && <div className="hello"><h2>What would you like to do?</h2>
      <p>I can plan today or your whole week, quiz you on your notes, find materials, make practice sheets, review work you attach, and answer questions from everything you’ve written.</p>
      <ul><li>“I have 30 minutes and I’m a bit tired”</li><li>“Plan my week, I’m away on Thursday”</li><li>“I practised for 20 minutes and the second half went badly”</li></ul></div>}
    {evs.map(e => { try { return one(e); } catch { return <p key={e.seq} className="msg-note">This message could not be shown.</p>; } })}
    <div id="thread-end" />
    <Live goal={goal} seq={st.seq} busy={st.busy} />
  </div>;
}
