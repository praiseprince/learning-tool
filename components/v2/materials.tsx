import type {Material} from "@/lib/v2/materials";
import {MATERIAL_KINDS, MATERIAL_STATUS} from "@/lib/v2/materials";
import {addMaterialAction, detachMaterialAction, updateMaterialAction} from "@/app/goals/material-actions";
import {FindButton} from "@/components/chat/find-button";
import {Select} from "@/components/ui/select";

const STATUS: Record<string, string> = {using: "Using", queued: "Up next", done: "Finished", dropped: "Not for me"};

/** A material as it appears inside a plan block: what it is and exactly where to work. */
export function MaterialInline({m, where}: {m: Material; where: string}) {
  const body = <><span className="mi-k">{m.kind[0].toUpperCase() + m.kind.slice(1)}{m.creator ? ` · ${m.creator}` : ""}</span><em>{m.title}</em>{where ? <b>{where}</b> : null}</>;
  return m.url ? <a className="mi" href={m.url} target="_blank" rel="noopener noreferrer">{body}</a> : <div className="mi">{body}</div>;
}

export function MaterialsPanel({goal, items, added, bad}: {goal: string; items: Material[]; added?: boolean; bad?: boolean}) {
  const order = ["using", "queued", "done", "dropped"], sorted = [...items].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return <div className="mats">
    <div className="ov-h"><p className="muted small">{items.length ? `${items.length} ${items.length === 1 ? "material" : "materials"}, ${items.filter(m => m.status === "using").length} in use` : "Nothing yet"}</p><div className="actions"><FindButton goal={goal} /></div></div>
    {added && <p className="form-note" role="status">Added. The next plan can point at it.</p>}
    <details className="add-mat" open={bad || !items.length}><summary className="btn btn--quiet btn--sm">Add a material</summary>
      <form action={addMaterialAction.bind(null, goal)} className="form">
        <label className="field"><span>Title</span><input name="title" required maxLength={200} placeholder="Alfred’s Adult All-in-One Piano Course" /></label>
        <div className="two"><label className="field"><span>Kind</span><Select name="kind" defaultValue="book">{MATERIAL_KINDS.map(k => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</Select></label>
          <label className="field"><span>By <small>optional</small></span><input name="creator" maxLength={160} placeholder="Author, teacher or channel" /></label></div>
        <div className="two"><label className="field"><span>Link <small>optional</small></span><input name="url" type="url" inputMode="url" maxLength={600} placeholder="https://…" /></label>
          <label className="field"><span>Where you are <small>optional</small></span><input name="pointer" maxLength={140} placeholder="Chapter 2, p. 31" /></label></div>
        <label className="field"><span>Notes <small>optional</small></span><textarea name="notes" rows={2} maxLength={1000} /></label>
        {bad && <p className="form-note" role="alert">Give the material a title.</p>}
        <div><button className="btn btn--sm">Add material</button></div></form></details>
    {items.length ? <ul className="mat-list">{sorted.map(m => <li key={m.id} className={"s-" + m.status}>
      <div className="ml-h"><p className="ml-t">{m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer">{m.title}</a> : m.title}</p><span className={"st st-" + m.status}>{STATUS[m.status]}</span></div>
      <p className="ml-m">{[m.kind[0].toUpperCase() + m.kind.slice(1), m.creator, m.origin === "agent_checked" ? "found by the Guide, link checked" : m.origin === "agent_unchecked" ? "suggested by the Guide" : ""].filter(Boolean).join(" · ")}</p>
      {m.pointer && <p className="ml-at">At <b>{m.pointer}</b></p>}
      {m.notes && <p className="ml-n clamp-2" title={m.notes}>{m.notes}</p>}
      <details className="ml-edit"><summary>Update</summary>
        <form action={updateMaterialAction.bind(null, goal, m.id)} className="tile-form">
          <label className="field"><span>Where you are</span><input name="pointer" defaultValue={m.pointer} maxLength={140} placeholder="Chapter 3, p. 62…" /></label>
          <label className="field"><span>Status</span><Select name="status" defaultValue={m.status}>{MATERIAL_STATUS.map(s2 => <option key={s2} value={s2}>{STATUS[s2]}</option>)}</Select></label>
          <div className="actions"><button className="btn btn--sm">Save</button></div></form>
        <form action={detachMaterialAction.bind(null, goal, m.id)}><button className="btn btn--text small">Remove from this goal</button></form></details></li>)}</ul>
      : <p className="muted">Add the book, course or videos you are using and say where you are. Then each day’s plan can tell you exactly which pages or lesson to work on.</p>}
  </div>;
}
