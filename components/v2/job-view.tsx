"use client";
import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";

type Step = {at: string; kind: string; text: string};
type State = {status: string; steps: Step[]; error: string | null; kind: string};
const LABEL: Record<string, string> = {research: "Finding materials", ask: "Thinking about your question", review: "Reviewing your work", practice: "Making practice material"};

/** Live view of an agent run: what it is searching, reading and writing, as it happens. */
export function JobView({job, cancel}: {job: string; cancel: () => void | Promise<void>}) {
  const router = useRouter(), [st, setSt] = useState<State | null>(null), done = useRef(false);
  useEffect(() => {
    let alive = true, t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch(`/api/agent/${job}`, {cache: "no-store"}); if (!alive) return;
        if (r.ok) { const j = await r.json() as State; setSt(j); if (j.status !== "running" && !done.current) { done.current = true; router.refresh(); return; } }
      } catch { /* keep trying */ }
      t = setTimeout(tick, 1400);
    };
    tick(); return () => { alive = false; clearTimeout(t); };
  }, [job, router]);
  if (!st) return <p className="working" role="status"><i aria-hidden="true" />Starting…</p>;
  if (st.status === "failed") return <p className="form-note" role="alert">{st.error || "The Guide could not finish this one."} Your data is unchanged.</p>;
  if (st.status === "cancelled") return <p className="muted">Stopped.</p>;
  if (st.status === "done") return <p className="muted" role="status">Done. Loading what it found…</p>;
  const mark: Record<string, string> = {search: "Search", open: "Read", run: "Run", write: "Write", say: "·", error: "!"};
  return <div className="run" role="status" aria-live="polite">
    <p className="working"><i aria-hidden="true" />{LABEL[st.kind] ?? "Working"}. This can take a minute or two.</p>
    <ol className="steps">{st.steps.map((s, i) => <li key={i} className={"k-" + s.kind}><span className="k">{mark[s.kind] ?? "·"}</span>{s.text}</li>)}</ol>
    <form action={cancel}><button className="btn btn--text small">Stop</button></form>
  </div>;
}
