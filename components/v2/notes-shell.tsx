"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useMemo, useState} from "react";
import {newNote} from "@/app/notebook/actions";
import {Select} from "@/components/ui/select";

export type NoteRow = {id: string; title: string; snippet: string; haystack: string; updated: string; goal: string | null; kind: "note" | "source"};
export type NoteGoal = {id: string; name: string; hue: number};

export function NotesShell({notes, goals, inbox, children}: {notes: NoteRow[]; goals: NoteGoal[]; inbox: number; children: React.ReactNode}) {
  const path = usePathname(), onList = path === "/notebook";
  const [q, setQ] = useState(""), [goal, setGoal] = useState("");
  const hue = new Map(goals.map(g => [g.id, g.hue]));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return notes.filter(n => (!goal || n.goal === goal) && (!t || n.haystack.includes(t)));
  }, [notes, q, goal]);
  return <div className="notes" data-pane={onList ? "list" : "editor"}>
    <section className="notes-list" aria-label="Notes">
      <div className="bar">
        <div className="top"><h1>Notes</h1>
          <form action={newNote}><input type="hidden" name="title" value="Untitled note" /><input type="hidden" name="goal" value={goal} /><button className="btn btn--sm">New note</button></form></div>
        <input type="search" placeholder="Search notes" aria-label="Search notes" value={q} onChange={e => setQ(e.target.value)} />
        {goals.length > 0 && <Select aria-label="Filter by goal" value={goal} onChange={e => setGoal(e.target.value)}><option value="">All goals</option>{goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}
      </div>
      <ul>{shown.map(n => <li key={n.id}><Link href={(n.kind === "source" ? "/notebook/s/" : "/notebook/d/") + n.id} aria-current={path.endsWith("/" + n.id) ? "page" : undefined}>
        <span className="nt">{n.goal && hue.has(n.goal) && <i className="gm" style={{"--hue": hue.get(n.goal)} as React.CSSProperties} aria-hidden="true" />}{n.title}</span>
        {n.snippet && <span className="ns">{n.snippet}</span>}<span className="nm">{n.kind === "source" ? "Source · " : ""}{n.updated}</span></Link></li>)}
        {!shown.length && <li className="notes-none" style={{padding: 16}}><p className="muted">{notes.length ? "No notes match." : "No notes yet."}</p></li>}</ul>
      {inbox > 0 && <Link className="link small" style={{padding: 16, borderTop: "1px solid var(--rule)"}} href="/notebook/inbox">{inbox} suggestion{inbox > 1 ? "s" : ""} to review</Link>}
    </section>
    <section className="notes-pane">{!onList && <Link className="link small back-list" href="/notebook">← All notes</Link>}{children}</section>
  </div>;
}
