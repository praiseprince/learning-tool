import Link from "next/link";
import {goals} from "@/lib/v2/goals";
import {AppShell} from "@/components/v2/shell";
import {Thread} from "@/components/chat/thread";
import {Composer} from "@/components/chat/composer";
import {GoalPanel} from "@/components/chat/panel";
import {state} from "@/lib/chat/events";
import {PanelToggle} from "@/components/chat/panel-toggle";
import {ensureAgent} from "@/lib/agent/jobs";

export const dynamic = "force-dynamic";

export default async function Home({searchParams}: PageProps<"/">) {
  ensureAgent(); // closes jobs a restart cut short before anything reads "busy"
  const q = await searchParams, list = goals();
  const pick = typeof q.goal === "string" ? list.find(g => g.id === q.goal) : undefined, goal = pick ?? list[0];
  if (!goal) return <AppShell active="Chat"><div className="page page--read"><h1>Welcome</h1>
    <p className="standfirst">Tell me what you want to learn. I’ll ask a few questions, build a map of where you are, and plan each day with you.</p>
    <p style={{marginTop: 24}}><Link className="btn" href="/goals/new">Add your first goal</Link></p></div></AppShell>;
  return <AppShell active="Chat" hue={goal.hue} goal={goal.id} bare>
    <div className="chat-app">
      <section className="chat" aria-label="Chat">
        <div className="chat-scroll"><Thread goal={goal.id} /></div>
        <Composer goal={goal.id} busy={state(goal.id).busy} />
      </section>
      <PanelToggle label={goal.name}><GoalPanel goal={goal.id} /></PanelToggle>
    </div>
  </AppShell>;
}
