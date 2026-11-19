import type {Brief} from "@/lib/v2/brief";
import {Submit, Working} from "./pending";

const LEVEL = ["", "a little", "fairly well", "well", "well", "well"];

/** Read-only account of what the Guide understood. No fields to fill: you correct it in words. */
export function DraftView({draft, current, confirm, fix, discard, confirmLabel, fixed, basic}: {
  draft: Brief; current?: Brief; confirm: () => void | Promise<void>; fix: (d: FormData) => void | Promise<void>; discard: () => void | Promise<void>; confirmLabel: string; fixed?: boolean; basic?: boolean;
}) {
  const names = new Set((current?.skills ?? []).map(s => s.name.toLowerCase())), now = new Set(draft.skills.map(s => s.name.toLowerCase()));
  const added = current ? draft.skills.filter(s => !names.has(s.name.toLowerCase())) : [], dropped = current ? current.skills.filter(s => !now.has(s.name.toLowerCase())) : [];
  const keepers = current ? draft.skills.filter(s => names.has(s.name.toLowerCase())) : draft.skills;
  const can = keepers.filter(s => s.status === "have"), want = keepers.filter(s => s.status === "target");
  return <div className="stack stack--lg">
    {basic && <p className="form-note" role="status">The Guide was unavailable, so I sorted your words without AI. Read this carefully.</p>}
    {fixed && <p className="form-note" role="status">Updated with your correction.</p>}
    <section className="stack"><h2>{draft.title}</h2><p className="prose prose--lg">{draft.goal}</p>
      {draft.why && <p className="prose"><b className="lab">Why</b> {draft.why}</p>}{draft.doneLooksLike && <p className="prose"><b className="lab">Done looks like</b> {draft.doneLooksLike}</p>}</section>
    <section className="stack"><h2>Where you are</h2><p className="prose">{draft.currentPosition || "Not enough said yet. The first sessions will fill this in."}</p>
      {can.length > 0 && <ul className="chiplist">{can.map(s => <li key={s.name}>{s.name}<small>{LEVEL[Math.min(3, s.level)]} · self-reported</small></li>)}</ul>}</section>
    {current && (added.length > 0 || dropped.length > 0) && <section className="stack"><h2>What changes</h2>
      {added.length > 0 && <div><p className="group-h">Added</p><ul className="chiplist chiplist--add">{added.map(s => <li key={s.name}>{s.name}</li>)}</ul></div>}
      {dropped.length > 0 && <div><p className="group-h">Archived (history is kept)</p><ul className="chiplist chiplist--drop">{dropped.map(s => <li key={s.name}>{s.name}</li>)}</ul></div>}</section>}
    <section className="stack"><h2>{current ? "Still on the map" : "What you eventually want"}</h2>
      {want.length ? <ul className="chiplist">{want.map(s => <li key={s.name}>{s.name}</li>)}</ul> : <p className="muted">Nothing listed yet.</p>}</section>
    {draft.roadmap.length > 0 && <section className="stack"><h2>Rough roadmap</h2><p className="muted small">A guide, not a schedule. Each day’s plan adapts to how sessions actually go.</p>
      <ol className="trail">{draft.roadmap.map((p, i) => <li key={i}><h3>{p.phase}{p.focus ? ` · ${p.focus}` : ""}</h3>{p.outcomes.length > 0 && <p className="prose">{p.outcomes.join(" · ")}</p>}</li>)}</ol></section>}
    {draft.constraints && <section className="stack"><h2>Constraints</h2><p className="prose">{draft.constraints}</p></section>}

    <section className="sheet"><form action={confirm} className="stack"><div className="actions"><Submit pending="Saving…">{confirmLabel}</Submit></div><p className="muted small">{current ? "This adds a new version. The old plan and all your history stay." : "Nothing is saved until you press this."}</p></form></section>
    <section className="sheet"><form action={fix} className="form"><label className="field"><span>Something off? Tell me in your own words.</span><textarea name="text" rows={3} placeholder="Actually I can already read bass clef fluently, and I only have 20 minutes on weekdays." /></label>
      <div className="actions"><Submit className="btn btn--quiet" pending="Updating…">Fix it</Submit></div><Working>Updating your goal…</Working></form></section>
    <form action={discard}><button className="btn btn--text">Throw this away</button></form>
  </div>;
}
