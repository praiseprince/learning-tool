"use client";
import {useTransition} from "react";
import {useRouter} from "next/navigation";
import {quick} from "@/app/chat-actions";

/** Starts a Guide task from outside the chat, then takes you to the chat to watch it. */
export function GuideButton({goal, kind, label, quiet = true}: {goal: string; kind: "research" | "week" | "quiz" | "plan" | "practice"; label: string; quiet?: boolean}) {
  const router = useRouter(), [pending, go] = useTransition();
  return <button type="button" className={"btn btn--sm" + (quiet ? " btn--quiet" : "")} disabled={pending} onClick={() => go(async () => { await quick(goal, kind); router.push(`/?goal=${goal}`); })}>{pending ? "Starting…" : label}</button>;
}
export function FindButton({goal}: {goal: string}) { return <GuideButton goal={goal} kind="research" label="Find materials" />; }
