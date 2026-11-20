// The agent is stateless: everything it knows is exported from the database into context/ before each turn.
// These check that the conversation, knowledge map and profile reach it, and that both CLIs are invoked safely.
import {test, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marginalia-memory-"));
process.env.DATABASE_URL = join(dir, "t.db");
process.env.MARGINALIA_WORKSPACES = join(dir, "workspace");
process.env.AI_PROVIDER = "stub";

const {sqlite} = await import("../lib/db/client.ts");
const {createGoal} = await import("../lib/v2/brief.ts");
const {exportContext} = await import("../lib/agent/workspace.ts");
const {addEvent} = await import("../lib/chat/events.ts");
const {claudeArgs, codexArgs, claudeSteps, claudeResult} = await import("../lib/agent/cli.ts");
const {sessionToResume, recordTurn, endSession, contextChanges, resumeNote, WARM_MS, MAX_TURNS, MAX_INPUT} = await import("../lib/agent/session.ts");
after(() => { sqlite.close(); rmSync(dir, {recursive: true, force: true}); });

const goal = "es";
createGoal(goal, {title: "Spanish", goal: "Hold a conversation in Madrid.", why: "", doneLooksLike: "", currentPosition: "", constraints: "", materials: [],
  roadmap: [{phase: "Basics", focus: "", outcomes: [], skills: ["Present tense"]}], skills: [{name: "Present tense", description: "", status: "target", level: 0, evidence: "", requires: []}]});
const read = (f: string) => readFileSync(join(process.env.MARGINALIA_WORKSPACES!, goal, "context", f), "utf8");

test("the whole chat is exported, with older messages in an archive", () => {
  addEvent(goal, "user", {text: "I'm moving to Madrid in March and I hate flashcards."});
  for (let i = 0; i < 70; i++) addEvent(goal, i % 2 ? "guide" : "user", i % 2 ? {markdown: `Reply ${i}`} : {text: `Message ${i}`});
  exportContext(goal);
  assert.match(read("conversation-archive.md"), /moving to Madrid in March and I hate flashcards/);
  assert.match(read("conversation.md"), /Reply 69/);
  assert.match(read("conversation.md"), /earlier messages are in conversation-archive\.md/);
});

test("profile facts and the knowledge map are exported", () => {
  sqlite.prepare("INSERT INTO profile_fact (id,text,kind,source_entry_id,status,created_at) VALUES ('f1','Evenings work best, under 45 minutes.','preference',NULL,'active',?)").run(new Date().toISOString());
  exportContext(goal);
  assert.match(read("about-me.md"), /Evenings work best/);
  assert.ok(existsSync(join(process.env.MARGINALIA_WORKSPACES!, goal, "context", "atlas.md")));
  assert.match(read("README.md"), /These files ARE your memory/);
});

const turn = {root: "/w/es", job: "j1", schemaPath: "/w/es/jobs/j1/schema.json", schemaJson: '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}', resultPath: "/w/es/jobs/j1/result.json", web: false, images: [], model: "", rules: "RULES", resume: null as string | null, mcp: null as null | {name: string; command: string; args: string[]; env: Record<string, string>; tools: string[]}};
const mcp = {name: "firecrawl", command: "/usr/bin/node", args: ["/app/lib/agent/firecrawl-mcp.ts"], env: {FIRECRAWL_URL: "http://127.0.0.1:3002"}, tools: ["read_page"]};

test("Codex runs in the workspace sandbox, resumes by id, and gets Firecrawl only for web tasks", () => {
  const a = codexArgs(turn);
  assert.ok(a.includes('sandbox_mode="workspace-write"'));
  assert.ok(!a.includes("resume"));
  const r = codexArgs({...turn, resume: "abc"});
  assert.deepEqual([r[0], r[1], r.at(-2), r.at(-1)], ["exec", "resume", "abc", "-"]);
  assert.ok(!codexArgs({...turn, mcp}).join(" ").includes("mcp_servers"), "no MCP without web");
  const w = codexArgs({...turn, web: true, mcp}).join(" ");
  assert.match(w, /mcp_servers\.firecrawl\.args=\["\/app\/lib\/agent\/firecrawl-mcp\.ts"\]/);
  assert.match(w, /mcp_servers\.firecrawl\.env=\{FIRECRAWL_URL="http:\/\/127\.0\.0\.1:3002"\}/);
});

test("Claude Code ignores user settings, may only write to out/<job>/, and resumes by id", () => {
  const a = claudeArgs(turn);
  assert.ok(a.includes("--strict-mcp-config"));
  assert.equal(a[a.indexOf("--permission-mode") + 1], "dontAsk");
  assert.equal(a[a.indexOf("--setting-sources") + 1], "");
  assert.equal(a[a.indexOf("--json-schema") + 1], '{"type":"object"}', "Claude Code rejects the $schema header");
  assert.ok(a.includes("Write(./out/j1/**)") && a.includes("Read(./**)"));
  assert.ok(!a.some(x => /^(Write|Edit)$/.test(x)), "no unscoped write permission");
  assert.ok(!a.join(",").includes("WebSearch"), "no web without a task that needs it");
  assert.ok(claudeArgs({...turn, web: true}).includes("WebFetch"));
  assert.deepEqual(claudeArgs({...turn, resume: "s1"}).slice(-2), ["--resume", "s1"]);
  const w = claudeArgs({...turn, web: true, mcp});
  assert.ok(w.includes("mcp__firecrawl__read_page"));
  assert.equal(JSON.parse(w[w.indexOf("--mcp-config") + 1]).mcpServers.firecrawl.command, "/usr/bin/node");
});

test("a session is resumed only while warm, short and small", () => {
  const t0 = Date.now();
  assert.equal(sessionToResume(goal, "claude").id, null);
  recordTurn(goal, "claude", "s1", 20_000);
  assert.equal(sessionToResume(goal, "claude").id, "s1");
  recordTurn(goal, "codex", "c1", 20_000);
  assert.equal(sessionToResume(goal, "codex").id, null, "Codex starts fresh every turn");
  assert.equal(sessionToResume(goal, "claude", t0 + WARM_MS + 60_000).why, "paused");
  recordTurn(goal, "claude", "s1", MAX_INPUT);
  assert.equal(sessionToResume(goal, "claude").why, "large");
  recordTurn(goal, "claude", "s2", 10_000);
  assert.equal(sessionToResume(goal, "claude").id, "s2", "a fresh session replaces the old one");
  for (let i = 0; i < MAX_TURNS; i++) recordTurn(goal, "claude", "s2", 10_000);
  assert.equal(sessionToResume(goal, "claude").why, "long");
  endSession(goal);
  assert.equal(sessionToResume(goal, "claude").id, null);
});

test("a resumed turn is told which context files changed", () => {
  const root = join(process.env.MARGINALIA_WORKSPACES!, goal);
  mkdirSync(join(root, "jobs"), {recursive: true});
  exportContext(goal); contextChanges(root);
  assert.deepEqual(contextChanges(root), []);
  addEvent(goal, "user", {text: "One more thing."});
  exportContext(goal);
  const changed = contextChanges(root);
  assert.ok(changed.includes("conversation.md") && !changed.includes("goal.md"), changed.join());
  assert.match(resumeNote(["conversation.md"]), /Changed since your last turn: conversation\.md/);
});

test("Claude Code events become steps and a structured answer", () => {
  const steps = claudeSteps({type: "assistant", message: {content: [{type: "tool_use", name: "Read", input: {file_path: "/w/es/context/sessions.md"}}, {type: "tool_use", name: "WebFetch", input: {url: "https://www.example.org/x"}}]}}, "/w/es");
  assert.deepEqual(steps.map(s => s.text), ["Reading sessions.md", "Reading example.org"]);
  const linked = claudeSteps({type: "assistant", message: {content: [{type: "tool_use", name: "Read", input: {file_path: "/private/w/es/inbox/ab12cd34-scan.pdf.txt"}}]}}, "/w/es");
  assert.deepEqual(linked.map(s => s.text), ["Reading your file scan.pdf"], "a symlinked root still gives a short label");
  assert.deepEqual(claudeResult({type: "result", is_error: false, structured_output: {a: 1}}), {ok: true, output: {a: 1}});
  assert.equal(claudeResult({type: "result", is_error: true, result: "boom"})?.ok, false);
  assert.equal(claudeResult({type: "assistant"}), null);
});
