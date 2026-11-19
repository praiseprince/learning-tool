"use client";
import {useEffect, useRef} from "react";
import {useRouter} from "next/navigation";

/** Keeps the thread fresh: polls while the Guide is working, refreshes when something new arrives, and scrolls to the latest message. */
export function Live({goal, seq, busy}: {goal: string; seq: number; busy: boolean}) {
  const router = useRouter(), prev = useRef(seq);
  useEffect(() => {
    const el = document.getElementById("thread-end"); if (!el) return;
    el.scrollIntoView({behavior: prev.current === seq ? "auto" : "smooth", block: "end"}); prev.current = seq;
  }, [seq]);
  useEffect(() => {
    if (!busy) return;
    let alive = true, t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try { const r = await fetch(`/api/chat/${goal}`, {cache: "no-store"}); if (r.ok && alive) { const s = await r.json() as {seq: number; busy: boolean}; if (s.seq !== seq || s.busy !== busy) { router.refresh(); return; } } } catch { /* retry */ }
      if (alive) t = setTimeout(tick, 1500);
    };
    t = setTimeout(tick, 1200); return () => { alive = false; clearTimeout(t); };
  }, [goal, seq, busy, router]);
  return null;
}
