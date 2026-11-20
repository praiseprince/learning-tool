import {randomUUID} from "node:crypto";
import {format} from "date-fns";
import {sqlite} from "../db/client.ts";
import {draftPlan, storePlan} from "../db/plans.ts";
import {goalDetail} from "../v2/goals.ts";
import {dueSkills} from "../v2/stats.ts";
import {materials} from "../v2/materials.ts";
import {addEvent, marks, updateEvent} from "./events.ts";
import {todaySlot} from "../agent/week.ts";

export type Intent = {kind: "plan"; minutes: number | null} | {kind: "log"} | {kind: "ask"} | {kind: "week"} | {kind: "quiz"} | {kind: "practice"};

/** Reads a plain message and decides what the learner wants. Anything unclear goes to the Guide as a question. */
export function classify(text: string): Intent {
  const t = text.trim(), lower = t.toLowerCase();
  const min = lower.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?|m)\b/), hr = lower.match(/\b(\d(?:\.\d)?)\s*(?:h|hr|hrs|hours?)\b/);
  const minutes = min ? Number(min[1]) : hr ? Math.round(Number(hr[1]) * 60) : null;
  if (/\b(plan|schedule|organi[sz]e|map out)\b.{0,20}\b(my |the |this |next )?week\b|\bweek(ly)? plan\b/.test(lower)) return {kind: "week"};
  if (/^(quiz|test) me\b|\b(quiz|test) me (on|about)\b|\bflash ?cards?\b|\b(retrieval|recall) practice\b/.test(lower)) return {kind: "quiz"};
  if (/\b(make|write|create|give|generate)\b.{0,20}\b(practice|exercises?|worksheet|drills?|problems?)\b/.test(lower)) return {kind: "practice"};
  if (/^(i\s+|just\s+|today\s+i\s+|so far\s+i\s+)?(practi[sc]ed|practiced|did|played|ran|read|worked on|studied|finished|completed|sang|wrote|drilled|spent|tried|went)\b/.test(lower) || /^log\b/.test(lower)) return {kind: "log"};
  if (/\b(plan|what should i do|what do i do|what now|what'?s next|what next|session)\b/.test(lower) || (minutes && /\b(have|got|only|spare|free|today|tonight|window)\b/.test(lower))) return {kind: "plan", minutes: minutes && minutes >= 5 && minutes <= 240 ? minutes : null};
  return {kind: "ask"};
}

/** What to do with a message that comes with files: feedback on work by default, or whatever the words ask for. */
export function withFiles(text: string): "review" | "ask" | "quiz" | "practice" | "week" {
  const lower = text.trim().toLowerCase();
  if (!lower) return "review";
  const i = classify(text);
  if (i.kind === "quiz" || i.kind === "practice" || i.kind === "week") return i.kind;
  if (i.kind === "log" || i.kind === "plan") return "review";
  if (/\b(feedback|review|critique|mark|grade|assess|correct(ions)?|improve|how did i do|how (is|was|does) (my|this)|what do you think|thoughts on|check (my|this)|my (work|essay|draft|drawing|sketch|attempt|answers?|solution|code|homework|recording|writing|translation|exercise))\b/.test(lower)) return "review";
  return "ask";
}

/** Builds the daily plan in the background and swaps the "working" card for the plan when it is ready. */
export async function runPlan(goal: string, minutes: number, note: string, seq: number) {
  try {
    const d = goalDetail(goal); if (!d) throw Error("Goal not found.");
    const step = d.steps[d.current], due = dueSkills(goal, 21, 3);
    const context = [
      d.goal.position && `Where the learner is: ${d.goal.position}`, step && `Current roadmap phase: ${step.title}. ${step.reason}`,
      d.charter?.constraints && `Constraints: ${d.charter.constraints}`,
      due.length > 0 && `Skills not practised for 3+ weeks (consider a short revisit if it fits the time): ${due.map(x => x.name).join(", ")}`,
      (() => { const t = todaySlot(goal); return t && t.minutes > 0 ? `The learner's accepted week plan says today: ${t.focus} (${t.minutes} min). ${t.why}` : null; })(),
      note && `The learner says today: ${note}`,
    ].filter(Boolean).join("\n");
    const plan = await draftPlan(goal, minutes, "", context, step?.skillId, materials(goal));
    const id = sqlite.transaction(() => storePlan(goal, plan, "chat"))();
    updateEvent(seq, "plan", {plan: id});
  } catch {
    updateEvent(seq, "guide", {markdown: "I couldn't plan that just now. Your goal and map are safe. Try again in a moment.", tone: "error"});
  }
}

const SAID: Record<string, string> = {got: "I got it", part: "I got part of it", not: "I did not get there yet"};
/** Turns a marked plan (and an optional note) into a logged session, then queues the Guide to read it. */
export function saveSession(goal: string, planId: string, note: string): string | null {
  const row = sqlite.prepare("SELECT diff_json FROM proposal WHERE id=? AND journey_id=?").get(planId, goal) as {diff_json: string} | undefined; if (!row) return null;
  const plan = JSON.parse(row.diff_json) as {blocks: {title: string; minutes: number}[]}, m = marks(planId);
  const lines = plan.blocks.map((b, i) => m[i] ? `${b.title} (${b.minutes} min): ${SAID[m[i]]}.` : null).filter(Boolean) as string[];
  const text = [lines.join("\n"), note.trim().slice(0, 4000)].filter(Boolean).join("\n\n"); if (!text) return null;
  const minutes = plan.blocks.reduce((s, b, i) => s + (m[i] ? b.minutes : 0), 0) || null, entry = logEntry(goal, text, minutes);
  sqlite.prepare("UPDATE plan_item SET status='finished' WHERE id=? AND journey_id=?").run(planId, goal);
  addEvent(goal, "log", {entry, minutes});
  return entry;
}
export function logEntry(goal: string, text: string, minutes: number | null): string {
  const now = new Date(), entry = randomUUID();
  sqlite.transaction(() => {
    sqlite.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,energy,kind,occurred_on,created_at) VALUES (?,?,?,?,NULL,'practice',?,?)").run(entry, goal, text.slice(0, 8000), minutes, format(now, "yyyy-MM-dd"), now.toISOString());
    sqlite.prepare("INSERT OR IGNORE INTO log_extraction VALUES (?,'queued',NULL,?)").run(entry, now.toISOString());
    sqlite.prepare("UPDATE journey SET last_seen_at=? WHERE id=?").run(now.toISOString(), goal);
  })();
  return entry;
}
