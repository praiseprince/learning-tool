"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireV2} from "@/lib/v2/access";
import {createGoal, keepBrief, reviseGoal} from "@/lib/v2/brief";
import {answer, correct, finish, fullText, loadState, pendingRevision, start} from "@/lib/v2/interview";

const field = (d: FormData, k: string, max = 12000) => String(d.get(k) ?? "").trim().slice(0, max);
async function guarded<T>(here: string, run: () => Promise<T>) {
  try { return await run(); } catch (e) { if (e && typeof e === "object" && "digest" in e) throw e; redirect(here + (here.includes("?") ? "&" : "?") + "failed=1"); }
}

export async function startNew(data: FormData) {
  requireV2();
  const text = field(data, "text");
  if (text.length < 8) redirect("/goals/new?short=1");
  const id = await guarded("/goals/new", () => start("new", null, text));
  redirect(`/goals/new/${id}`);
}
export async function startRevise(goal: string, data: FormData) {
  requireV2();
  const text = field(data, "text");
  if (text.length < 8) redirect(`/goals/${goal}/revise?short=1`);
  const id = await guarded(`/goals/${goal}/revise`, () => start("revise", goal, text));
  redirect(`/goals/${goal}/revise?step=${id}`);
}

function where(id: string) {
  const r = loadState(id);
  return r?.state.kind === "revise" ? `/goals/${r.state.goal}/revise?step=${id}` : `/goals/new/${id}`;
}
export async function answerTurn(id: string, data: FormData) {
  requireV2();
  const text = field(data, "text");
  if (text.length < 2) redirect(where(id) + (where(id).includes("?") ? "&" : "?") + "empty=1");
  await guarded(where(id), () => answer(id, text));
  redirect(where(id));
}
export async function enough(id: string) {
  requireV2();
  await guarded(where(id), () => finish(id));
  redirect(where(id));
}
export async function fixDraft(id: string, data: FormData) {
  requireV2();
  const text = field(data, "text");
  if (text.length < 2) redirect(where(id));
  await guarded(where(id), () => correct(id, text));
  redirect(where(id) + (where(id).includes("?") ? "&" : "?") + "fixed=1");
}
export async function confirm(id: string) {
  requireV2();
  const r = loadState(id);
  if (!r || r.status !== "pending" || !r.state.draft) redirect("/goals");
  const s = r.state;
  if (s.kind === "new") {
    createGoal(id, s.draft!); keepBrief(id, s.draft!.title, fullText(s));
    revalidatePath("/", "layout"); redirect(`/goals/${id}?created=1`);
  }
  reviseGoal(id, s.goal!, s.draft!, s.turns.slice(1).map(t => t.a).join("\n").slice(0, 1000) || s.turns[0].a);
  revalidatePath("/", "layout"); redirect(`/goals/${s.goal}?revised=1`);
}
export async function discard(id: string) {
  requireV2();
  const r = loadState(id); const goal = r?.state.goal;
  const {sqlite} = await import("@/lib/db/client");
  sqlite.prepare("UPDATE proposal SET status='dismissed',resolved_at=? WHERE id=? AND status='pending'").run(new Date().toISOString(), id);
  redirect(goal ? `/goals/${goal}` : "/goals");
}
export async function resumeRevision(goal: string) { requireV2(); const id = pendingRevision(goal); redirect(id ? `/goals/${goal}/revise?step=${id}` : `/goals/${goal}/revise`); }

/** Pausing or archiving hides a goal from Today, the Map and search. Nothing is deleted, and it can be resumed any time. */
export async function setGoalStatus(goal: string, status: "active" | "paused" | "archived") {
  requireV2();
  const {sqlite} = await import("@/lib/db/client");
  if (!["active", "paused", "archived"].includes(status)) throw Error("Unknown status.");
  sqlite.prepare("UPDATE journey SET status=? WHERE id=?").run(status, goal);
  revalidatePath("/", "layout");
  redirect(status === "active" ? `/goals/${goal}` : "/goals");
}

/** Deletes an archived goal and everything in it. A copy of the database and its files is kept beside the database. */
export async function deleteGoalForGood(goal: string): Promise<{error?: string}> {
  requireV2();
  const {deleteGoal} = await import("@/lib/v2/delete-goal");
  const r = deleteGoal(goal); if (!r.ok) return {error: r.error};
  revalidatePath("/", "layout"); return {};
}
