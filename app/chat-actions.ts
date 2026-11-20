"use server";
import {randomUUID} from "node:crypto";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireV2} from "@/lib/v2/access";
import {sqlite} from "@/lib/db/client";
import {goalDetail} from "@/lib/v2/goals";
import {updateMaterial} from "@/lib/v2/materials";
import {accept, dismiss, pending} from "@/lib/agent/accept";
import {runningJob, startJob} from "@/lib/agent/jobs";
import {addEvent, events, updateEvent} from "@/lib/chat/events";
import {acceptWeek, todaySlot, weekById} from "@/lib/agent/week";
import {storeDocument} from "@/lib/v2/notebook";
import {classify, logEntry, runPlan, saveSession, withFiles} from "@/lib/chat/run";
import {saveShared, type Shared} from "@/lib/chat/files";

const text = (d: FormData, k: string, n = 6000) => String(d.get(k) ?? "").trim().slice(0, n);
const done = () => revalidatePath("/", "layout");
const known = (goal: string) => { if (!goalDetail(goal)) throw Error("Goal not found."); };

function history(goal: string) {
  return events(goal, 24).filter(e => (e.kind === "user" || e.kind === "guide") && e.payload.text !== undefined || e.kind === "guide").slice(-8)
    .map(e => ({role: e.kind === "user" ? "user" as const : "guide" as const, text: String(e.payload.text ?? e.payload.markdown ?? "").slice(0, 1500)}));
}
/** Starts an agent run and shows its progress in the thread. If one is already running, says so instead of queueing a second. */
function agent(goal: string, kind: "ask" | "research" | "review" | "practice" | "week" | "quiz", input: Parameters<typeof startJob>[2]) {
  if (runningJob(goal)) { addEvent(goal, "guide", {markdown: "I'm still working on your last request. Give me a moment, then ask again."}); return; }
  const id = startJob(goal, kind, input); addEvent(goal, "job", {job: id, kind}, "working");
}
function plan(goal: string, minutes: number, note: string) {
  const seq = addEvent(goal, "working", {label: `Planning ${minutes} minutes`}, "working");
  void runPlan(goal, minutes, note, seq);
}

/** One message box for everything: it works out whether you want a plan, are logging practice, sharing work, or asking something. */
export async function send(goal: string, data: FormData) {
  requireV2(); known(goal);
  const msg = text(data, "text", 4000), files = (data.getAll("files") as File[]).filter(f => f && typeof f === "object" && f.size > 0);
  if (!msg && !files.length) return {error: "Write something first."};
  if (files.length) {
    if (runningJob(goal)) return {error: "The Guide is still working on your last request. Send these when it has finished."};
    let shared: Shared[]; try { shared = await saveShared(goal, files); } catch (e) { return {error: (e as Error).message}; }
    const kind = withFiles(msg), attachments = shared.map(f => ({name: f.name, path: `inbox/${f.stored}`, text: f.text ? `inbox/${f.text}` : undefined, type: f.type}));
    addEvent(goal, "user", {text: msg, files: shared});
    agent(goal, kind, {text: msg, files: shared.map(f => f.stored), attachments, ...(kind === "ask" ? {history: history(goal)} : {})}); done(); return {};
  }
  addEvent(goal, "user", {text: msg});
  const intent = classify(msg);
  if (intent.kind === "plan") { if (intent.minutes) plan(goal, intent.minutes, msg); else addEvent(goal, "minutes", {note: msg}); }
  else if (intent.kind === "log") { const entry = logEntry(goal, msg, (msg.match(/\b(\d{1,3})\s*(?:min|minutes)\b/i) ? Number(msg.match(/\b(\d{1,3})\s*(?:min|minutes)\b/i)![1]) : null)); addEvent(goal, "log", {entry, minutes: null}); }
  else if (intent.kind === "week" || intent.kind === "quiz" || intent.kind === "practice") agent(goal, intent.kind, {text: msg});
  else agent(goal, "ask", {text: msg, history: history(goal)});
  done(); return {};
}
export async function quick(goal: string, kind: "plan" | "research" | "practice" | "week" | "quiz") {
  requireV2(); known(goal);
  if (kind === "plan") { addEvent(goal, "user", {text: "What should I do today?"}); const t = todaySlot(goal); if (t && t.minutes > 0) plan(goal, t.minutes, `Today's slot in my week plan: ${t.focus}.`); else addEvent(goal, "minutes", {note: ""}); }
  else if (kind === "week") { addEvent(goal, "user", {text: "Plan my week."}); agent(goal, "week", {text: ""}); }
  else if (kind === "quiz") { addEvent(goal, "user", {text: "Quiz me on what I've learned."}); agent(goal, "quiz", {text: ""}); }
  else if (kind === "research") { addEvent(goal, "user", {text: "Find me materials to learn from."}); agent(goal, "research", {text: ""}); }
  else { addEvent(goal, "user", {text: "Make me some practice material."}); agent(goal, "practice", {text: ""}); }
  done();
}
export async function pickMinutes(goal: string, minutes: number, note: string) {
  requireV2(); known(goal);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) return;
  addEvent(goal, "user", {text: `${minutes} minutes${note && note.length < 80 ? ": " + note : ""}`}); plan(goal, minutes, note); done();
}
export async function mark(planId: string, idx: number, result: string) {
  requireV2();
  if (!["got", "part", "not"].includes(result)) return;
  sqlite.prepare("INSERT OR REPLACE INTO plan_mark VALUES (?,?,?)").run(planId, idx, result);
}
export async function finish(goal: string, planId: string, note: string, pointers: Record<string, string> = {}) {
  requireV2(); known(goal);
  for (const [id, ptr] of Object.entries(pointers)) if (ptr.trim()) { try { updateMaterial(goal, id, {pointer: ptr.trim().slice(0, 140)}); } catch { /* removed */ } }
  saveSession(goal, planId, note.slice(0, 4000)); done();
}
export async function acceptInline(goal: string, id: string): Promise<{go?: string}> {
  requireV2(); known(goal);
  const p = pending(goal).find(x => x.id === id); let go: string | undefined;
  try {
    const {next} = accept(id);
    if (p?.kind === "agent_material") addEvent(goal, "guide", {markdown: `Added *${p.payload.suggestion.title}* to your materials.`});
    else if (p?.kind === "agent_evidence") addEvent(goal, "guide", {markdown: `Added that as evidence for **${p.payload.skillName}**.`});
    else if (p?.payload?.type === "add_note") addEvent(goal, "note", {doc: next.split("/").pop(), title: p.payload.title});
    else if (p?.payload?.type === "add_material") addEvent(goal, "guide", {markdown: `Added *${p.payload.title}* to your materials.`});
    else if (p?.payload?.type === "plan_today") addEvent(goal, "minutes", {note: p.payload.body || p.payload.title});
    else go = next;
  } catch { /* already handled */ }
  done(); return {go};
}
export async function dismissInline(goal: string, id: string) { requireV2(); dismiss(id); done(); }
export async function savePointer(goal: string, id: string, data: FormData) {
  requireV2(); try { updateMaterial(goal, id, {pointer: text(data, "pointer", 140)}); } catch { /* removed */ } done();
}
export async function cancelJobInline(goal: string, id: string) {
  requireV2(); const {cancelJob} = await import("@/lib/agent/jobs"); cancelJob(id);
  addEvent(goal, "guide", {markdown: "Stopped."}); done();
}

/** The learner accepts a drafted week; it then shapes "Plan today" and shows in the goal panel. */
export async function acceptWeekInline(goal: string, id: string) {
  requireV2(); known(goal);
  try { acceptWeek(goal, id); addEvent(goal, "guide", {markdown: "Week saved. **Plan today** now starts from today's slot."}); } catch { /* already handled */ }
  done();
}
export async function dismissWeekInline(goal: string, id: string) {
  requireV2(); known(goal);
  sqlite.prepare("UPDATE proposal SET status='dismissed',resolved_at=? WHERE id=? AND journey_id=? AND kind='week_plan' AND status='pending'").run(new Date().toISOString(), id, goal);
  done();
}
export async function redoWeek(goal: string, id: string, note: string) {
  requireV2(); known(goal);
  if (!weekById(goal, id)) return;
  sqlite.prepare("UPDATE proposal SET status='dismissed',resolved_at=? WHERE id=? AND journey_id=? AND status='pending'").run(new Date().toISOString(), id, goal);
  const n = note.trim().slice(0, 600); addEvent(goal, "user", {text: n ? `Plan the week again: ${n}` : "Plan the week again, differently."}); agent(goal, "week", {text: n || "Make it different from the last draft."}); done();
}

/** A finished quiz becomes an ordinary session, so what was recalled and missed reaches the skills through the usual review. */
export async function finishQuiz(goal: string, seq: number, results: ("got" | "not")[]) {
  requireV2(); known(goal);
  const ev = sqlite.prepare("SELECT payload_json FROM chat_event WHERE seq=? AND goal=? AND kind='quiz'").get(seq, goal) as {payload_json: string} | undefined; if (!ev) return;
  const p = JSON.parse(ev.payload_json) as {title: string; questions: {q: string; skill: string}[]; results?: string[]}; if (p.results) return;
  const r = p.questions.map((_, i) => results[i] === "got" ? "got" : "not"), got = r.filter(x => x === "got").length;
  const lines = p.questions.map((q, i) => `- ${r[i] === "got" ? "Recalled" : "Could not recall yet"}: ${q.q}${q.skill ? ` (${q.skill})` : ""}`);
  const entry = logEntry(goal, `Quiz: ${p.title}. I recalled ${got} of ${p.questions.length}.\n${lines.join("\n")}`, null);
  updateEvent(seq, "quiz", {...p, results: r, entry}); addEvent(goal, "log", {entry, minutes: null}); done();
}

/** Keeps a Guide answer in the notebook, so the knowledge base grows from conversations too. */
export async function saveAnswer(goal: string, seq: number): Promise<{doc?: string}> {
  requireV2(); known(goal);
  const ev = sqlite.prepare("SELECT payload_json FROM chat_event WHERE seq=? AND goal=? AND kind='guide'").get(seq, goal) as {payload_json: string} | undefined; if (!ev) return {};
  const p = JSON.parse(ev.payload_json) as {markdown?: string; sources?: {kind: string; ref: string; quote: string}[]; saved?: string}; if (p.saved) return {doc: p.saved};
  const q = sqlite.prepare("SELECT payload_json FROM chat_event WHERE goal=? AND kind='user' AND seq<? ORDER BY seq DESC LIMIT 1").get(goal, seq) as {payload_json: string} | undefined;
  const asked = q ? String(JSON.parse(q.payload_json).text ?? "").trim() : "";
  const md = String(p.markdown ?? ""), heading = md.match(/^#{1,3}\s+(.+)$/m)?.[1] ?? "";
  const first = (md.replace(/[#*_`>|]/g, "").split("\n").find(l => l.trim()) ?? "").split(/(?<=[.?!])\s/)[0];
  const ask = asked.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim(), cut = (t: string) => t.length > 90 ? t.slice(0, 88).replace(/\s+\S*$/, "") + "…" : t;
  const title = cut((heading || (ask.length >= 12 ? ask : "") || first || "From the Guide").replace(/\s+/g, " ").trim());
  const body = [asked ? `> ${asked.replace(/\n/g, "\n> ")}\n` : "", md, p.sources?.length ? "\n## Based on\n" + p.sources.map(s => `- ${s.ref}${s.quote ? `: “${s.quote}”` : ""}`).join("\n") : ""].filter(Boolean).join("\n");
  const doc = randomUUID(); storeDocument({id: doc, base: null, title, body, kind: "note", journey: goal, author: "ai"});
  updateEvent(seq, "guide", {...p, saved: doc}); done(); return {doc};
}

/** From a note: quiz on it in that goal's conversation. */
export async function fromNote(docId: string, kind: "quiz") {
  requireV2();
  const d = sqlite.prepare("SELECT title,journey_id FROM document WHERE id=? AND status='active'").get(docId) as {title: string; journey_id: string | null} | undefined;
  if (!d?.journey_id || !goalDetail(d.journey_id)) return;
  const goal = d.journey_id, t = d.title.slice(0, 160);
  addEvent(goal, "user", {text: `Quiz me on my note “${t}”.`}); agent(goal, kind, {text: `Quiz only on the note titled "${t}" in context/notes/.`});
  done(); redirect(`/?goal=${goal}#thread-end`);
}
