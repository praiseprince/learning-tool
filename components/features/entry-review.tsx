"use client";

import { useEffect, useState } from "react";
import { resolveExtraction } from "@/lib/db/apply";
import type { LogExtraction } from "@/lib/ai/extraction";
import type { z } from "zod";
import { Button } from "@/components/ui/button";

export function EntryReview({ entry, names, resolution }: { entry: string; names:Record<string,string>; resolution?:string }) {
  const [attempt, retry] = useState(0);
  const [status, setStatus] = useState("pending");
  const [result, setResult] = useState<z.infer<typeof LogExtraction>>();
  useEffect(() => {
    const abort = new AbortController();
    const url = `/api/entries/${encodeURIComponent(entry)}/extract`;
    async function poll() {
      const start = await fetch(url, { method:"POST", signal:abort.signal });
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
  }, [entry, attempt]);
  const action = resolveExtraction.bind(null,entry);
  if (resolution === "applied") return <section><p>Changes saved.</p><form action={action}><Button name="intent" value="undo" variant="ghost">Undo</Button></form></section>;
  if (resolution === "dismissed" || resolution === "undone") return <p>Entry kept.</p>;
  return <section aria-live="polite">
    {status === "ready" && result ? <><h2>Here’s what I took from that</h2><form className="review-form" action={action}>
      {result.minutes !== null && <div><label><input type="checkbox" name="time" defaultChecked /> Time</label> <input type="number" aria-label="Minutes" name="minutes" defaultValue={result.minutes} min={0} max={600} required /></div>}
      {result.skills.map((skill,index)=><div key={index}><label><input type="checkbox" name={`skill-${index}`} defaultChecked /> {names[skill.skill_id ?? ""] ?? skill.new_skill_name}</label> <input aria-label="Suggested level" type="number" name={`level-${index}`} defaultValue={skill.level_after} min={0} max={5} required /><p className="reading-small">{skill.evidence_quote}</p></div>)}
      {result.state_note && <div><label><input type="checkbox" name="state" defaultChecked /> Where you are</label><textarea aria-label="Progress summary" name="summary" maxLength={240} defaultValue={result.state_note}/></div>}
      <Button>Looks right</Button><Button name="intent" value="dismiss" formNoValidate variant="ghost">Keep entry only</Button>
    </form></> :
    status === "failed" ? <><p>Couldn’t read this yet. Your entry is saved.</p><Button variant="secondary" onClick={() => {setStatus("pending"); retry(attempt + 1);}}>Try again</Button></> :
    <p>Reading your entry…</p>}
  </section>;
}
