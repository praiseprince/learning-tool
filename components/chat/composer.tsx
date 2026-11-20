"use client";
/* eslint-disable @next/next/no-img-element -- local previews of files not sent yet */
import {useEffect, useRef, useState, useTransition} from "react";
import {quick, send} from "@/app/chat-actions";
import {ACCEPT_ATTR, MAX_FILES, kindOf, refuse, sizeLabel} from "@/lib/chat/file-types";
import {extname} from "@/lib/chat/ext";

const FILL = "marginalia:fill";

/** An example sentence that drops itself into the message box, ready to edit and send. */
export function Example({text}: {text: string}) {
  return <button type="button" className="example" onClick={() => window.dispatchEvent(new CustomEvent(FILL, {detail: text}))}>“{text}”</button>;
}

/** A file waiting to be sent, with a preview for images. */
function Pending({file, remove}: {file: File; remove: () => void}) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (kindOf(file.name) !== "image") return; const r = new FileReader(); r.onload = () => setUrl(String(r.result)); r.readAsDataURL(file); return () => r.abort(); }, [file]);
  return <li>{url ? <img src={url} alt="" /> : <span className="ext" aria-hidden="true">{extname(file.name).slice(1, 5) || "file"}</span>}
    <span className="fn"><bdi>{file.name}</bdi><small>{sizeLabel(file.size)}</small></span>
    <button type="button" aria-label={`Remove ${file.name}`} onClick={remove}>×</button></li>;
}

/** The one message box. Enter sends, Shift+Enter adds a line; drop, paste or attach files to ask about them or get feedback. */
export function Composer({goal, busy}: {goal: string; busy: boolean}) {
  const [text, setText] = useState(""), [files, setFiles] = useState<File[]>([]), [err, setErr] = useState(""), [over, setOver] = useState(false), [pending, go] = useTransition();
  const ta = useRef<HTMLTextAreaElement>(null), pick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fill = (e: Event) => { const el = ta.current; setText(String((e as CustomEvent).detail ?? "")); if (el) requestAnimationFrame(() => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 180) + "px"; }); };
    window.addEventListener(FILL, fill); return () => window.removeEventListener(FILL, fill);
  }, []);
  /** Adds files after checking them here, so a wrong type or size is explained before anything uploads. */
  const add = (list: File[]) => {
    if (!list.length) return;
    const named = list.map(f => f.name ? f : new File([f], `pasted-${Date.now()}.${(f.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, {type: f.type}));
    const bad = named.map(f => refuse(f.name, f.size)).find(Boolean), ok = named.filter(f => !refuse(f.name, f.size));
    const next = [...files, ...ok]; setErr(bad ?? (next.length > MAX_FILES ? `Share up to ${MAX_FILES} files at a time.` : "")); setFiles(next.slice(0, MAX_FILES));
  };
  const submit = () => {
    if (pending || (!text.trim() && !files.length)) return;
    const fd = new FormData(); fd.set("text", text); files.forEach(f => fd.append("files", f));
    go(async () => { const r = await send(goal, fd); if (r?.error) { setErr(r.error); return; } setText(""); setFiles([]); setErr(""); ta.current?.focus(); });
  };
  return <form className={"composer" + (over ? " over" : "")} onSubmit={e => { e.preventDefault(); submit(); }}
    onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); add(Array.from(e.dataTransfer.files)); }}>
    {!text && <div className="chips-row" role="group" aria-label="Quick actions">
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "plan")}>Plan today</button>
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "week")}>Plan my week</button>
      <button type="button" className="chip" disabled={pending} onClick={() => { setText(t => t || "I practised "); ta.current?.focus(); }}>I practised…</button>
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "quiz")}>Quiz me</button>
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "research")}>Find materials</button>
      <button type="button" className="chip" disabled={pending} onClick={() => void quick(goal, "practice")}>Practice sheet</button>
    </div>}
    {files.length > 0 && <ul className="attached" aria-label="Files to send">{files.map((f, i) => <Pending key={f.name + f.size + i} file={f} remove={() => setFiles(fs => fs.filter((_, j) => j !== i))} />)}</ul>}
    <div className="box">
      <textarea ref={ta} value={text} rows={1} placeholder={busy ? "The Guide is working…" : files.length ? "Say what you want to know, or send for feedback" : "Message your Guide"} aria-label="Message the Guide"
        onChange={e => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px"; }}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
        onPaste={e => { const f = Array.from(e.clipboardData.files); if (f.length) { e.preventDefault(); add(f); } }} />
      <button type="button" className="attach" aria-label="Attach files" title="Attach files: images, PDF, Word, text or code (up to 20 MB each)" onClick={() => pick.current?.click()}><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M13.5 7.5l-5.4 5.4a3.2 3.2 0 01-4.5-4.5l5.6-5.6a2.1 2.1 0 013 3L6.6 11.4a1 1 0 01-1.5-1.5l5-5" /></svg></button>
      <button className="send" type="submit" disabled={pending || (!text.trim() && !files.length)} aria-label="Send">{pending ? (files.length ? "Sending…" : "…") : "Send"}</button>
    </div>
    {err && <p className="form-note" role="alert">{err}</p>}
    <input ref={pick} type="file" hidden multiple accept={ACCEPT_ATTR} onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
  </form>;
}
