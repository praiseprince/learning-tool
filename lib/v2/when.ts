import {differenceInCalendarDays, format} from "date-fns";

/** "today", "yesterday", "3 days ago", then a plain date. Takes YYYY-MM-DD or an ISO time. */
export function ago(day: string | null | undefined, now = new Date()): string {
  if (!day) return "";
  const d = new Date(day.length === 10 ? day + "T12:00" : day); if (Number.isNaN(d.getTime())) return "";
  const n = differenceInCalendarDays(now, d);
  return n <= 0 ? "today" : n === 1 ? "yesterday" : n < 7 ? `${n} days ago` : format(d, d.getFullYear() === now.getFullYear() ? "d MMM" : "d MMM yyyy");
}
export const dayLabel = (day: string) => { const d = new Date(day + "T12:00"); return Number.isNaN(d.getTime()) ? day : format(d, "EEE d MMM"); };
