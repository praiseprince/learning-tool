import {spawn, type ChildProcess} from "node:child_process";
import {mkdirSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {sqlite} from "../db/client.ts";
import {goalDetail, skillRows} from "../v2/goals.ts";
import {RULES, exportContext, inside, newOutDir, workspaceDir} from "./workspace.ts";
import {aiModel, aiProvider, PROVIDER_NAME} from "../ai/provider.ts";
import {claudeArgs, claudeResult, claudeSteps, codexArgs, codexSteps, draftReader, sessionFrom, usageFrom, type Step} from "./cli.ts";
import {contextChanges, endSession, recordTurn, resumeNote, sessionToResume} from "./session.ts";
import {firecrawlUp, firecrawlUrl} from "./firecrawl.ts";
import {KINDS, LABEL, NEEDS_WEB, SCHEMAS, TIMEOUT_MS, promptFor, stubResult, type JobInput, type JobKind} from "./tasks.ts";
import {ingest} from "./ingest.ts";
import {addEvent, ensureChat} from "../chat/events.ts";

export type {Step};
export type Job = {id: string; goal: string; kind: JobKind; status: "running" | "done" | "failed" | "cancelled"; input: JobInput; steps: Step[]; result: unknown; error: string | null; created_at: string; finished_at: string | null; draft: string | null};
type G = typeof globalThis & {__agentRunning?: Map<string, ChildProcess>; __agentBoot?: boolean};
const g = globalThis as G;
/** Shared across every route's copy of this module, so a live job is never mistaken for a dead one. */
const running = (g.__agentRunning ??= new Map<string, ChildProcess>());

let ready = false;
export function ensureAgent() {
  if (ready) return;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS agent_job(id TEXT PRIMARY KEY,goal TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,input_json TEXT NOT NULL,steps_json TEXT NOT NULL DEFAULT '[]',result_json TEXT,error TEXT,created_at TEXT NOT NULL,finished_at TEXT);
    CREATE INDEX IF NOT EXISTS agent_job_goal ON agent_job(goal,created_at);`);
  try { sqlite.exec("ALTER TABLE agent_job ADD COLUMN usage_json TEXT"); } catch { /* already there */ }
  try { sqlite.exec("ALTER TABLE agent_job ADD COLUMN draft TEXT"); } catch { /* already there */ }
  // jobs left "running" by a real server restart can never finish: close them honestly, once per process
  if (!g.__agentBoot) {
    g.__agentBoot = true; ensureChat();
    const lost = sqlite.prepare("SELECT id,goal FROM agent_job WHERE status='running'").all() as {id: string; goal: string}[];
    sqlite.prepare("UPDATE agent_job SET status='failed',error='The app restarted while this was running.',finished_at=? WHERE status='running'").run(new Date().toISOString());
    for (const j of lost) {
      sqlite.prepare("UPDATE chat_event SET status='done' WHERE kind='job' AND status='working' AND json_extract(payload_json,'$.job')=?").run(j.id);
      addEvent(j.goal, "guide", {markdown: "The app restarted while I was working on this, so it never finished. Your data is unchanged.", tone: "error", retry: {job: j.id}});
    }
    for (const {goal} of sqlite.prepare("SELECT DISTINCT goal FROM chat_event WHERE kind='user' AND status='queued'").all() as {goal: string}[]) setTimeout(() => next(goal), 0);
  }
  ready = true;
}
const row = (r: Record<string, unknown>): Job => ({id: String(r.id), goal: String(r.goal), kind: r.kind as JobKind, status: r.status as Job["status"], input: JSON.parse(String(r.input_json)), steps: JSON.parse(String(r.steps_json)), result: r.result_json ? JSON.parse(String(r.result_json)) : null, error: (r.error as string) ?? null, created_at: String(r.created_at), finished_at: (r.finished_at as string) ?? null, draft: (r.draft as string) ?? null});
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
  const finish = async (ok: boolean, why?: string) => { try { await end(ok, why); } finally { next(goal); } };
  const end = async (ok: boolean, why?: string) => {
    running.delete(id);
    if (getJob(id)?.status === "cancelled") return; // stopped by the learner: nothing to report
    sqlite.prepare("UPDATE chat_event SET status='done' WHERE kind='job' AND status='working' AND json_extract(payload_json,'$.job')=?").run(id);
    if (!ok) { save(id, {status: "failed", error: why ?? "The Guide could not finish.", steps, finished: true}); addEvent(goal, "guide", {markdown: `${why ?? "I could not finish that."} Your data is unchanged.`, tone: "error", retry: {job: id}}); return; }
    try {
      const raw = JSON.parse(readFileSync(join(root, "jobs", id, "result.json"), "utf8")), result = SCHEMAS[kind].parse(raw);
      await ingest({id, goal, kind, input}, result as never); // links are checked here; only then is the job done
      save(id, {result, steps, finished: true, status: "done"});
    } catch (e) { const msg = e instanceof z.ZodError ? "The Guide's answer did not match the expected shape." : String((e as Error).message).slice(0, 200); save(id, {status: "failed", error: msg, steps, finished: true}); addEvent(goal, "guide", {markdown: `${msg} Your data is unchanged.`, tone: "error", retry: {job: id}}); }
  };

  if (aiProvider() === "stub") {
    const rows = skillRows(goal);
    setTimeout(() => { steps.push({at: new Date().toISOString(), kind: "say", text: "Reading your goal, skills and sessions…"}); save(id, {steps}); }, 300);
    setTimeout(() => {
      const result = stubResult(kind, id, input, {goalName: d.goal.name, skills: rows.map(r => r.name)});
      if (kind === "practice") writeFileSync(join(newOutDir(goal, id), "practice-sheet.md"), (result as {note: string}).note);
      writeFileSync(join(root, "jobs", id, "result.json"), JSON.stringify(result)); void finish(true);
    }, 1200);
    return id;
  }

  const provider = aiProvider();
  if (provider === "stub") return id; // unreachable: handled above
  const schemaJson = JSON.stringify(z.toJSONSchema(SCHEMAS[kind])), schemaPath = join(root, "jobs", id, "schema.json"), resultPath = join(root, "jobs", id, "result.json");
  writeFileSync(schemaPath, schemaJson);
  const images = (input.files ?? []).filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f)).map(f => inside(goal, "inbox", f));
  const name = PROVIDER_NAME[provider], changed = contextChanges(root);

  /** One turn. It resumes the goal's recent session when that is still warm, otherwise starts fresh; a resume that never
   * reaches its session is retried once fresh. Either way context/ (the database) is the memory. */
  const run = async (resume: string | null) => {
    const fc = NEEDS_WEB[kind] && await firecrawlUp();
    const mcp = fc ? {name: "firecrawl", command: process.execPath, args: ["--no-warnings", join(process.cwd(), "lib", "agent", "firecrawl-mcp.ts")],
      env: {FIRECRAWL_URL: firecrawlUrl(), MARGINALIA_READ_LOG: join(root, "jobs", id, "reads.jsonl"), ...(process.env.FIRECRAWL_API_KEY ? {FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY} : {})}, tools: ["read_page"]} : null;
    const turn = {root, job: id, schemaPath, schemaJson, resultPath, web: NEEDS_WEB[kind], images, model: aiModel(provider), rules: RULES, resume, mcp};
    const prompt = [resume ? resumeNote(changed) : "", fc ? FIRECRAWL_NOTE : "", promptFor(kind, id, resume ? {...input, history: undefined} : input)].filter(Boolean).join("\n\n");
    const child = spawn(provider, provider === "codex" ? codexArgs(turn) : claudeArgs(turn), {cwd: root, stdio: ["pipe", "pipe", "pipe"]});
    running.set(id, child);
    let answer: ReturnType<typeof claudeResult> = null, session: string | null = null, usage: ReturnType<typeof usageFrom> = null, buf = "", last = 0, timedOut = false;
    const field = DRAFT[kind], read = provider === "claude" && field ? draftReader(field) : null; let draft: string | null = null, drafted = 0;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); steps.push({at: new Date().toISOString(), kind: "error", text: "This took too long and was stopped."}); }, TIMEOUT_MS[kind]);
    child.stdout.on("data", chunk => {
      buf += chunk.toString(); const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const l of lines) {
        let e: unknown; try { e = JSON.parse(l); } catch { continue; }
        session ??= sessionFrom(provider, e);
        const u = usageFrom(provider, e); if (u) usage = usage ? {input: usage.input + u.input, cached: usage.cached + u.cached, output: usage.output + u.output} : u;
        if (provider === "claude") answer = claudeResult(e) ?? answer;
        steps.push(...(provider === "codex" ? codexSteps(e) : claudeSteps(e, root)));
        draft = read?.(e) ?? draft;
      }
      if (Date.now() - last > 400) { last = Date.now(); save(id, {steps}); }
      if (draft !== null && draft.length !== drafted) { drafted = draft.length; sqlite.prepare("UPDATE agent_job SET draft=? WHERE id=?").run(draft.slice(0, 20000), id); }
    });
    child.stderr.on("data", () => { /* progress noise; the JSON stream is the source of truth */ });
    child.on("error", () => { clearTimeout(timer); void finish(false, `${name} could not be started. Check that it is installed and signed in.`); });
    child.on("close", code => {
      clearTimeout(timer);
      if (getJob(id)?.status === "cancelled") { running.delete(id); return; }
      if (code !== 0 && resume && !session && !timedOut) { endSession(goal); steps.push({at: new Date().toISOString(), kind: "say", text: "Starting a fresh conversation…"}); void run(null); return; }
      if (session) recordTurn(goal, provider, session, usage?.input ?? 0);
      if (usage) sqlite.prepare("UPDATE agent_job SET usage_json=? WHERE id=?").run(JSON.stringify({...usage, provider, resumed: !!resume}), id);
      if (provider === "claude" && answer?.ok) writeFileSync(resultPath, JSON.stringify(answer.output));
      if (code === 0 && existsSync(resultPath)) void finish(true);
      else void finish(false, code === null || timedOut ? "Stopped before finishing." : "The Guide could not finish this one. Your data is unchanged.");
    });
    child.stdin.on("error", () => { /* closed early */ });
    child.stdin.end(prompt);
  };
  const warm = sessionToResume(goal, provider);
  if (warm.id) steps.push({at: new Date().toISOString(), kind: "say", text: "Continuing our conversation…"});
  void run(warm.id);
  return id;
}

/** The answer field that is shown while it is being written (Claude Code streams it; Codex reports it whole). */
const DRAFT: Partial<Record<JobKind, string>> = {ask: "answer", review: "feedback"};

/** Told to the agent when local Firecrawl is attached. */
const FIRECRAWL_NOTE = `You have a read_page tool (Firecrawl Local, on this computer): it returns a web page in full as clean Markdown, with JavaScript rendered. Find pages with your web search, then open them with read_page rather than a built-in fetch: you get the whole page, not a summary, and every page you read is logged so the app can check which sources you really opened.`;

/** Whatever the learner typed while the Guide was busy goes now. Loaded lazily: the router itself starts jobs. */
function next(goal: string) { void import("../chat/route.ts").then(m => m.drainQueue(goal)).catch(() => { /* nothing waiting is lost: it stays queued */ }); }

export function cancelJob(id: string) {
  const c = running.get(id); if (c) c.kill("SIGTERM"); running.delete(id);
  sqlite.prepare("UPDATE agent_job SET status='cancelled',finished_at=? WHERE id=? AND status='running'").run(new Date().toISOString(), id);
  sqlite.prepare("UPDATE chat_event SET status='done' WHERE kind='job' AND status='working' AND json_extract(payload_json,'$.job')=?").run(id);
  const j = getJob(id); if (j) next(j.goal);
}
