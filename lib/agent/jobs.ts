import {spawn, type ChildProcess} from "node:child_process";
import {mkdirSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {sqlite} from "../db/client.ts";
import {goalDetail, skillRows} from "../v2/goals.ts";
import {exportContext, inside, newOutDir, workspaceDir} from "./workspace.ts";
import {KINDS, LABEL, NEEDS_WEB, SCHEMAS, TIMEOUT_MS, promptFor, stubResult, type JobInput, type JobKind} from "./tasks.ts";
import {ingest} from "./ingest.ts";
import {addEvent} from "../chat/events.ts";

export type Step = {at: string; kind: "search" | "open" | "run" | "write" | "say" | "error"; text: string};
export type Job = {id: string; goal: string; kind: JobKind; status: "running" | "done" | "failed" | "cancelled"; input: JobInput; steps: Step[]; result: unknown; error: string | null; created_at: string; finished_at: string | null};
type G = typeof globalThis & {__agentRunning?: Map<string, ChildProcess>; __agentBoot?: boolean};
const g = globalThis as G;
/** Shared across every route's copy of this module, so a live job is never mistaken for a dead one. */
const running = (g.__agentRunning ??= new Map<string, ChildProcess>());

let ready = false;
export function ensureAgent() {
  if (ready) return;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS agent_job(id TEXT PRIMARY KEY,goal TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,input_json TEXT NOT NULL,steps_json TEXT NOT NULL DEFAULT '[]',result_json TEXT,error TEXT,created_at TEXT NOT NULL,finished_at TEXT);
    CREATE INDEX IF NOT EXISTS agent_job_goal ON agent_job(goal,created_at);`);
  // jobs left "running" by a real server restart can never finish: close them honestly, once per process
  if (!g.__agentBoot) { g.__agentBoot = true; sqlite.prepare("UPDATE agent_job SET status='failed',error='The app restarted while this was running.',finished_at=? WHERE status='running'").run(new Date().toISOString()); }
  ready = true;
}
const row = (r: Record<string, unknown>): Job => ({id: String(r.id), goal: String(r.goal), kind: r.kind as JobKind, status: r.status as Job["status"], input: JSON.parse(String(r.input_json)), steps: JSON.parse(String(r.steps_json)), result: r.result_json ? JSON.parse(String(r.result_json)) : null, error: (r.error as string) ?? null, created_at: String(r.created_at), finished_at: (r.finished_at as string) ?? null});
export function getJob(id: string) { ensureAgent(); const r = sqlite.prepare("SELECT * FROM agent_job WHERE id=?").get(id) as Record<string, unknown> | undefined; return r ? row(r) : null; }
export function jobsFor(goal: string, limit = 12) { ensureAgent(); return (sqlite.prepare("SELECT * FROM agent_job WHERE goal=? ORDER BY created_at DESC LIMIT ?").all(goal, limit) as Record<string, unknown>[]).map(row); }
export function runningJob(goal: string) { ensureAgent(); const r = sqlite.prepare("SELECT * FROM agent_job WHERE goal=? AND status='running' ORDER BY created_at DESC LIMIT 1").get(goal) as Record<string, unknown> | undefined; return r ? row(r) : null; }

function save(id: string, patch: {status?: Job["status"]; steps?: Step[]; result?: unknown; error?: string | null; finished?: boolean}) {
  const sets: string[] = [], vals: unknown[] = [];
  if (patch.status) { sets.push("status=?"); vals.push(patch.status); }
  if (patch.steps) { sets.push("steps_json=?"); vals.push(JSON.stringify(patch.steps.slice(-60))); }
  if (patch.result !== undefined) { sets.push("result_json=?"); vals.push(JSON.stringify(patch.result)); }
  if (patch.error !== undefined) { sets.push("error=?"); vals.push(patch.error); }
  if (patch.finished) { sets.push("finished_at=?"); vals.push(new Date().toISOString()); }
  if (sets.length) sqlite.prepare(`UPDATE agent_job SET ${sets.join(",")} WHERE id=?`).run(...vals, id);
}

/** Turns one Codex JSONL event into a human step, or null for noise. */
export function stepFrom(e: any): Step | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const at = new Date().toISOString(), it = e?.item;
  if (e?.type === "error" && e.message) return {at, kind: "error", text: String(e.message).slice(0, 200)};
  if (e?.type === "item.started" && it?.type === "web_search") return it.query ? {at, kind: "search", text: `Searching the web: ${String(it.query).slice(0, 120)}`} : null;
  if (e?.type !== "item.completed" || !it) return null;
  if (it.type === "web_search") { if (!it.query && it.results?.[0]?.domain) return {at, kind: "open", text: `Reading ${it.results[0].domain}`}; return null; }
  if (it.type === "command_execution") return {at, kind: "run", text: `Running: ${String(it.command ?? "").replace(/^\S*sh -lc\s+/, "").slice(0, 110)}`};
  if (it.type === "file_change") return {at, kind: "write", text: `Writing ${(it.changes ?? []).map((c: {path?: string}) => String(c.path ?? "").split("/").pop()).filter(Boolean).slice(0, 3).join(", ") || "a file"}`};
  if (it.type === "agent_message" && it.text && !String(it.text).trim().startsWith("{")) return {at, kind: "say", text: String(it.text).slice(0, 160)};
  return null;
}

export function startJob(goal: string, kind: JobKind, input: JobInput = {}): string {
  ensureAgent();
  if (!(KINDS as readonly string[]).includes(kind)) throw Error("Unknown task.");
  const d = goalDetail(goal); if (!d) throw Error("Goal not found.");
  const busy = runningJob(goal); if (busy) return busy.id;
  const id = randomUUID(), now = new Date().toISOString();
  sqlite.prepare("INSERT INTO agent_job(id,goal,kind,status,input_json,steps_json,created_at) VALUES (?,?,?,'running',?,'[]',?)").run(id, goal, kind, JSON.stringify(input), now);
  const steps: Step[] = [{at: now, kind: "say", text: LABEL[kind] + "…"}];
  const root = workspaceDir(goal);
  try { exportContext(goal); newOutDir(goal, id); mkdirSync(join(root, "jobs", id), {recursive: true}); }
  catch (e) { save(id, {status: "failed", error: String((e as Error).message), finished: true}); return id; }
  const finish = async (ok: boolean, why?: string) => {
    running.delete(id);
    sqlite.prepare("UPDATE chat_event SET status='done' WHERE kind='job' AND status='working' AND json_extract(payload_json,'$.job')=?").run(id);
    if (!ok) { save(id, {status: "failed", error: why ?? "The Guide could not finish.", steps, finished: true}); addEvent(goal, "guide", {markdown: `${why ?? "I could not finish that."} Your data is unchanged. You can try again.`, tone: "error"}); return; }
    try {
      const raw = JSON.parse(readFileSync(join(root, "jobs", id, "result.json"), "utf8")), result = SCHEMAS[kind].parse(raw);
      save(id, {result, steps, finished: true, status: "done"});
      await ingest({id, goal, kind, input}, result as never);
    } catch (e) { const msg = e instanceof z.ZodError ? "The Guide's answer did not match the expected shape." : String((e as Error).message).slice(0, 200); save(id, {status: "failed", error: msg, steps, finished: true}); addEvent(goal, "guide", {markdown: `${msg} Your data is unchanged. You can try again.`, tone: "error"}); }
  };

  if (process.env.AI_PROVIDER === "stub") {
    const rows = skillRows(goal);
    setTimeout(() => { steps.push({at: new Date().toISOString(), kind: "say", text: "Reading your goal, skills and sessions…"}); save(id, {steps}); }, 300);
    setTimeout(() => {
      const result = stubResult(kind, id, input, {goalName: d.goal.name, skills: rows.map(r => r.name)});
      if (kind === "practice") writeFileSync(join(newOutDir(goal, id), "practice-sheet.md"), (result as {note: string}).note);
      writeFileSync(join(root, "jobs", id, "result.json"), JSON.stringify(result)); void finish(true);
    }, 1200);
    return id;
  }

  const schema = z.toJSONSchema(SCHEMAS[kind]);
  writeFileSync(join(root, "jobs", id, "schema.json"), JSON.stringify(schema));
  const images = (input.files ?? []).filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f)).map(f => inside(goal, "inbox", f));
  const args = ["exec", "--json", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--sandbox", "workspace-write", "-C", root,
    ...(process.env.AI_MODEL ? ["--model", process.env.AI_MODEL] : []), ...(NEEDS_WEB[kind] ? ["-c", 'web_search="live"'] : []),
    "--output-schema", join(root, "jobs", id, "schema.json"), "-o", join(root, "jobs", id, "result.json"), ...images.flatMap(p => ["-i", p]), "-"];
  const child = spawn("codex", args, {cwd: root, stdio: ["pipe", "pipe", "pipe"]});
  running.set(id, child);
  const timer = setTimeout(() => { child.kill("SIGTERM"); steps.push({at: new Date().toISOString(), kind: "error", text: "This took too long and was stopped."}); }, TIMEOUT_MS[kind]);
  let buf = "", last = 0;
  child.stdout.on("data", chunk => {
    buf += chunk.toString(); const lines = buf.split("\n"); buf = lines.pop() ?? "";
    for (const l of lines) { try { const st = stepFrom(JSON.parse(l)); if (st) steps.push(st); } catch { /* not an event */ } }
    if (Date.now() - last > 400) { last = Date.now(); save(id, {steps}); }
  });
  child.stderr.on("data", () => { /* codex prints progress here; the JSON stream is the source of truth */ });
  child.on("error", () => { clearTimeout(timer); void finish(false, "Codex could not be started. Check that it is installed and signed in."); });
  child.on("close", code => {
    clearTimeout(timer); const cur = getJob(id);
    if (cur?.status === "cancelled") { running.delete(id); return; }
    if (code === 0 && existsSync(join(root, "jobs", id, "result.json"))) void finish(true);
    else void finish(false, code === null ? "Stopped before finishing." : "The Guide could not finish this one. Your data is unchanged.");
  });
  child.stdin.on("error", () => { /* closed early */ });
  child.stdin.end(promptFor(kind, id, input));
  return id;
}

export function cancelJob(id: string) {
  const c = running.get(id); if (c) c.kill("SIGTERM"); running.delete(id);
  sqlite.prepare("UPDATE agent_job SET status='cancelled',finished_at=? WHERE id=? AND status='running'").run(new Date().toISOString(), id);
  sqlite.prepare("UPDATE chat_event SET status='done' WHERE kind='job' AND status='working' AND json_extract(payload_json,'$.job')=?").run(id);
}
