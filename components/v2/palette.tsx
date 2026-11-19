"use client";
import {useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";

export type PaletteItem = {id: string; label: string; hint: string; href: string; hue?: number};
const OPEN = "open-palette";

export function PaletteTrigger({className = ""}: {className?: string; mobile?: boolean}) {
  return <button className={"search " + className} onClick={() => window.dispatchEvent(new Event(OPEN))} aria-label="Search"><span>Search</span><kbd>⌘K</kbd></button>;
}

const ORDER = ["Page", "Action", "Goal", "Note", "Skill"], TITLE: Record<string, string> = {Page: "Pages", Action: "Actions", Goal: "Goals", Note: "Notes", Skill: "Skills"};
const mark = (label: string, q: string) => { const t = q.trim().toLowerCase(), i = t ? label.toLowerCase().indexOf(t) : -1; return i < 0 ? label : <>{label.slice(0, i)}<mark>{label.slice(i, i + t.length)}</mark>{label.slice(i + t.length)}</>; };

/** ⌘K / Ctrl+K: jump to any page, goal, note or skill. */
export function Palette({items}: {items: PaletteItem[]}) {
  const router = useRouter(), input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [i, setI] = useState(0);
  useEffect(() => {
    const show = () => { setQ(""); setI(0); setOpen(true); };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (open) setOpen(false); else show(); } if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", key); window.addEventListener(OPEN, show);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener(OPEN, show); };
  }, [open]);
  useEffect(() => { if (open) { const t = setTimeout(() => input.current?.focus(), 10); return () => clearTimeout(t); } }, [open]);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase(), pool = t ? items.filter(x => x.label.toLowerCase().includes(t)) : items.filter(x => ["Page", "Action", "Goal"].includes(x.hint));
    const rank = (x: PaletteItem) => ORDER.indexOf(x.hint) * 10 + (t && x.label.toLowerCase().startsWith(t) ? 0 : 1);
    return [...pool].sort((x, y) => rank(x) - rank(y)).slice(0, t ? 12 : 10);
  }, [items, q]);
  if (!open) return null;
  const go = (x?: PaletteItem) => { if (!x) return; setOpen(false); router.push(x.href); };
  return <div className="pal-back" onMouseDown={() => setOpen(false)}><div className="pal" role="dialog" aria-label="Search" onMouseDown={e => e.stopPropagation()}>
    <div className="pal-in"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
      <input ref={input} autoFocus placeholder="Search goals, notes, skills and pages" value={q} onChange={e => { setQ(e.target.value); setI(0); }}
        onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setI(v => Math.min(v + 1, hits.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setI(v => Math.max(v - 1, 0)); } if (e.key === "Enter") go(hits[i]); }} /></div>
    <ul role="listbox">{hits.map((h, n) => <li key={h.id} role="option" aria-selected={n === i}>
      {(n === 0 || hits[n - 1].hint !== h.hint) && <p className="pal-h">{TITLE[h.hint] ?? h.hint}</p>}
      <button className={n === i ? "on" : ""} onMouseEnter={() => setI(n)} onClick={() => go(h)}>
        {h.hue !== undefined ? <i className="gm" style={{"--hue": h.hue} as React.CSSProperties} aria-hidden="true" /> : <i className="gm gm--none" aria-hidden="true" />}<span title={h.label}>{mark(h.label, q)}</span>{n === i && <small>↵</small>}</button></li>)}
      {!hits.length && <li className="pal-none">Nothing matches “{q}”.</li>}</ul>
    <div className="pal-f"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
  </div></div>;
}
