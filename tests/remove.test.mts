// Removing a message takes it and the Guide's replies out of the thread and the Guide's memory, and nothing else.
import {test, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, existsSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marginalia-remove-"));
process.env.DATABASE_URL = join(dir, "t.db");
process.env.MARGINALIA_WORKSPACES = join(dir, "workspace");
process.env.AI_PROVIDER = "stub";
const {sqlite} = await import("../lib/db/client.ts");
const {createGoal} = await import("../lib/v2/brief.ts");
const {addEvent, events, searchMessages} = await import("../lib/chat/events.ts");
const {saveShared} = await import("../lib/chat/files.ts");
const {removeExchange} = await import("../lib/chat/remove.ts");
const {exportContext} = await import("../lib/agent/workspace.ts");
const {recordTurn, sessionToResume} = await import("../lib/agent/session.ts");
const {ensureAgent} = await import("../lib/agent/jobs.ts");
after(() => { sqlite.close(); rmSync(dir, {recursive: true, force: true}); });

const goal = "rm";
createGoal(goal, {title: "Piano", goal: "Play Clair de Lune.", why: "", doneLooksLike: "", currentPosition: "", constraints: "", materials: [],
  roadmap: [{phase: "Basics", focus: "", outcomes: [], skills: ["Pedalling"]}], skills: [{name: "Pedalling", description: "", status: "target", level: 0, evidence: "", requires: []}]});
const one = (sql: string) => sqlite.prepare(sql).get() as Record<string, unknown>;
const now = new Date().toISOString(), ctx = (f: string) => readFileSync(join(process.env.MARGINALIA_WORKSPACES!, goal, "context", f), "utf8");
const proposal = (id: string, status = "pending") => sqlite.prepare("INSERT INTO proposal VALUES (?,?,'agent_action',?,?,'job',?,NULL)").run(id, goal, JSON.stringify({type: "remember", title: "Has a cat called Debussy.", body: "", why: "", url: ""}), status, now);

test("an exchange goes from the thread, the Guide's files, search and its session; accepted things stay", async () => {
  ensureAgent();
  addEvent(goal, "user", {text: "Keep this one about pedalling."}); addEvent(goal, "guide", {markdown: "Pedal on the beat."});
  const files = await saveShared(goal, [new File(["notes"], "wrong-file.md")]);
  const seq = addEvent(goal, "user", {text: "My cat Debussy walked on the keys, embarrassing", files});
  sqlite.prepare("INSERT INTO agent_job(id,goal,kind,status,input_json,created_at) VALUES ('j1',?,'ask','done','{\"text\":\"My cat Debussy\"}',?)").run(goal, now);
  addEvent(goal, "job", {job: "j1", kind: "ask"});
  addEvent(goal, "guide", {markdown: "A wrong idea about Debussy the cat."});
  proposal("p-pending"); proposal("p-accepted", "accepted");
  addEvent(goal, "suggestions", {ids: ["p-pending", "p-accepted"]});
  addEvent(goal, "user", {text: "Next question stays."});
  recordTurn(goal, "claude", "s1", 1000);

  assert.deepEqual(removeExchange(goal, seq), {ok: true, removed: 4});
  const left = events(goal).map(e => e.payload.text ?? e.payload.markdown ?? e.kind);
  assert.deepEqual(left, ["Keep this one about pedalling.", "Pedal on the beat.", "Next question stays."]);
  exportContext(goal);
  assert.doesNotMatch(ctx("conversation.md") + ctx("brief.md") + ctx("files.md"), /Debussy|wrong-file/);
  assert.deepEqual(searchMessages("debussy"), []);
  assert.ok(!existsSync(join(process.env.MARGINALIA_WORKSPACES!, goal, "inbox", files[0].stored)), "its files are deleted");
  assert.equal(one("SELECT COUNT(*) n FROM agent_job WHERE id='j1'").n, 0, "the job held the question too");
  assert.equal(one("SELECT status FROM proposal WHERE id='p-pending'").status, "dismissed");
  assert.equal(one("SELECT status FROM proposal WHERE id='p-accepted'").status, "accepted", "what was accepted stays");
  assert.equal(sessionToResume(goal, "claude").id, null, "the open session saw it, so it ends");
  assert.equal(removeExchange(goal, seq).ok, false, "only once");
});

test("an exchange the Guide is still working on cannot be removed", () => {
  const seq = addEvent(goal, "user", {text: "Working on it"});
  sqlite.prepare("INSERT INTO agent_job(id,goal,kind,status,input_json,created_at) VALUES ('j2',?,'ask','running','{}',?)").run(goal, now);
  addEvent(goal, "job", {job: "j2", kind: "ask"}, "working");
  const r = removeExchange(goal, seq);
  assert.equal(r.ok, false); assert.match((r as {error: string}).error, /still working/);
  assert.ok(events(goal).some(e => e.seq === seq));
  const guide = events(goal).find(e => e.kind === "guide")!;
  assert.equal(removeExchange(goal, guide.seq).ok, false, "only the learner's own messages start an exchange");
});
