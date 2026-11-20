"use client";
import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {Markdown} from "./markdown";

type Step = {at: string; kind: string; text: string};
type State = {status: string; steps: Step[]; error: string | null; kind: string; draft?: string | null};
const LABEL: Record<string, string> = {research: "Finding materials", ask: "Thinking about your question", review: "Reviewing your work", practice: "Making practice material"};

/** Live view of an agent run: what it is searching, reading and writing, as it happens. */
export function JobView({job, cancel}: {job: string; cancel: () => void | Promise<void>}) {
  const router = useRouter(), [st, setSt] = useState<State | null>(null), done = useRef(false), drafting = useRef(false);
  useEffect(() => {
    let alive = true, t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch(`/api/agent/${job}`, {cache: "no-store"}); if (!alive) return;
        if (r.ok) { const j = await r.json() as State; setSt(j); drafting.current = !!j.draft; if (j.status !== "running" && !done.current) { done.current = true; router.refresh(); return; } }
      } catch { /* keep trying */ }
      t = setTimeout(tick, drafting.current ? 450 : 1400); // faster while the answer is being written
    };
    tick(); return () => { alive = false; clearTimeout(t); };
  }, [job, router]);
  const len = st?.draft?.length ?? 0;
  useEffect(() => { // follow the answer as it is written, unless the reader has scrolled up
    const el = document.querySelector(".chat-scroll"); if (!len || !el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) el.scrollTop = el.scrollHeight;
  }, [len]);
  if (!st) return <p className="working" role="status"><i aria-hidden="true" />Starting…</p>;
  if (st.status === "failed") return <p className="form-note" role="alert">{st.error || "The Guide could not finish this one."} Your data is unchanged.</p>;
  if (st.status === "cancelled") return <p className="muted">Stopped.</p>;
  if (st.status === "done") return <p className="muted" role="status">Done. Loading what it found…</p>;
  const mark: Record<string, string> = {search: "Search", open: "Read", run: "Run", write: "Write", say: "·", error: "!"};
  if (st.draft) return <div className="run drafting" aria-busy="true">
    <div className="md"><Markdown text={st.draft} /></div>
    <p className="working"><i aria-hidden="true" />Writing…</p>
    <form action={cancel}><button className="btn btn--text small">Stop</button></form>
  </div>;
  return <div className="run" role="status" aria-live="polite">
    <p className="working"><i aria-hidden="true" />{LABEL[st.kind] ?? "Working"}. This can take a minute or two.</p>
    <ol className="steps">{st.steps.map((s, i) => <li key={i} className={"k-" + s.kind}><span className="k">{mark[s.kind] ?? "·"}</span>{s.text}</li>)}</ol>
    <form action={cancel}><button className="btn btn--text small">Stop</button></form>
  </div>;
}
