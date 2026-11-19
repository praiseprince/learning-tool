import {sqlite} from "../db/client.ts";
import {nextDays, Week} from "./tasks.ts";

export type WeekDay = {date: string; minutes: number; focus: string; why: string};
export type WeekPlan = {id: string; review: string; days: WeekDay[]; status: string};

const read = (r: {id: string; diff_json: string; status: string} | undefined): WeekPlan | null => {
  if (!r) return null;
  try { const p = Week.pick({review: true, days: true}).safeParse(JSON.parse(r.diff_json)); return p.success ? {id: r.id, status: r.status, ...p.data} : null; } catch { return null; }
};

export function weekById(goal: string, id: unknown): WeekPlan | null {
  if (typeof id !== "string") return null;
  return read(sqlite.prepare("SELECT id,diff_json,status FROM proposal WHERE id=? AND journey_id=? AND kind='week_plan'").get(id, goal) as {id: string; diff_json: string; status: string} | undefined);
}

/** The week plan the learner accepted most recently that still has today or a later day in it. */
export function currentWeek(goal: string): WeekPlan | null {
  const today = nextDays(1)[0];
  const rows = sqlite.prepare("SELECT id,diff_json,status FROM proposal WHERE journey_id=? AND kind='week_plan' AND status='accepted' ORDER BY resolved_at DESC LIMIT 4").all(goal) as {id: string; diff_json: string; status: string}[];
  for (const r of rows) { const w = read(r); if (w && w.days.some(d => d.date >= today)) return w; }
  return null;
}

export function todaySlot(goal: string): WeekDay | null {
  const today = nextDays(1)[0];
  return currentWeek(goal)?.days.find(d => d.date === today) ?? null;
}

/** Accepting a week replaces any earlier accepted week for this goal. */
export function acceptWeek(goal: string, id: string) {
  const now = new Date().toISOString();
  sqlite.transaction(() => {
    const ok = sqlite.prepare("UPDATE proposal SET status='accepted',resolved_at=? WHERE id=? AND journey_id=? AND kind='week_plan' AND status='pending'").run(now, id, goal).changes;
    if (!ok) throw Error("That week plan was already handled.");
    sqlite.prepare("UPDATE proposal SET status='superseded' WHERE journey_id=? AND kind='week_plan' AND status='accepted' AND id!=?").run(goal, id);
  })();
}

/** Dates in the week that already have a logged session, so the plan can show what was done. */
export function doneDays(goal: string, dates: string[]): Set<string> {
  if (!dates.length) return new Set();
  const rows = sqlite.prepare(`SELECT DISTINCT occurred_on FROM log_entry WHERE journey_id=? AND occurred_on IN (${dates.map(() => "?").join(",")})`).all(goal, ...dates) as {occurred_on: string}[];
  return new Set(rows.map(r => r.occurred_on));
}
