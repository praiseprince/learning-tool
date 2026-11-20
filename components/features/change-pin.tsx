"use client";
import {useActionState, useState} from "react";
import {changePin} from "@/app/you/actions";

export function ChangePin() {
  const [open, setOpen] = useState(false), [state, act, busy] = useActionState(changePin, undefined);
  if (state?.done) return <span className="saved" role="status">PIN changed.</span>;
  if (!open) return <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOpen(true)}>Change PIN</button>;
  return <form action={act} className="pin-change">
    {(["current", "pin", "again"] as const).map(n => <label key={n}><span>{n === "current" ? "Current PIN" : n === "pin" ? "New PIN" : "New PIN again"}</span>
      <input name={n} type="password" inputMode="numeric" pattern="[0-9]*" autoComplete={n === "current" ? "current-password" : "new-password"} required minLength={4} maxLength={12} /></label>)}
    {state?.error && <p className="login-err" role="alert">{state.error}</p>}
    <div className="actions"><button className="btn btn--sm" disabled={busy}>{busy ? "Saving…" : "Save PIN"}</button><button type="button" className="btn btn--quiet btn--sm" onClick={() => setOpen(false)}>Cancel</button></div>
  </form>;
}
