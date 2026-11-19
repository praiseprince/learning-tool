import {addDays, differenceInCalendarDays, format, startOfWeek, subDays} from "date-fns";
import {sqlite} from "@/lib/db/client";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
export type GoalStat = {id: string; name: string; hue: number; skills: number; levels: number[]; average: number; evidenced: number; minutes30: number; sessions30: number; sessions: number; last: string | null; weekly: number[]};
export type Mover = {skill: string; node: string; goal: string; hue: number; from: number; to: number};
export type Due = {id: string; node: string; name: string; goal: string; goalName: string; hue: number; level: number; days: number};

/** Every figure here is a count of recorded sessions and skill events. No invented scores. */
export function stats(weekStartsOn: 0 | 1) {
  const today = new Date(), weeks = 12, thisWeek = startOfWeek(today, {weekStartsOn}), first = subDays(thisWeek, 7 * (weeks - 1));
  const rows = sqlite.prepare(`SELECT e.occurred_on AS d,e.journey_id AS j,COALESCE(t.minutes,e.minutes,0) AS m
    FROM log_entry e LEFT JOIN entry_time t ON t.entry_id=e.id JOIN journey g ON g.id=e.journey_id
    WHERE e.kind='practice' AND e.occurred_on>=?`).all(iso(first)) as {d: string; j: string; m: number}[];
  const goals = sqlite.prepare("SELECT id,name,hue FROM journey WHERE status='active' ORDER BY name COLLATE NOCASE").all() as {id: string; name: string; hue: number}[];
  const active = new Set(goals.map(g => g.id));

  const days = Array.from({length: weeks * 7}, (_, i) => ({date: iso(addDays(first, i)), minutes: 0, sessions: 0}));
  const byDate = new Map(days.map(d => [d.date, d]));
  const week = (d: string) => Math.min(weeks - 1, Math.max(0, Math.floor(differenceInCalendarDays(new Date(d + "T12:00:00"), first) / 7)));
  const per = Array.from({length: weeks}, () => ({minutes: 0, sessions: 0, days: new Set<string>()}));
  const perGoal = new Map<string, number[]>();
  const weekday = [0, 0, 0, 0, 0, 0, 0]; // minutes by Monday..Sunday
  for (const r of rows) {
    if (!active.has(r.j)) continue;
    const day = byDate.get(r.d); if (!day) continue;
    day.minutes += r.m; day.sessions++;
    const w = week(r.d); per[w].minutes += r.m; per[w].sessions++; per[w].days.add(r.d);
    const arr = perGoal.get(r.j) ?? Array(weeks).fill(0); arr[w] += r.m; perGoal.set(r.j, arr);
    weekday[(new Date(r.d + "T12:00:00").getDay() + 6) % 7] += r.m;
  }
  const cutoff = iso(subDays(today, 30));
  const perGoalStats: GoalStat[] = goals.map(g => {
    const sk = sqlite.prepare("SELECT s.level,(SELECT COUNT(*) FROM skill_event e WHERE e.skill_id=s.id) AS ev FROM skill s WHERE s.journey_id=? AND s.archived=0").all(g.id) as {level: number; ev: number}[];
    const levels = [0, 0, 0, 0, 0, 0]; for (const s of sk) levels[Math.max(0, Math.min(5, s.level))]++;
    const all = sqlite.prepare("SELECT COUNT(*) AS n,MAX(occurred_on) AS last FROM log_entry WHERE journey_id=? AND kind='practice'").get(g.id) as {n: number; last: string | null};
    const recent = rows.filter(r => r.j === g.id && r.d >= cutoff);
    return {...g, skills: sk.length, levels, average: sk.length ? sk.reduce((a, s) => a + s.level, 0) / sk.length : 0, evidenced: sk.filter(s => s.ev > 0).length,
      minutes30: recent.reduce((a, r) => a + r.m, 0), sessions30: recent.length, sessions: all.n, last: all.last, weekly: perGoal.get(g.id) ?? Array(weeks).fill(0)};
  });

  const since = subDays(today, 30).toISOString();
  const movers = (sqlite.prepare(`SELECT s.name AS skill,'legacy-'||s.id AS node,j.id AS goal,j.hue,MIN(v.level_after-v.delta) AS from_l,MAX(v.level_after) AS to_l
    FROM skill_event v JOIN skill s ON s.id=v.skill_id JOIN journey j ON j.id=s.journey_id
    WHERE v.at>=? AND j.status='active' AND v.delta>0 GROUP BY s.id ORDER BY (MAX(v.level_after)-MIN(v.level_after-v.delta)) DESC,MAX(v.at) DESC LIMIT 8`).all(since) as {skill: string; node: string; goal: string; hue: number; from_l: number; to_l: number}[])
    .map(m => ({skill: m.skill, node: m.node, goal: m.goal, hue: m.hue, from: m.from_l, to: m.to_l}) as Mover);

  const cur = per[weeks - 1], prev = per[weeks - 2];
  const total = days.reduce((a, d) => a + d.minutes, 0);
  return {days, weeks, cur: {...cur, days: cur.days.size}, prev: {...prev, days: prev.days.size}, series: per.map(p => p.minutes), perGoal: perGoalStats, weekday, movers, total, activeDays: days.filter(d => d.minutes > 0).length};
}

/** Skills you reached level 1+ in, with no new evidence for `after` days. These are worth a gentle revisit, not a failure. */
export function dueSkills(goal?: string, after = 21, limit = 6): Due[] {
  const rows = sqlite.prepare(`SELECT s.id,'legacy-'||s.id AS node,s.name,s.level,s.journey_id AS goal,j.name AS goalName,j.hue,
    COALESCE((SELECT MAX(at) FROM skill_event e WHERE e.skill_id=s.id),s.updated_at) AS last
    FROM skill s JOIN journey j ON j.id=s.journey_id WHERE s.archived=0 AND s.level>=2 AND j.status='active' AND (?='' OR s.journey_id=?)`).all(goal ?? "", goal ?? "") as {id: string; node: string; name: string; level: number; goal: string; goalName: string; hue: number; last: string}[];
  const now = new Date();
  return rows.map(r => ({id: r.id, node: r.node, name: r.name, goal: r.goal, goalName: r.goalName, hue: r.hue, level: r.level, days: differenceInCalendarDays(now, new Date(r.last))}))
    .filter(r => r.days >= after).sort((a, b) => b.level - a.level || b.days - a.days).slice(0, limit);
}

/** A plain-language account of the last 7 days, written only from what was recorded. */
export function weeklyNote(weekStartsOn: 0 | 1) {
  const s = stats(weekStartsOn), start = startOfWeek(new Date(), {weekStartsOn}), from = iso(subDays(start, 7)), to = iso(subDays(start, 1));
  const last = sqlite.prepare(`SELECT COUNT(*) AS n,COUNT(DISTINCT occurred_on) AS days,COALESCE(SUM(COALESCE(t.minutes,e.minutes,0)),0) AS m FROM log_entry e LEFT JOIN entry_time t ON t.entry_id=e.id
    WHERE e.kind='practice' AND e.occurred_on BETWEEN ? AND ?`).get(from, to) as {n: number; days: number; m: number};
  const before = sqlite.prepare(`SELECT COALESCE(SUM(COALESCE(t.minutes,e.minutes,0)),0) AS m FROM log_entry e LEFT JOIN entry_time t ON t.entry_id=e.id
    WHERE e.kind='practice' AND e.occurred_on BETWEEN ? AND ?`).get(iso(subDays(start, 14)), iso(subDays(start, 8))) as {m: number};
  const up = sqlite.prepare(`SELECT s.name,MIN(v.level_after-v.delta) AS a,MAX(v.level_after) AS b FROM skill_event v JOIN skill s ON s.id=v.skill_id JOIN journey j ON j.id=s.journey_id
    WHERE j.status='active' AND v.delta>0 AND substr(v.at,1,10) BETWEEN ? AND ? GROUP BY s.id ORDER BY MAX(v.level_after) DESC LIMIT 4`).all(from, to) as {name: string; a: number; b: number}[];
  const stuck = sqlite.prepare(`SELECT raw_text FROM log_entry WHERE kind='practice' AND occurred_on BETWEEN ? AND ? AND (raw_text LIKE '%did not get there yet%' OR raw_text LIKE '%still%' OR raw_text LIKE '%stuck%' OR raw_text LIKE '%struggl%') ORDER BY occurred_on DESC LIMIT 2`).all(from, to) as {raw_text: string}[];
  const quiet = s.perGoal.filter(g => g.sessions > 0 && (!g.last || differenceInCalendarDays(new Date(), new Date(g.last + "T12:00:00")) >= 10)).map(g => g.name).slice(0, 3);
  return {range: `${format(new Date(from + "T12:00:00"), "d MMM")} to ${format(new Date(to + "T12:00:00"), "d MMM")}`, last, delta: last.m - before.m, up, stuck: stuck.map(x => x.raw_text.split("\n").find(l => /did not get there yet|still|stuck|struggl/i.test(l)) ?? x.raw_text).map(t => t.replace(/\s*\(\d+ min\):.*$/, "").slice(0, 140)), quiet, hasData: last.n > 0};
}
