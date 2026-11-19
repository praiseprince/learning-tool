"use client";
import Link from "next/link";
import {useEffect, useRef, useState} from "react";

/** The goal switcher in the top bar: one click to move between goals, add one, or see them all. */
export function GoalMenu({goals, current}: {goals: {id: string; name: string; hue: number}[]; current?: string}) {
  const [open, setOpen] = useState(false), box = useRef<HTMLDivElement>(null), now = goals.find(g => g.id === current);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [open]);
  return <div className="gmenu" ref={box}>
    <button className="gmenu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      {now && <i className="gm" style={{"--hue": now.hue} as React.CSSProperties} aria-hidden="true" />}<span title={now?.name}>{now?.name ?? "Goals"}</span><span aria-hidden="true" className="caret">▾</span></button>
    {open && <div className="gmenu-pop" role="menu">
      <div className="gmenu-list">{goals.map(g => <Link key={g.id} role="menuitem" href={`/?goal=${g.id}`} aria-current={g.id === current ? "true" : undefined} onClick={() => setOpen(false)}><i className="gm" style={{"--hue": g.hue} as React.CSSProperties} aria-hidden="true" /><span>{g.name}</span></Link>)}</div>
      <div className="gmenu-foot"><Link role="menuitem" href="/goals/new" onClick={() => setOpen(false)}>Add a goal</Link><Link role="menuitem" href="/goals" onClick={() => setOpen(false)}>All goals</Link></div></div>}
  </div>;
}
