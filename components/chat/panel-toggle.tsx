"use client";
import {useEffect, useState} from "react";

const OPEN = "open-goal-panel";

/** The button in the top bar that opens the goal panel on screens too narrow to show it beside the chat. */
export function PanelOpen() {
  return <button type="button" className="panel-open" onClick={() => window.dispatchEvent(new Event(OPEN))} aria-label="Show goal details">Goal</button>;
}

/** On a laptop the goal panel sits beside the chat. On narrow screens it slides over, opened from the top bar. */
export function PanelToggle({children}: {label?: string; children: React.ReactNode}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true), key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener(OPEN, show); window.addEventListener("keydown", key);
    return () => { window.removeEventListener(OPEN, show); window.removeEventListener("keydown", key); };
  }, []);
  return <>
    <aside className={"gpanel" + (open ? " open" : "")} aria-label="Goal details">
      <button className="panel-close" onClick={() => setOpen(false)} aria-label="Close goal details">Close</button>{children}</aside>
    {open && <div className="gpanel-back" onClick={() => setOpen(false)} />}
  </>;
}
