"use client";
// Delete for an archived goal. One tap asks in place; the second deletes. No browser dialog.
import {useState, useTransition} from "react";
import {deleteGoalForGood} from "@/app/goals/actions";

export function DeleteGoal({goal, name}: {goal: string; name: string}) {
  const [asking, setAsking] = useState(false), [err, setErr] = useState(""), [busy, start] = useTransition();
  if (!asking) return <button type="button" className="btn btn--quiet btn--sm" onClick={() => { setErr(""); setAsking(true); }}>Delete</button>;
  return <div className="confirm-del" role="group" aria-label={`Delete ${name}`}>
    <p className="small">Delete <b>{name}</b> with its chat, notes, sessions, skills and files? A backup copy is kept next to the database.</p>
    {err && <p className="small" role="alert">{err}</p>}
    <div className="confirm-del-actions">
      <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => start(async () => { const r = await deleteGoalForGood(goal).catch(() => ({error: "That didn't go through. Try again."})); if (r.error) setErr(r.error); })}>{busy ? "Deleting…" : "Delete for good"}</button>
      <button type="button" className="btn btn--quiet btn--sm" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
    </div>
  </div>;
}
