// What happens to a message once it is in the thread. A message that needs the Guide while it is busy waits in the
// thread ("queued") and goes the moment the running job ends, like typing ahead in Claude Code or Codex.
import {sqlite} from "../db/client.ts";
import {runningJob, startJob} from "../agent/jobs.ts";
import {todaySlot} from "../agent/week.ts";
import {addEvent, events, updateEvent} from "./events.ts";
import {classify, logEntry, runPlan, withFiles} from "./run.ts";
import {sharedFrom, type Shared} from "./files.ts";

export type Quick = "plan" | "research" | "practice" | "week" | "quiz";
/** `task` names the job directly (from a button, not words). */
export type Message = {text: string; files?: Shared[]; quick?: Quick; task?: {kind: "week" | "quiz"; text: string}};
export const QUICK_TEXT: Record<Quick, string> = {plan: "What should I do today?", week: "Plan my week.", quiz: "Quiz me on what I've learned.", research: "Find me materials to learn from.", practice: "Make me some practice material."};

/** The last few messages, for questions (the whole chat is in context/conversation.md). */
export function history(goal: string) {
  return events(goal, 24).filter(e => e.status !== "queued" && e.status !== "withdrawn").filter(e => (e.kind === "user" || e.kind === "guide") && e.payload.text !== undefined || e.kind === "guide").slice(-8)
    .map(e => ({role: e.kind === "user" ? "user" as const : "guide" as const, text: String(e.payload.text ?? e.payload.markdown ?? "").slice(0, 1500)}));
}
export function agent(goal: string, kind: Parameters<typeof startJob>[1], input: Parameters<typeof startJob>[2]) {
  const id = startJob(goal, kind, input); addEvent(goal, "job", {job: id, kind}, "working");
}
export function plan(goal: string, minutes: number, note: string) {
  const seq = addEvent(goal, "working", {label: `Planning ${minutes} minutes`}, "working");
  void runPlan(goal, minutes, note, seq);
}

/** Whether acting on the message starts a Guide job (plans and logs do not, so they never wait). */
function needsGuide(m: Message) {
  if (m.files?.length || m.task) return true;
  if (m.quick) return m.quick !== "plan";
  const k = classify(m.text).kind; return k === "ask" || k === "week" || k === "quiz" || k === "practice";
}

/** Puts the learner's message in the thread and acts on it, or lets it wait while the Guide is busy. */
export function post(goal: string, m: Message) {
  const wait = needsGuide(m) && !!runningJob(goal);
  addEvent(goal, "user", {text: m.text, ...(m.files?.length ? {files: m.files} : {}), ...(m.quick ? {quick: m.quick} : {}), ...(m.task ? {task: m.task} : {})}, wait ? "queued" : "done");
  if (!wait) act(goal, m);
  return {queued: wait};
}

function act(goal: string, m: Message) {
  const msg = m.text;
  if (m.task) { agent(goal, m.task.kind, {text: m.task.text}); return; }
  if (m.quick) {
    if (m.quick === "plan") { const t = todaySlot(goal); if (t && t.minutes > 0) plan(goal, t.minutes, `Today's slot in my week plan: ${t.focus}.`); else addEvent(goal, "minutes", {note: ""}); }
    else agent(goal, m.quick, {text: ""});
    return;
  }
  if (m.files?.length) {
    const kind = withFiles(msg), attachments = m.files.map(f => ({name: f.name, path: `inbox/${f.stored}`, text: f.text ? `inbox/${f.text}` : undefined, type: f.type}));
    agent(goal, kind, {text: msg, files: m.files.map(f => f.stored), attachments, ...(kind === "ask" ? {history: history(goal)} : {})});
    return;
  }
  const intent = classify(msg), mins = msg.match(/\b(\d{1,3})\s*(?:min|minutes)\b/i);
  if (intent.kind === "plan") { if (intent.minutes) plan(goal, intent.minutes, msg); else addEvent(goal, "minutes", {note: msg}); }
  else if (intent.kind === "log") addEvent(goal, "log", {entry: logEntry(goal, msg, mins ? Number(mins[1]) : null), minutes: null});
  else if (intent.kind === "week" || intent.kind === "quiz" || intent.kind === "practice") agent(goal, intent.kind, {text: msg});
  else agent(goal, "ask", {text: msg, history: history(goal)});
}

/** Sends the oldest waiting message once the Guide is free. Called whenever a job ends. */
export function drainQueue(goal: string) {
  for (let guard = 0; guard < 20 && !runningJob(goal); guard++) {
    const r = sqlite.prepare("SELECT seq,payload_json FROM chat_event WHERE goal=? AND kind='user' AND status='queued' ORDER BY seq LIMIT 1").get(goal) as {seq: number; payload_json: string} | undefined;
    if (!r) return;
    const p = JSON.parse(r.payload_json); updateEvent(r.seq, "user", p, "done");
    try { act(goal, {text: String(p.text ?? ""), files: sharedFrom(p).filter(f => f.stored), quick: p.quick, task: p.task}); }
    catch { addEvent(goal, "guide", {markdown: "I couldn't start on your waiting message. Your data is unchanged.", tone: "error"}); }
  }
}
/** The learner takes back a message that has not been sent yet. */
export function withdraw(goal: string, seq: number) {
  sqlite.prepare("UPDATE chat_event SET status='withdrawn' WHERE seq=? AND goal=? AND kind='user' AND status='queued'").run(seq, goal);
}
