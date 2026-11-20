"use client";
import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {acceptInline, acceptWeekInline, dismissInline, dismissWeekInline, finish, finishQuiz, mark, pickMinutes, redoWeek, retryInline, saveAnswer, withdrawInline} from "@/app/chat-actions";

export function MinutesCard({goal, note, active}: {goal: string; note: string; active: boolean}) {
  const [other, setOther] = useState(""), [pending, go] = useTransition();
  if (!active) return <p className="msg-note">I asked how long you had.</p>;
  const pickIt = (m: number) => go(async () => { await pickMinutes(goal, m, note); });
  return <div className="card"><p className="card-t">How long do you have?</p>
    <div className="row-chips">{[15, 30, 45, 60].map(m => <button key={m} className="chip chip--big" disabled={pending} onClick={() => pickIt(m)}>{m} min</button>)}
      <form className="inline" onSubmit={e => { e.preventDefault(); const n = Number(other); if (n >= 5 && n <= 240) pickIt(n); }}><input type="number" min={5} max={240} value={other} onChange={e => setOther(e.target.value)} placeholder="other" aria-label="Other number of minutes" /><button className="chip" disabled={pending || !other}>Go</button></form></div></div>;
}

type Block = {title: string; minutes: number; instructions: string; why: string; where: string; material: {id: string; title: string; creator: string; url: string; kind: string; pointer: string} | null};
export function PlanCard({goal, planId, title, why, blocks, initial, saved}: {goal: string; planId: string; title: string; why: string; blocks: Block[]; initial: Record<number, string>; saved: boolean}) {
  const [m, setM] = useState<Record<number, string>>(initial), [note, setNote] = useState(""), [open, setOpen] = useState(false), [ptr, setPtr] = useState<Record<string, string>>({}), [pending, go] = useTransition();
  const total = blocks.reduce((s, b) => s + b.minutes, 0), count = Object.keys(m).length;
  const starts = blocks.map((_, i) => blocks.slice(0, i).reduce((sum, b) => sum + b.minutes, 0));
  const set = (i: number, r: string) => { setM(x => ({...x, [i]: r})); void mark(planId, i, r); };
  const mats = [...new Map(blocks.filter(b => b.material).map(b => [b.material!.id, b.material!])).values()];
  return <div className="card plan"><div className="card-h"><p className="card-t">{title}</p><span className="muted small num">{total} min</span></div>{why && <p className="muted">{why}</p>}
    <ol className="plan-steps">{blocks.map((b, i) => <li key={i} className={m[i] ? "marked" : ""}>
      <span className="when num">{m[i] === "got" || m[i] === "part" ? "✓" : starts[i] + "′"}</span>
      <div><p className="step-t">{b.title}<span className="muted small num"> · {b.minutes} min</span></p><p>{b.instructions}</p>
        {b.material && <div className="mat"><span className="mat-t" title={b.material.title}>{b.material.url ? <a href={b.material.url} target="_blank" rel="noopener noreferrer">{b.material.title}</a> : b.material.title}</span>{b.where ? <b>{b.where}</b> : null}</div>}
        {!saved && <div className="mini-seg" role="group" aria-label={`How did ${b.title} go?`}>{([["got", "Got it"], ["part", "Partly"], ["not", "Not yet"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={m[i] === v} onClick={() => set(i, v)}>{l}</button>)}</div>}</div></li>)}</ol>
    {saved ? <p className="muted small">Session saved.</p> : <div className="plan-save">
      {open && <div className="stack">{mats.map(x => <label key={x.id} className="field"><span>Where did you get to in <i>{x.title}</i>?</span><input value={ptr[x.id] ?? ""} onChange={e => setPtr(p => ({...p, [x.id]: e.target.value}))} placeholder={x.pointer || "Chapter, page or lesson"} /></label>)}
        <label className="field"><span>Anything to add?</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Where you got stuck, what clicked." /></label></div>}
      <div className="actions"><button className="btn" disabled={pending || count === 0} onClick={() => go(async () => { await finish(goal, planId, note, ptr); })}>{pending ? "Saving…" : "Save this session"}</button>
        <button type="button" className="btn btn--text" onClick={() => setOpen(o => !o)}>{open ? "Hide details" : "Add a note"}</button>{count === 0 && <span className="muted small">Tap how each step went, then save.</span>}</div></div>}
  </div>;
}

/** Markdown source shown as a short plain-text preview. */
const plain = (md: string) => md.replace(/```[\s\S]*?```/g, " ").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "").replace(/[*_`~]+/g, "").replace(/\s+/g, " ").trim().slice(0, 400);

type Item = {id: string; kind: string; payload: any}; // eslint-disable-line @typescript-eslint/no-explicit-any
export function SuggestionCard({goal, items}: {goal: string; items: Item[]}) {
  const router = useRouter(), [gone, setGone] = useState<Set<string>>(new Set()), [pending, go] = useTransition();
  const live = items.filter(i => !gone.has(i.id)); if (!live.length) return <p className="msg-note">Suggestions handled.</p>;
  const hide = (id: string) => setGone(g => new Set(g).add(id));
  return <div className="stack">{live.map(s => <div className="card suggestion" key={s.id}>
    {s.kind === "agent_material" && <><p className="kicker">{s.payload.suggestion.kind} · {s.payload.suggestion.cost === "either" ? "free or paid" : s.payload.suggestion.cost}</p><p className="card-t">{s.payload.suggestion.title}{s.payload.suggestion.creator ? <span className="muted"> · {s.payload.suggestion.creator}</span> : null}</p>
      <p>{s.payload.suggestion.why}</p><p className={"check " + (s.payload.check.ok ? "ok" : "no")}>{s.payload.check.ok ? "✓ Link checked. " : "Not verified. "}{s.payload.suggestion.url && <a href={s.payload.suggestion.url} target="_blank" rel="noopener noreferrer">Open the page</a>}</p></>}
    {s.kind === "agent_action" && <><p className="kicker">{s.payload.type === "remember" ? "Worth remembering" : "Suggestion"}</p><p className="card-t">{s.payload.title}</p>{s.payload.body && <p className="muted clamp-3">{plain(String(s.payload.body))}</p>}</>}
    {s.kind === "agent_evidence" && <><p className="kicker">Evidence from your work</p><p className="card-t">{s.payload.skillName}</p><p className="quote">“{s.payload.quote}”</p></>}
    <div className="actions"><button className="btn btn--sm" disabled={pending} onClick={() => go(async () => { const r = await acceptInline(goal, s.id); hide(s.id); if (r?.go) router.push(r.go); })}>{s.kind === "agent_material" ? "Add to my materials" : s.kind === "agent_evidence" ? "Add as evidence" : s.payload.type === "revise_goal" ? "Start a revision" : s.payload.type === "plan_today" ? "Plan around this" : s.payload.type === "remember" ? "Remember this" : "Accept"}</button>
      <button className="btn btn--quiet btn--sm" disabled={pending} onClick={() => go(async () => { await dismissInline(goal, s.id); hide(s.id); })}>Dismiss</button></div></div>)}</div>;
}

type Day = {date: string; minutes: number; focus: string; why: string};
const dayName = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-GB", {weekday: "short"});
const dayNum = (d: string) => new Date(d + "T12:00").getDate();
/** A drafted week: look back, then one row per day. The learner accepts, asks for another draft, or dismisses it. */
export function WeekCard({goal, id, review, days, status, done, today}: {goal: string; id: string; review: string; days: Day[]; status: string; done: string[]; today: string}) {
  const [pending, go] = useTransition(), [redo, setRedo] = useState(false), [note, setNote] = useState("");
  const total = days.reduce((s, d) => s + d.minutes, 0), active = days.filter(d => d.minutes > 0).length;
  if (status === "dismissed" || status === "superseded") return <p className="msg-note">{status === "superseded" ? "An earlier week plan." : "Week plan dismissed."}</p>;
  return <div className="card week"><div className="card-h"><p className="card-t">{status === "accepted" ? "This week" : "A plan for your week"}</p><span className="muted small num">{active} {active === 1 ? "day" : "days"} · {total} min</span></div>
    {review && <p className="muted">{review}</p>}
    <ol className="week-days">{days.map(d => <li key={d.date} className={(d.date === today ? "today " : "") + (d.minutes === 0 ? "rest " : "") + (done.includes(d.date) ? "done" : "")}>
      <span className="wk-d num"><b>{dayName(d.date)}</b> {dayNum(d.date)}</span>
      <div><p className="step-t">{d.minutes === 0 ? "Rest" : d.focus}{d.minutes > 0 && <span className="muted small num"> · {d.minutes} min</span>}{done.includes(d.date) && <span className="tick" aria-label="done"> ✓</span>}</p>{d.why && d.minutes > 0 && <p>{d.why}</p>}</div></li>)}</ol>
    {status === "pending" && <>{redo && <label className="field"><span>What should change?</span><textarea rows={2} value={note} maxLength={600} onChange={e => setNote(e.target.value)} placeholder="I’m away Thursday, I want shorter sessions…" /></label>}
      <div className="actions">{redo ? <button className="btn" disabled={pending} onClick={() => go(async () => { await redoWeek(goal, id, note); })}>{pending ? "Asking…" : "Plan it again"}</button>
        : <button className="btn" disabled={pending} onClick={() => go(async () => { await acceptWeekInline(goal, id); })}>{pending ? "Saving…" : "Use this week"}</button>}
        <button type="button" className="btn btn--quiet" disabled={pending} onClick={() => setRedo(r => !r)}>{redo ? "Cancel" : "Change it"}</button>
        {!redo && <button type="button" className="btn btn--text" disabled={pending} onClick={() => go(async () => { await dismissWeekInline(goal, id); })}>Dismiss</button>}</div></>}
  </div>;
}

type Q = {q: string; a: string; skill: string; source: string};
/** Retrieval practice: try to answer, reveal, say honestly whether you had it. Finishing logs it as a session. */
export function QuizCard({goal, seq, title, questions, results, answers}: {goal: string; seq: number; title: string; questions: Q[]; results?: string[]; answers: React.ReactNode[]}) {
  const [i, setI] = useState(0), [shown, setShown] = useState(false), [r, setR] = useState<("got" | "not")[]>([]), [pending, go] = useTransition();
  if (results) { const got = results.filter(x => x === "got").length;
    return <div className="card quiz"><div className="card-h"><p className="card-t">{title}</p><span className="muted small num">{got}/{questions.length} recalled</span></div>
      <ol className="quiz-done">{questions.map((q, k) => <li key={k} className={results[k]}><span aria-hidden="true">{results[k] === "got" ? "✓" : "○"}</span><details><summary>{q.q}</summary><div className="md">{answers[k]}</div></details></li>)}</ol>
      <p className="muted small">Saved as a session. What you missed comes back in later plans.</p></div>; }
  const q = questions[i], last = i === questions.length - 1;
  const answer = (v: "got" | "not") => { const next = [...r, v]; setR(next); setShown(false); if (last) go(async () => { await finishQuiz(goal, seq, next); }); else setI(i + 1); };
  return <div className="card quiz"><div className="card-h"><p className="card-t">{title}</p><span className="muted small num">{Math.min(i + 1, questions.length)} of {questions.length}</span></div>
    <div className="quiz-bar" aria-hidden="true">{questions.map((_, k) => <i key={k} className={k < r.length ? r[k] : k === i ? "on" : ""} />)}</div>
    <p className="quiz-q">{q.q}</p>
    {shown ? <><div className="quiz-a md">{answers[i]}</div>{q.source && <p className="muted small">From {q.source}</p>}
      <div className="actions"><button className="btn" disabled={pending} onClick={() => answer("got")}>I had it</button><button className="btn btn--quiet" disabled={pending} onClick={() => answer("not")}>Not yet</button></div></>
      : <><p className="muted small">Answer in your head or out loud first, then check.</p><div className="actions"><button className="btn" onClick={() => setShown(true)}>Show the answer</button></div></>}
  </div>;
}

/** Keeps a useful answer in the notebook. */
export function SaveAnswer({goal, seq, saved}: {goal: string; seq: number; saved?: string}) {
  const [doc, setDoc] = useState(saved), [pending, go] = useTransition();
  if (doc) return <p className="msg-act"><a className="link" href={`/notebook/d/${doc}`}>Saved to notes · Open</a></p>;
  return <p className="msg-act"><button type="button" className="link-btn" disabled={pending} onClick={() => go(async () => { const r = await saveAnswer(goal, seq); if (r.doc) setDoc(r.doc); })}>{pending ? "Saving…" : "Save to notes"}</button></p>;
}

/** Shown under a failed reply: runs the same request again. */
export function Retry({goal, seq}: {goal: string; seq: number}) {
  const [pending, go] = useTransition(), [gone, setGone] = useState(false);
  if (gone) return null;
  return <p className="msg-act"><button type="button" className="btn btn--sm" disabled={pending} onClick={() => go(async () => { await retryInline(goal, seq); setGone(true); })}>{pending ? "Starting…" : "Try again"}</button></p>;
}

/** Under a message typed while the Guide was busy: it goes as soon as the Guide is free, unless taken back. */
export function Waiting({goal, seq}: {goal: string; seq: number}) {
  const [pending, go] = useTransition();
  return <p className="msg-state">Sends when the Guide is free · <button type="button" className="link-btn" disabled={pending} onClick={() => go(() => withdrawInline(goal, seq))}>Don’t send</button></p>;
}
