import {sqlite} from "../db/client.ts";

export type Kind = "user" | "guide" | "minutes" | "working" | "job" | "plan" | "log" | "suggestions" | "note" | "week" | "quiz";
export type ChatEvent = {seq: number; goal: string; kind: Kind; payload: any; status: string; created_at: string}; // eslint-disable-line @typescript-eslint/no-explicit-any

let ready = false;
export function ensureChat() {
  if (ready) return;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chat_event(seq INTEGER PRIMARY KEY AUTOINCREMENT,goal TEXT NOT NULL,kind TEXT NOT NULL,payload_json TEXT NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'done',created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS chat_goal ON chat_event(goal,seq);
    CREATE TABLE IF NOT EXISTS plan_mark(plan_id TEXT NOT NULL,idx INTEGER NOT NULL,result TEXT NOT NULL,PRIMARY KEY(plan_id,idx));
    CREATE TABLE IF NOT EXISTS agent_job(id TEXT PRIMARY KEY,goal TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,input_json TEXT NOT NULL,steps_json TEXT NOT NULL DEFAULT '[]',result_json TEXT,error TEXT,created_at TEXT NOT NULL,finished_at TEXT);
    CREATE INDEX IF NOT EXISTS agent_job_goal ON agent_job(goal,created_at);`);
  ready = true;
}
export function addEvent(goal: string, kind: Kind, payload: unknown = {}, status = "done"): number {
  ensureChat();
  return Number(sqlite.prepare("INSERT INTO chat_event(goal,kind,payload_json,status,created_at) VALUES (?,?,?,?,?)").run(goal, kind, JSON.stringify(payload), status, new Date().toISOString()).lastInsertRowid);
}
export function updateEvent(seq: number, kind: Kind, payload: unknown, status = "done") {
  ensureChat(); sqlite.prepare("UPDATE chat_event SET kind=?,payload_json=?,status=? WHERE seq=?").run(kind, JSON.stringify(payload), status, seq);
}
export function events(goal: string, limit = 120): ChatEvent[] {
  ensureChat();
  return (sqlite.prepare("SELECT * FROM (SELECT * FROM chat_event WHERE goal=? ORDER BY seq DESC LIMIT ?) ORDER BY seq").all(goal, limit) as {seq: number; goal: string; kind: Kind; payload_json: string; status: string; created_at: string}[])
    .map(r => ({seq: r.seq, goal: r.goal, kind: r.kind, payload: JSON.parse(r.payload_json), status: r.status, created_at: r.created_at}));
}
export function state(goal: string) {
  ensureChat();
  const r = sqlite.prepare("SELECT COALESCE(MAX(seq),0) AS seq,SUM(status='working') AS working FROM chat_event WHERE goal=?").get(goal) as {seq: number; working: number | null};
  const job = sqlite.prepare("SELECT 1 FROM agent_job WHERE goal=? AND status='running' LIMIT 1").get(goal);
  return {seq: r.seq, busy: (r.working ?? 0) > 0 || !!job};
}
export function marks(plan: string): Record<number, string> {
  ensureChat();
  return Object.fromEntries((sqlite.prepare("SELECT idx,result FROM plan_mark WHERE plan_id=?").all(plan) as {idx: number; result: string}[]).map(m => [m.idx, m.result]));
}
