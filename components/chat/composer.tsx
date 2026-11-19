"use client";
import {useEffect, useRef, useState, useTransition} from "react";
import {quick, send} from "@/app/chat-actions";

const FILL = "marginalia:fill";

/** An example sentence that drops itself into the message box, ready to edit and send. */
export function Example({text}: {text: string}) {
  return <button type="button" className="example" onClick={() => window.dispatchEvent(new CustomEvent(FILL, {detail: text}))}>“{text}”</button>;
}

/** The one message box. Enter sends, Shift+Enter adds a line, drop or attach files for feedback. */
export function Composer({goal, busy}: {goal: string; busy: boolean}) {
  const [text, setText] = useState(""), [files, setFiles] = useState<File[]>([]), [err, setErr] = useState(""), [over, setOver] = useState(false), [pending, go] = useTransition();
  const ta = useRef<HTMLTextAreaElement>(null), pick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fill = (e: Event) => { const el = ta.current; setText(String((e as CustomEvent).detail ?? "")); if (el) requestAnimationFrame(() => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 180) + "px"; }); };
    window.addEventListener(FILL, fill); return () => window.removeEventListener(FILL, fill);
  }, []);
  const submit = () => {
    if (pending || (!text.trim() && !files.length)) return;
    const fd = new FormData(); fd.set("text", text); files.forEach(f => fd.append("files", f));
    go(async () => { const r = await send(goal, fd); if (r?.error) { setErr(r.error); return; } setText(""); setFiles([]); setErr(""); ta.current?.focus(); });
  };
  return <form className={"composer" + (over ? " over" : "")} onSubmit={e => { e.preventDefault(); submit(); }}
    onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); setFiles(f => [...f, ...Array.from(e.dataTransfer.files)].slice(0, 4)); }}>
    {!text && <div className="chips-row" role="group" aria-label="Quick actions">
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "plan")}>Plan today</button>
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "week")}>Plan my week</button>
      <button type="button" className="chip" disabled={pending} onClick={() => { setText(t => t || "I practised "); ta.current?.focus(); }}>I practised…</button>
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "quiz")}>Quiz me</button>
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "research")}>Find materials</button>
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "practice")}>Practice sheet</button>
    </div>}
    {files.length > 0 && <ul className="attached">{files.map((f, i) => <li key={i}>{f.name}<button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}>×</button></li>)}</ul>}
    <div className="box">
      <textarea ref={ta} value={text} rows={1} placeholder={busy ? "The Guide is working…" : "Message your Guide"} aria-label="Message the Guide"
        onChange={e => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px"; }}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
      <button type="button" className="attach" aria-label="Attach work for feedback" title="Attach work for feedback" onClick={() => pick.current?.click()}><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M13.5 7.5l-5.4 5.4a3.2 3.2 0 01-4.5-4.5l5.6-5.6a2.1 2.1 0 013 3L6.6 11.4a1 1 0 01-1.5-1.5l5-5" /></svg></button>
      <button className="send" type="submit" disabled={pending || (!text.trim() && !files.length)} aria-label="Send">{pending ? "…" : "Send"}</button>
    </div>
    {err && <p className="form-note" role="alert">{err}</p>}
    <input ref={pick} type="file" hidden multiple accept="image/*,.pdf,.txt,.md" onChange={e => { setFiles(f => [...f, ...Array.from(e.target.files ?? [])].slice(0, 4)); e.target.value = ""; }} />
  </form>;
}
