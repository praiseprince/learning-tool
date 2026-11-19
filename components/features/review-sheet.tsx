"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function ReviewSheet({ home, children }: {home:string; children:ReactNode}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  function close() { router.replace(home); }
  return <dialog ref={dialog} className="review-sheet" aria-label="Entry review" onCancel={event => { event.preventDefault(); close(); }}>
    {children}
    <button className="button button--ghost" onClick={close}>Close</button>
  </dialog>;
}

export function ResumeExtractions({ entries }: { entries:string[] }) {
  const ids = JSON.stringify(entries);
  useEffect(() => {
    let active = true;
    async function resume() {
      for (const id of JSON.parse(ids) as string[]) {
        if (!active) break;
        await fetch(`/api/entries/${encodeURIComponent(id)}/extract`, {method:"POST"}).catch(() => undefined);
      }
    }
    void resume();
    return () => { active = false; };
  }, [ids]);
  return null;
}
