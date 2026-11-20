"use client";
import {useEffect, useRef} from "react";
import {useRouter} from "next/navigation";

/** Keeps the thread fresh: polls while the Guide is working, refreshes when something new arrives, and scrolls to the latest message. */
export function Live({goal, seq, busy, at}: {goal: string; seq: number; busy: boolean; at?: number}) {
  const router = useRouter(), prev = useRef(seq);
  useEffect(() => { if (at) document.getElementById("m" + at)?.scrollIntoView({block: "start"}); }, [at]); // "Show earlier" and search results keep your place
  useEffect(() => {
    const first = prev.current === seq; prev.current = seq;
    if (first && at) return; // opened on a particular message: the effect above placed it
    document.getElementById("thread-end")?.scrollIntoView({behavior: first ? "auto" : "smooth", block: "end"});
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps -- only a new message should scroll to the end
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
