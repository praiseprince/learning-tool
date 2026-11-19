"use client";
import {useEffect, useRef, useState, type ReactNode} from "react";
import {refineNote, saveRevision, setNoteGoal} from "@/app/notebook/actions";
import {Markdown} from "./markdown";
import type {WikiLink} from "@/lib/v2/notebook";
import {Select} from "@/components/ui/select";

const TOOLS: [string, string, string, string][] = [["B", "Bold", "**", "**"], ["I", "Italic", "*", "*"], ["H", "Heading", "## ", ""], ["•", "List", "- ", ""], ["“", "Quote", "> ", ""], ["∑", "Maths", "$", "$"], ["[[ ]]", "Link a skill", "[[", "]]"]];

export function Editor({id, initial, title: original, revision, links, nodes, goal, goals, footer}: {id: string; initial: string; title: string; revision: string; links: WikiLink[]; nodes: {id: string; label: string}[]; goal: string; goals: {id: string; name: string}[]; footer: ReactNode}) {
  const [title, setTitle] = useState(original), [body, setBody] = useState(initial), [preview, show] = useState(initial.trim().length > 0), [status, setStatus] = useState("Saved"), [retry, again] = useState(0), [caret, setCaret] = useState(0);
  const [prop, setProp] = useState<{markdown: string; how: string; note?: string; before: string} | null>(null), [busy2, setBusy2] = useState(false);
  const base = useRef(revision), saved = useRef({title: original, body: initial}), busy = useRef(false), area = useRef<HTMLTextAreaElement>(null);
  const key = "marginalia-document-" + id;
  useEffect(() => {
    const frame = requestAnimationFrame(() => { try { const draft = JSON.parse(localStorage.getItem(key) || "null"); if (draft && typeof draft.body === "string" && typeof draft.title === "string") { setBody(draft.body); setTitle(draft.title); base.current = draft.base; } } catch { /* no draft */ } });
    return () => cancelAnimationFrame(frame);
  }, [key]);
  useEffect(() => {
    if (title === saved.current.title && body === saved.current.body) return;
    const timer = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true; setStatus("Saving…");
      try {
        const next = await saveRevision(id, base.current, title, body); saved.current = {title, body}; base.current = next;
        const raw = localStorage.getItem(key);
        if (raw) { const latest = JSON.parse(raw); if (latest.body === body && latest.title === title) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify({...latest, base: next})); }
        setStatus("Saved"); again(n => n + 1);
      } catch { setStatus("Couldn’t save. Your draft is kept on this device."); }
      finally { busy.current = false; }
    }, 750);
    return () => clearTimeout(timer);
  }, [id, title, body, key, retry]);
  function edit(nextTitle: string, nextBody: string) { localStorage.setItem(key, JSON.stringify({title: nextTitle, body: nextBody, base: base.current})); setTitle(nextTitle); setBody(nextBody); setStatus("Unsaved"); }
  function wrap(before: string, after: string) {
    const el = area.current; if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd, mid = body.slice(a, b);
    edit(title, body.slice(0, a) + before + mid + after + body.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + mid.length); });
  }
  async function tidyUp() {
    setBusy2(true);
    try { const r = await refineNote(body); setProp({...r, before: body}); } catch { setProp({markdown: body, how: "basic", note: "Couldn’t tidy this just now. Your note is unchanged.", before: body}); }
    finally { setBusy2(false); }
  }
  const same = prop ? prop.markdown.trim() === prop.before.trim() : false;
  const fragment = body.slice(0, caret).match(/\[\[([^\]\n]*)$/)?.[1];
  const pick = nodes.filter(n => fragment !== undefined && n.label.toLowerCase().includes(fragment.toLowerCase())).slice(0, 6);
  return <div className="editor">
    <input className="title" aria-label="Title" value={title} maxLength={240} placeholder="Untitled note" onChange={e => edit(e.target.value, body)} />
    <div className="meta">
      <Select aria-label="Goal" defaultValue={goal} style={{width: "auto"}} onChange={e => void setNoteGoal(id, e.target.value)}><option value="">No goal</option>{goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
      <span className="seg-mini" role="group" aria-label="View"><button aria-pressed={!preview} onClick={() => show(false)}>Write</button><button aria-pressed={preview} onClick={() => show(true)}>Preview</button></span>
      <button className="btn btn--quiet btn--sm" onClick={tidyUp} disabled={busy2 || !body.trim()}>{busy2 ? "Tidying…" : "Refine"}</button><span className="status" role="status">{status}</span>{status.startsWith("Couldn") && <button className="btn btn--quiet btn--sm" onClick={() => again(n => n + 1)}>Try again</button>}
    </div>
    {prop && <section className="refine" aria-label="Refined version">
      <div className="refine-head"><b>{same ? "Already tidy" : "Refined version"}</b><span className="muted small">{prop.how === "ai" ? "Structure only. Your words are unchanged." : "Basic tidy: structure only."}{prop.note ? " " + prop.note : ""}</span></div>
      {!same && <div className="refine-cols"><div><p className="eyebrow">Yours</p><pre className="raw">{prop.before}</pre></div><div><p className="eyebrow">Refined</p><div className="md"><Markdown text={prop.markdown} links={[...nodes.map(n => ({label: n.label, nodeId: n.id})), ...links]} /></div></div></div>}
      <div className="actions">{!same && <button className="btn btn--sm" onClick={() => { edit(title, prop.markdown); setProp(null); show(true); }}>Use refined</button>}<button className="btn btn--quiet btn--sm" onClick={() => setProp(null)}>{same ? "Close" : "Keep mine"}</button></div>
    </section>}
    {preview ? <div className="md"><Markdown text={body} links={[...nodes.map(n => ({label: n.label, nodeId: n.id})), ...links]} /></div> : <>
      <div className="tools" role="toolbar" aria-label="Formatting">{TOOLS.map(([l, name, a, b]) => <button key={name} title={name} aria-label={name} onClick={() => wrap(a, b)}>{l}</button>)}</div>
      <textarea ref={area} aria-label="Note" value={body} maxLength={120000} placeholder="Write in your own words. Link a skill with [[double brackets]]." onSelect={e => setCaret(e.currentTarget.selectionStart)} onChange={e => edit(title, e.target.value)} />
      {pick.length > 0 && <div className="tools" aria-label="Skill suggestions">{pick.map(n => <button key={n.id} onClick={() => { const at = area.current?.selectionStart ?? body.length; edit(title, body.slice(0, at - (fragment?.length ?? 0)) + n.label + "]]" + body.slice(at)); }}>{n.label}</button>)}</div>}
    </>}
    {footer}
  </div>;
}
