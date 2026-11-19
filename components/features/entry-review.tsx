"use client";

import { useEffect, useRef, useState } from "react";
import { resolveExtraction } from "@/lib/db/apply";
import type { LogExtraction } from "@/lib/ai/extraction";
import type { z } from "zod";
import { Button } from "@/components/ui/button";

export function EntryReview({ entry, names, resolution, changes, minutes, summary }: { changes:{name:string;level:number;delta:number}[]; minutes:number; summary?:string; entry: string; names:Record<string,string>; resolution?:string }) {
  const [saveError, setSaveError] = useState("");
  const [attempt, retry] = useState(0);
  const [status, setStatus] = useState("pending");
  const [result, setResult] = useState<z.infer<typeof LogExtraction>>();
  const answer = useRef<string|null>(null);
  useEffect(() => {
    if (resolution && resolution !== "pending") return;
    const abort = new AbortController();
    const url = `/api/entries/${encodeURIComponent(entry)}/extract`;
    async function poll() {
      const suffix = answer.current === null ? "" : `?answer=${encodeURIComponent(answer.current)}`;
      answer.current = null;
      const start = await fetch(url + suffix, { method:"POST", signal:abort.signal });
      if (!start.ok) throw Error();
      for (let i=0; i<21; i++) {
        if (abort.signal.aborted) return;
        const response = await fetch(url, { signal:abort.signal, cache:"no-store" });
        if (!response.ok) throw Error();
        const result = await response.json();
        if (result.status === "ready") {
          setResult(result.extraction);
          setStatus("ready");
          return;
        }
        if (result.status === "failed") throw Error();
        await new Promise(resolve => setTimeout(resolve,1500));
      }
      throw Error();
    }
    poll().catch(() => { if (!abort.signal.aborted) setStatus("failed"); });
    return () => abort.abort();
  }, [entry, attempt, resolution]);
  async function action(data:FormData) {
    setSaveError("");
    try { await resolveExtraction(entry,data); }
    catch { setSaveError("Couldn’t update this yet. Your entry is saved. Please try again."); }
  }
  if (resolution === "applied") return <section className="marking-result" style={{"--week-delay":`${changes.length ? 420+(changes.length-1)*90 : 0}ms`,"--summary-delay":`${(changes.length ? 420+(changes.length-1)*90 : 0)+(minutes ? 420 : 0)}ms`} as React.CSSProperties}>
    {changes.map((change,index)=><div key={change.name}><span>{change.name} · {change.level} of 5</span><div className="result-track"><i style={{"--before":`${(change.level-change.delta)*20}%`,"--after":`${change.level*20}%`,animationDelay:`${index*90}ms`} as React.CSSProperties}/></div></div>)}
    {minutes>0 && <div>Today · {minutes} min<div className="result-track"><i style={{"--before":"0%","--after":`${Math.min(100,minutes/90*100)}%`,animationDelay:"var(--week-delay)"} as React.CSSProperties}/></div></div>}
    {summary && <p className="reading"><span className="result-summary">{summary}</span></p>}
    <p role="status" className="marking-confirmation" style={{animationDelay:`calc(var(--summary-delay) + ${summary ? 420 : 0}ms)`}}>Entry saved. Plan updated.</p><form action={action}>{saveError && <p role="alert">{saveError}</p>}<Button name="intent" value="undo" variant="ghost">Undo</Button></form></section>;
  if (resolution === "dismissed" || resolution === "undone") return <p>Entry kept.</p>;
  return <section aria-live="polite">
    {status === "ready" && result ? <><h2>Here’s what I took from that</h2><form className="review-form" action={action}>
      {result.minutes !== null && <div><label><input type="checkbox" name="time" defaultChecked /> Time</label> <input type="number" aria-label="Minutes" name="minutes" defaultValue={result.minutes} min={0} max={600} required /></div>}
      {result.skills.map((skill,index)=><div key={index}><label><input type="checkbox" name={`skill-${index}`} defaultChecked /> {names[skill.skill_id ?? ""] ?? skill.new_skill_name}</label> <input aria-label="Suggested level" type="number" name={`level-${index}`} defaultValue={skill.level_after} min={0} max={5} required /><p className="reading-small">{skill.evidence_quote}</p></div>)}
      {result.state_note && <div><label><input type="checkbox" name="state" defaultChecked /> Where you are</label><textarea aria-label="Progress summary" name="summary" maxLength={240} defaultValue={result.state_note}/></div>}
      {result.clarifying_question && <fieldset><legend>{result.clarifying_question.question}</legend>
        {result.clarifying_question.options.map(option => <Button key={option} type="button" variant="ghost" onClick={() => {
          answer.current = option;
          setStatus("pending");
          retry(attempt + 1);
        }}>{option}</Button>)}
      </fieldset>}
      <input type="hidden" name="reviewed" value={JSON.stringify(result)} />
      {saveError && <p role="alert">{saveError}</p>}
      <Button>Looks right</Button><Button name="intent" value="dismiss" formNoValidate variant="ghost">Keep entry only</Button>
    </form></> :
    status === "failed" ? <><p>Couldn’t read this yet. Your entry is saved.</p><Button variant="secondary" onClick={() => {setStatus("pending"); retry(attempt + 1);}}>Try again</Button></> :
    <p>Reading your entry…</p>}
  </section>;
}
