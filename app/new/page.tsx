"use client";

import { useState } from "react";
import type {GoalDraft} from "@/lib/ai/stub";
import { createJourney,prepareJourney } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { JOURNEY_HUES } from "@/lib/constants";

export default function NewJourney() {
  const [step, setStep] = useState(1); const [hue, setHue] = useState(100); const [intent, setIntent] = useState(""); const [starting, setStarting] = useState("");
  const [rhythm,setRhythm]=useState("");
  const [draft,setDraft]=useState<GoalDraft|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  async function generate() {
    setLoading(true); setError("");
    try {setDraft(await prepareJourney(intent,starting,rhythm)); setStep(3);}
    catch {setError("Couldn’t draft this yet. Try again.");}
    finally {setLoading(false);}
  }
  return <main className="onboarding"><div className="stepper" aria-label={`Step ${step} of 3`}><i className={step >= 1 ? "on" : ""} /><i className={step >= 2 ? "on" : ""} /><i className={step >= 3 ? "on" : ""} /></div><form action={createJourney}>
    {step === 1 && <><h1>What do you want to learn, and why now?</h1><p className="reading">Rough is fine. You can shape it as you go.</p><textarea required maxLength={1500} value={intent} onChange={(event) => setIntent(event.target.value)} placeholder="I want to learn…" /><label>Where are you starting from? <textarea maxLength={1200} value={starting} onChange={(event) => setStarting(event.target.value)} placeholder="Optional" /></label><Button type="button" disabled={!intent.trim()} onClick={() => setStep(2)}>Continue</Button></>}
    {step === 2 && <><h1>A few questions.</h1><p className="reading">What kind of rhythm is realistic for you?</p><div className="cluster">{["1 to 2 days","3 to 4 days","5 or more","It varies"].map(option=><Chip type="button" key={option} selected={rhythm===option} onClick={()=>setRhythm(option)}>{option}</Chip>)}</div><label>Or say it your way<textarea maxLength={500} value={rhythm} onChange={e=>setRhythm(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<Button disabled={loading} type="button" onClick={generate}>{loading?"Drafting…":"Continue"}</Button></>}
    {step === 3 && draft && <><h1>Make it yours.</h1><p className="reading">The first outline will stay editable. Pick a highlighter for the progress you make.</p><label>Journey name<input value={draft.name} required maxLength={100} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    {([["goal","Goal"],["why","Why it matters"],["doneLooksLike","What done looks like"],["startingPoint","Starting point"]] as const).map(([key,label])=><label key={key}>{label}<textarea value={draft[key]} required={key==="goal"} maxLength={1200} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
    <div><h2>Starting skills</h2>{draft.skills.map((skill,i)=><p key={i}>{skill.name} · level {skill.level}</p>)}</div>
    <input type="hidden" name="draft" value={JSON.stringify(draft)}/><input type="hidden" name="rhythm" value={rhythm}/><input type="hidden" name="hue" value={hue} /><div className="hue-swatches">{JOURNEY_HUES.map((value) => <button className={hue === value ? "hue-swatch selected" : "hue-swatch"} type="button" key={value} style={{ "--swatch-hue": value } as React.CSSProperties} onClick={() => setHue(value)} aria-label={`Choose journey color ${value}`} />)}</div><Button type="submit">Start journey</Button></>}
  </form></main>;
}
