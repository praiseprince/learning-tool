// A loose session: while you are actively talking to the Guide, turns resume the same CLI session, so it does not
// re-read files it already has and the provider's prompt cache makes each turn cheap. The session is disposable:
// after a pause, after many turns, or once it gets large, the next turn simply starts fresh. Nothing is compacted
// and nothing is lost, because the database (exported to context/ before every turn) is the memory, not the session.
import {createHash} from "node:crypto";
import {existsSync, readdirSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {join, relative} from "node:path";
import {sqlite} from "../db/client.ts";
import type {Provider} from "../ai/provider.ts";

/** Which engines continue sessions. Measured on real turns: a continued Claude Code turn cost about half a fresh one (its
 * prompt cache covers the conversation), while Codex replays the whole thread on every internal step, so a continued Codex
 * turn cost more than a fresh one. Codex therefore starts fresh every turn; the database carries the memory either way. */
export const CONTINUES: Record<Provider, boolean> = {claude: true, codex: false};
/** Resume only while the conversation is warm, short and small. */
export const WARM_MS = 30 * 60_000, MAX_TURNS = 12, MAX_INPUT = 150_000;

let ready = false;
function ensure() {
  if (ready) return;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS agent_session(goal TEXT NOT NULL,provider TEXT NOT NULL,session_id TEXT NOT NULL,turns INTEGER NOT NULL DEFAULT 0,last_input INTEGER NOT NULL DEFAULT 0,started_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(goal,provider));`);
  ready = true;
}
type Row = {session_id: string; turns: number; last_input: number; started_at: string; updated_at: string};

/** The session to resume, or null to start fresh (and why, for the step log). */
export function sessionToResume(goal: string, p: Provider, now = Date.now()): {id: string | null; why: string} {
  if (!CONTINUES[p]) return {id: null, why: "fresh-engine"};
  ensure();
  const r = sqlite.prepare("SELECT session_id,turns,last_input,started_at,updated_at FROM agent_session WHERE goal=? AND provider=?").get(goal, p) as Row | undefined;
  if (!r) return {id: null, why: "new"};
  if (now - Date.parse(r.updated_at) > WARM_MS) return {id: null, why: "paused"};
  if (r.turns >= MAX_TURNS) return {id: null, why: "long"};
  if (r.last_input >= MAX_INPUT) return {id: null, why: "large"};
  return {id: r.session_id, why: "warm"};
}
/** Records a finished turn. A different id means a fresh session replaced the old one. */
export function recordTurn(goal: string, p: Provider, id: string, input: number) {
  ensure(); const at = new Date().toISOString();
  sqlite.prepare(`INSERT INTO agent_session(goal,provider,session_id,turns,last_input,started_at,updated_at) VALUES (?,?,?,1,?,?,?)
    ON CONFLICT(goal,provider) DO UPDATE SET turns=CASE WHEN session_id=excluded.session_id THEN turns+1 ELSE 1 END,
      started_at=CASE WHEN session_id=excluded.session_id THEN started_at ELSE excluded.started_at END,
      session_id=excluded.session_id,last_input=excluded.last_input,updated_at=excluded.updated_at`).run(goal, p, id, input, at, at);
}
/** Forget the session(s); the next turn starts fresh. */
export function endSession(goal?: string) { ensure(); if (goal) sqlite.prepare("DELETE FROM agent_session WHERE goal=?").run(goal); else sqlite.exec("DELETE FROM agent_session"); }

/** Hashes every file in context/ and returns the ones that changed since the previous export, saving the new hashes. */
export function contextChanges(root: string): string[] {
  const ctx = join(root, "context"), store = join(root, "jobs", "context-hashes.json");
  const now: Record<string, string> = {};
  const walk = (d: string) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else now[relative(ctx, p)] = createHash("sha1").update(readFileSync(p)).digest("hex"); } };
  if (existsSync(ctx)) walk(ctx);
  let before: Record<string, string> = {}; try { before = JSON.parse(readFileSync(store, "utf8")); } catch { /* first export */ }
  try { writeFileSync(store, JSON.stringify(now)); } catch { /* jobs/ not made yet */ }
  const changed = Object.keys(now).filter(f => before[f] !== now[f] && f !== "README.md");
  const gone = Object.keys(before).filter(f => !(f in now));
  return [...changed, ...gone.map(f => f + " (removed)")].sort();
}

/** What a resumed turn is told before its task. */
export function resumeNote(changed: string[]) {
  return `[New turn in this conversation. context/ was rebuilt from the database just now and is the source of truth: where it disagrees with what you remember from earlier in this session, it wins.
${changed.length ? `Changed since your last turn: ${changed.slice(0, 30).join(", ")}${changed.length > 30 ? ` and ${changed.length - 30} more` : ""}. Re-read what is relevant to this task.` : "Nothing in context/ changed since your last turn."}]`;
}
