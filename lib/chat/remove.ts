// Removing a message and the Guide's replies to it, so it leaves the Guide's memory as well as the screen.
// Things the learner already accepted from that exchange (notes, materials, facts) and logged sessions stay: they have
// their own places to edit. Suggestions not yet acted on are dismissed.
import {existsSync, readdirSync, rmSync} from "node:fs";
import {homedir} from "node:os";
import {join} from "node:path";
import {sqlite} from "../db/client.ts";
import {ensureChat} from "./events.ts";
import {sharedFrom} from "./files.ts";
import {exportContext, inside} from "../agent/workspace.ts";
import {endSession} from "../agent/session.ts";

type Row = {seq: number; kind: string; payload_json: string; status: string};
const parse = (s: string) => { try { return JSON.parse(s); } catch { return {}; } };

/** The events that make up the exchange started by the learner's message `seq`: it and everything up to their next message. */
export function exchange(goal: string, seq: number): Row[] {
  ensureChat();
  const first = sqlite.prepare("SELECT seq,kind,payload_json,status FROM chat_event WHERE goal=? AND seq=?").get(goal, seq) as Row | undefined;
  if (!first || first.kind !== "user") return [];
  const next = (sqlite.prepare("SELECT MIN(seq) AS s FROM chat_event WHERE goal=? AND kind='user' AND seq>?").get(goal, seq) as {s: number | null}).s;
  return sqlite.prepare(`SELECT seq,kind,payload_json,status FROM chat_event WHERE goal=? AND seq>=? ${next ? "AND seq<?" : ""} ORDER BY seq`).all(...[goal, seq, ...(next ? [next] : [])]) as Row[];
}

/** Removes the exchange for good. Refuses while the Guide is still working on it. */
export function removeExchange(goal: string, seq: number): {ok: true; removed: number} | {ok: false; error: string} {
  const rows = exchange(goal, seq);
  if (!rows.length) return {ok: false, error: "That message is already gone."};
  const jobs = rows.filter(r => r.kind === "job").map(r => String(parse(r.payload_json).job ?? ""));
  const busy = rows.some(r => r.status === "working") || jobs.some(j => (sqlite.prepare("SELECT 1 FROM agent_job WHERE id=? AND status='running'").get(j)));
  if (busy) return {ok: false, error: "The Guide is still working on that. Stop it first, or remove it when it has answered."};
  const sessions = jobs.map(j => (sqlite.prepare("SELECT json_extract(usage_json,'$.provider') AS p,json_extract(usage_json,'$.session') AS s FROM agent_job WHERE id=?").get(j) ?? {}) as {p?: string; s?: string}).filter(x => x.s);
  const now = new Date().toISOString(), files = rows.filter(r => r.kind === "user").flatMap(r => sharedFrom(parse(r.payload_json)).filter(f => f.stored));
  sqlite.transaction(() => {
    for (const r of rows) {
      const p = parse(r.payload_json);
      const ids: string[] = r.kind === "suggestions" && Array.isArray(p.ids) ? p.ids : r.kind === "week" && p.week ? [p.week] : [];
      for (const id of ids) sqlite.prepare("UPDATE proposal SET status='dismissed',resolved_at=? WHERE id=? AND journey_id=? AND status='pending'").run(now, id, goal);
    }
    for (const j of jobs) sqlite.prepare("DELETE FROM agent_job WHERE id=? AND goal=?").run(j, goal); // they hold the question too
    sqlite.prepare(`DELETE FROM chat_event WHERE goal=? AND seq IN (${rows.map(() => "?").join(",")})`).run(goal, ...rows.map(r => r.seq));
  })();
  for (const f of files) for (const name of [f.stored, f.text].filter(Boolean) as string[]) { try { rmSync(inside(goal, "inbox", name), {force: true}); } catch { /* already gone */ } }
  for (const j of jobs) if (/^[A-Za-z0-9_-]{1,80}$/.test(j)) for (const d of ["jobs", "out"]) { try { rmSync(inside(goal, d, j), {recursive: true, force: true}); } catch { /* none */ } }
  for (const x of sessions) forgetTranscript(String(x.p), String(x.s));
  endSession(goal); // the open Claude Code session saw the exchange; the next message starts from the database alone
  try { exportContext(goal); } catch { /* rebuilt before the next turn anyway */ }
  try { sqlite.pragma("wal_checkpoint(TRUNCATE)"); } catch { /* busy: SQLite folds it in later */ }
  return {ok: true, removed: rows.length};
}

/** Deletes the engine's own transcript of a session the Guide ran (and nothing else: the file must be named by that session id). */
export function forgetTranscript(provider: string, session: string) {
  if (!/^[0-9a-f-]{20,64}$/i.test(session)) return;
  try {
    if (provider === "claude") {
      const root = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects"); if (!existsSync(root)) return;
      for (const d of readdirSync(root)) for (const f of [session + ".jsonl", session]) rmSync(join(root, d, f), {recursive: true, force: true});
    } else if (provider === "codex") { // only runs from before --ephemeral left one
      const walk = (dir: string, depth: number) => { if (depth > 4 || !existsSync(dir)) return; for (const e of readdirSync(dir, {withFileTypes: true})) { const p = join(dir, e.name); if (e.isDirectory()) walk(p, depth + 1); else if (e.name.endsWith(`-${session}.jsonl`)) rmSync(p, {force: true}); } };
      walk(join(process.env.CODEX_HOME || join(homedir(), ".codex"), "sessions"), 0);
    }
  } catch { /* best effort */ }
}
