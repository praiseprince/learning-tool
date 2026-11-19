"use client";
import {useFormStatus} from "react-dom";

/** A submit button that says what is happening while a slow step (the AI thinking) runs. */
export function Submit({children, pending, className = "btn", name, value, formNoValidate, formAction}: {children: React.ReactNode; pending: string; className?: string; name?: string; value?: string; formNoValidate?: boolean; formAction?: (d: FormData) => void | Promise<void>}) {
  const s = useFormStatus();
  return <button className={className} name={name} value={value} formNoValidate={formNoValidate} formAction={formAction} disabled={s.pending} aria-busy={s.pending}>{s.pending ? pending : children}</button>;
}

/** Shown while any form in the page is working. */
export function Working({children}: {children: React.ReactNode}) {
  const s = useFormStatus();
  return s.pending ? <p className="working" role="status"><i aria-hidden="true" />{children}</p> : null;
}
