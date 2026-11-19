"use client";
import {useRef, useState, useTransition, type ReactNode} from "react";
import {savePreferences} from "@/app/you/actions";
import {Select} from "@/components/ui/select";

type Prefs = {minutes: number; time_of_day: string; week_start: number; theme: string};

/** Preferences save as you change them; no Save button. */
export function PrefsForm({prefs, reminder}: {prefs: Prefs; reminder?: ReactNode}) {
  const [v, setV] = useState({minutes: String(prefs.minutes), time: prefs.time_of_day, week: String(prefs.week_start), theme: prefs.theme});
  const [state, setState] = useState<"idle" | "saved" | "error">("idle"), [, go] = useTransition(), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const save = (next: typeof v) => {
    setV(next);
    const n = Number(next.minutes); if (!Number.isInteger(n) || n < 5 || n > 600) { setState("error"); return; }
    clearTimeout(timer.current); timer.current = setTimeout(() => go(async () => {
      const fd = new FormData(); fd.set("minutes", next.minutes); fd.set("time", next.time); fd.set("week", next.week); fd.set("theme", next.theme);
      try { await savePreferences(fd); setState("saved"); } catch { setState("error"); }
    }), 350);
  };
  return <><div className="rows-s">
    <div className="srow"><div><b>Typical session</b><p>How long a plan should be by default.</p></div><div className="inline-unit"><input type="number" min={5} max={600} value={v.minutes} aria-label="Typical session length in minutes" onChange={e => save({...v, minutes: e.target.value})} /><span>min</span></div></div>
    <div className="srow"><div><b>Time of day</b><p>When plans assume you practise.</p></div><Select aria-label="Preferred time of day" value={v.time} onChange={e => save({...v, time: e.target.value})}>{["Any time", "Morning", "Afternoon", "Evening"].map(x => <option key={x}>{x}</option>)}</Select></div>
    <div className="srow"><div><b>Week starts on</b></div><Select aria-label="Week starts on" value={v.week} onChange={e => save({...v, week: e.target.value})}><option value="1">Monday</option><option value="0">Sunday</option></Select></div>
    {reminder && <div className="srow"><div><b>Daily reminder</b><p>A nudge while Marginalia is open.</p></div>{reminder}</div>}
    <div className="srow"><div><b>Theme</b></div><Select aria-label="Theme" value={v.theme} onChange={e => save({...v, theme: e.target.value})}>{["System", "Light", "Dark"].map(x => <option key={x} value={x.toLowerCase()}>{x}</option>)}</Select></div>
  </div>
  <p id="prefs-state" className={"saved " + state} role="status" aria-live="polite">{state === "saved" ? "Saved" : state === "error" ? "Session length must be between 5 and 600 minutes." : ""}</p></>;
}
