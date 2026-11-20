// The agent is stateless: everything it knows is exported from the database into context/ before each turn.
// These check that the conversation, knowledge map and profile reach it, and that both CLIs are invoked safely.
import {test, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, existsSync, rmSync} from "node:fs";
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

const turn = {root: "/w/es", job: "j1", schemaPath: "/w/es/jobs/j1/schema.json", schemaJson: '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}', resultPath: "/w/es/jobs/j1/result.json", web: false, images: [], model: "", rules: "RULES"};

test("Codex runs are ephemeral and sandboxed to the workspace", () => {
  const a = codexArgs(turn);
  assert.ok(a.includes("--ephemeral"));
  assert.equal(a[a.indexOf("--sandbox") + 1], "workspace-write");
  assert.ok(!a.includes("resume"));
});

test("Claude Code runs are not saved, ignore user settings and may only write to out/<job>/", () => {
  const a = claudeArgs(turn);
  for (const f of ["--no-session-persistence", "--strict-mcp-config"]) assert.ok(a.includes(f), f);
  assert.equal(a[a.indexOf("--permission-mode") + 1], "dontAsk");
  assert.equal(a[a.indexOf("--setting-sources") + 1], "");
  assert.equal(a[a.indexOf("--json-schema") + 1], '{"type":"object"}', "Claude Code rejects the $schema header");
  assert.ok(a.includes("Write(./out/j1/**)") && a.includes("Read(./**)"));
  assert.ok(!a.some(x => /^(Write|Edit)$/.test(x)), "no unscoped write permission");
  assert.ok(!a.join(",").includes("WebSearch"), "no web without a task that needs it");
  assert.ok(claudeArgs({...turn, web: true}).includes("WebFetch"));
});

test("Claude Code events become steps and a structured answer", () => {
  const steps = claudeSteps({type: "assistant", message: {content: [{type: "tool_use", name: "Read", input: {file_path: "/w/es/context/sessions.md"}}, {type: "tool_use", name: "WebFetch", input: {url: "https://www.example.org/x"}}]}}, "/w/es");
  assert.deepEqual(steps.map(s => s.text), ["Reading sessions.md", "Reading example.org"]);
  assert.deepEqual(claudeResult({type: "result", is_error: false, structured_output: {a: 1}}), {ok: true, output: {a: 1}});
  assert.equal(claudeResult({type: "result", is_error: true, result: "boom"})?.ok, false);
  assert.equal(claudeResult({type: "assistant"}), null);
});
