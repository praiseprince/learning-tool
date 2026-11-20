"use client";
import {useActionState} from "react";
import {enter} from "./actions";

export function PinForm({next}: {next: string}) {
  const [state, act, busy] = useActionState(enter, undefined);
  return <form action={act} className="login-form">
    <input type="hidden" name="next" value={next} />
    <label className="login-label" htmlFor="pin">PIN</label>
    <input id="pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password" autoFocus required minLength={4} maxLength={12}
      aria-invalid={!!state?.error} aria-describedby={state?.error ? "pin-err" : undefined} />
    {state?.error && <p id="pin-err" className="login-err" role="alert">{state.error}</p>}
    <button className="btn" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
  </form>;
}
