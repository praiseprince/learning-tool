import {sqlite} from "../db/client.ts";

export const LEVELS = ["Not started", "Just starting", "Learning", "Working", "Solid", "Fluent"];
export type GoalRow = {id: string; name: string; hue: number; status: string; goal: string; position: string; last: string | null; sessions: number};
export type Step = {title: string; reason: string; approach: string; skill: string; skillId: string; level: number};

export function goals(all = false): GoalRow[] {
  return sqlite.prepare(`SELECT j.id,j.name,j.hue,j.status,coalesce(c.goal,'') AS goal,
    coalesce((SELECT summary FROM state_snapshot WHERE journey_id=j.id ORDER BY created_at DESC,rowid DESC LIMIT 1),'') AS position,
    (SELECT MAX(occurred_on) FROM log_entry WHERE journey_id=j.id AND kind='practice') AS last,
    (SELECT COUNT(*) FROM log_entry WHERE journey_id=j.id AND kind='practice') AS sessions
    FROM journey j LEFT JOIN charter c ON c.journey_id=j.id AND c.version=(SELECT MAX(version) FROM charter WHERE journey_id=j.id)
    WHERE (${all ? 1 : 0}=1 OR j.status='active') ORDER BY j.name COLLATE NOCASE`).all() as GoalRow[];
}

export function inactiveGoals() {
  return sqlite.prepare("SELECT id,name,hue,status FROM journey WHERE status<>'active' ORDER BY status,name COLLATE NOCASE").all() as {id: string; name: string; hue: number; status: string}[];
}
export function goalStatus(id: string) { return (sqlite.prepare("SELECT status FROM journey WHERE id=?").get(id) as {status: string} | undefined)?.status ?? null; }

export function goalDetail(id: string) {
  const g = goals(true).find(x => x.id === id); if (!g) return null;
  const charter = sqlite.prepare("SELECT why,done_looks_like AS done,constraints,starting_point AS start FROM charter WHERE journey_id=? ORDER BY version DESC LIMIT 1").get(id) as {why: string; done: string; constraints: string | null; start: string | null} | undefined;
  const skills = sqlite.prepare("SELECT id,name,description,level FROM skill WHERE journey_id=? AND archived=0 ORDER BY level DESC,name").all(id) as {id: string; name: string; description: string | null; level: number}[];
  const rows = sqlite.prepare(`SELECT s.content_json AS c,k.name,k.level,k.id AS sid FROM route_step s JOIN learning_route r ON r.id=s.route_id AND r.status='active'
    JOIN atlas_node n ON n.id=s.node_id LEFT JOIN skill k ON k.id=n.legacy_id WHERE r.journey_id=? ORDER BY s.position`).all(id) as {c: string; name: string | null; level: number | null; sid: string | null}[];
  const steps: Step[] = rows.map(r => { const c = JSON.parse(r.c); return {title: c.title, reason: c.reason, approach: c.approach, skill: r.name ?? "", skillId: r.sid ?? "", level: r.level ?? 0}; });
  const current = Math.max(0, steps.findIndex(s => s.level < 3));
  const recent = sqlite.prepare("SELECT id,raw_text,minutes,occurred_on FROM log_entry WHERE journey_id=? AND kind='practice' ORDER BY occurred_on DESC,created_at DESC LIMIT 6").all(id) as {id: string; raw_text: string; minutes: number | null; occurred_on: string}[];
  const versions = sqlite.prepare("SELECT version,note,created_at FROM charter WHERE journey_id=? ORDER BY version DESC").all(id) as {version: number; note: string | null; created_at: string}[];
  const brief = sqlite.prepare("SELECT id FROM document WHERE journey_id=? AND title LIKE 'Goal brief:%' LIMIT 1").get(id) as {id: string} | undefined;
  return {goal: g, charter, skills, steps, current, recent, versions, brief: brief?.id};
}

export type SkillRow = {id: string; node: string; name: string; description: string | null; level: number; evidence: number; last: string | null};
export function skillRows(goal: string): SkillRow[] {
  return sqlite.prepare(`SELECT k.id,'legacy-'||k.id AS node,k.name,k.description,k.level,
    (SELECT COUNT(*) FROM skill_event e WHERE e.skill_id=k.id) AS evidence,(SELECT MAX(at) FROM skill_event e WHERE e.skill_id=k.id) AS last
    FROM skill k WHERE k.journey_id=? AND k.archived=0 ORDER BY k.level DESC,k.name`).all(goal) as SkillRow[];
}
export type Move = {id: string; skill: string; node: string; level: number; delta: number; quote: string; at: string; entry: string};
export function history(goal: string) {
  const sessions = sqlite.prepare("SELECT id,raw_text,minutes,occurred_on,kind FROM log_entry WHERE journey_id=? ORDER BY occurred_on DESC,created_at DESC LIMIT 60").all(goal) as {id: string; raw_text: string; minutes: number | null; occurred_on: string; kind: string}[];
  const moves = sqlite.prepare("SELECT v.id,s.name AS skill,'legacy-'||s.id AS node,v.level_after AS level,v.delta,v.evidence_quote AS quote,v.at,v.entry_id AS entry FROM skill_event v JOIN skill s ON s.id=v.skill_id WHERE s.journey_id=? AND v.delta!=0 ORDER BY v.at DESC LIMIT 200").all(goal) as Move[];
  return {sessions, moves};
}
export function goalNotes(goal: string) {
  return sqlite.prepare("SELECT id,title,updated_at FROM document WHERE status='active' AND journey_id=? ORDER BY updated_at DESC").all(goal) as {id: string; title: string; updated_at: string}[];
}
