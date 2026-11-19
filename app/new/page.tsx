"use client";

import { useState } from "react";
import { createJourney } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { JOURNEY_HUES } from "@/lib/constants";

export default function NewJourney() {
  const [step, setStep] = useState(1); const [hue, setHue] = useState(100); const [intent, setIntent] = useState(""); const [starting, setStarting] = useState("");
  return <main className="onboarding"><div className="stepper" aria-label={`Step ${step} of 3`}><i className={step >= 1 ? "on" : ""} /><i className={step >= 2 ? "on" : ""} /><i className={step >= 3 ? "on" : ""} /></div><form action={createJourney}>
    {step === 1 && <><h1>What do you want to learn, and why now?</h1><p className="reading">Rough is fine. You can shape it as you go.</p><textarea required value={intent} onChange={(event) => setIntent(event.target.value)} placeholder="I want to learn…" /><label>Where are you starting from? <textarea value={starting} onChange={(event) => setStarting(event.target.value)} placeholder="Optional" /></label><Button type="button" disabled={!intent.trim()} onClick={() => setStep(2)}>Continue</Button></>}
    {step === 2 && <><h1>A few questions.</h1><p className="reading">What kind of rhythm is realistic for you?</p><div className="cluster"><Chip>1 to 2 days</Chip><Chip>3 to 4 days</Chip><Chip>5 or more</Chip><Chip>It varies</Chip></div><label>Or say it your way<textarea placeholder="Optional" /></label><Button type="button" onClick={() => setStep(3)}>Continue</Button></>}
    {step === 3 && <><h1>Make it yours.</h1><p className="reading">The first outline will stay editable. Pick a highlighter for the progress you make.</p><input type="hidden" name="intent" value={intent} /><input type="hidden" name="starting" value={starting} /><input type="hidden" name="hue" value={hue} /><div className="hue-swatches">{JOURNEY_HUES.map((value) => <button className={hue === value ? "hue-swatch selected" : "hue-swatch"} type="button" key={value} style={{ "--swatch-hue": value } as React.CSSProperties} onClick={() => setHue(value)} aria-label={`Choose journey color ${value}`} />)}</div><Button type="submit">Start journey</Button></>}
  </form></main>;
}
