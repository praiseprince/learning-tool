// Deleting an archived goal removes everything that belongs to it and nothing that belongs to another goal.
import {test, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, existsSync, readdirSync, rmSync, mkdirSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";

const dir = mkdtempSync(join(tmpdir(), "marginalia-delgoal-"));
const db = join(dir, "t.db"), ws = join(dir, "workspace");
const env = {...process.env, DATABASE_URL: db, MARGINALIA_WORKSPACES: ws, AI_PROVIDER: "stub", MARGINALIA_V2: "1"};
execFileSync(process.execPath, ["scripts/seed-showcase.mjs"], {env, stdio: "ignore"});
Object.assign(process.env, env);
const {sqlite} = await import("../lib/db/client.ts");
const {ensureAgent} = await import("../lib/agent/jobs.ts");
const {addEvent} = await import("../lib/chat/events.ts");
const {deleteGoal} = await import("../lib/v2/delete-goal.ts");
after(() => { sqlite.close(); rmSync(dir, {recursive: true, force: true}); });

const goalTables: [string, string][] = [["charter", "journey_id"], ["skill", "journey_id"], ["log_entry", "journey_id"], ["proposal", "journey_id"], ["plan_item", "journey_id"],
  ["document", "journey_id"], ["atlas_membership", "journey_id"], ["learning_route", "journey_id"], ["chat_event", "goal"], ["agent_job", "goal"], ["knowledge_observation", "journey"]];
const has = (t: string) => !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name=?").get(t);
const count = (goal: string) => Object.fromEntries(goalTables.filter(([t]) => has(t)).map(([t, c]) => [t, (sqlite.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${c}=?`).get(goal) as {n: number}).n]));

test("only an archived goal can be deleted; then all of it goes, and other goals are untouched", () => {
  ensureAgent();
  const [a, b] = (sqlite.prepare("SELECT id FROM journey ORDER BY id").all() as {id: string}[]).map(r => r.id);
  addEvent(a, "user", {text: "something in the chat"});
  mkdirSync(join(ws, a, "inbox"), {recursive: true}); writeFileSync(join(ws, a, "inbox", "x.md"), "file");
  const before = count(a), other = count(b), nodesOfB = (sqlite.prepare("SELECT COUNT(*) n FROM atlas_membership m JOIN atlas_node n ON n.id=m.node_id WHERE m.journey_id=?").get(b) as {n: number}).n;
  assert.ok(Object.values(before).reduce((x, y) => x + y, 0) > 5, "the seed gives the goal real data");

  const refused = deleteGoal(a); assert.equal(refused.ok, false, "an active goal is refused");
  sqlite.prepare("UPDATE journey SET status='archived' WHERE id=?").run(a);
  const r = deleteGoal(a); assert.ok(r.ok);
  assert.ok(existsSync(r.backup), "a backup copy is kept");
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM journey WHERE id=?").get(a)?.["n" as never], 0);
  for (const [t, n] of Object.entries(count(a))) assert.equal(n, 0, `${t} still has rows for the deleted goal`);
  assert.deepEqual(count(b), other, "the other goal keeps everything");
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM atlas_membership m JOIN atlas_node n ON n.id=m.node_id WHERE m.journey_id=?").get(b) as {n: number}).n, nodesOfB, "shared Map concepts stay");
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), [], "nothing points at a deleted row");
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM skill_event WHERE skill_id NOT IN (SELECT id FROM skill)").get() as {n: number}).n, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM document_revision WHERE document_id NOT IN (SELECT id FROM document)").get() as {n: number}).n, 0);
  assert.ok(!existsSync(join(ws, a)), "its files moved out of the workspace");
  assert.ok(readdirSync(dir).some(f => f.endsWith("-files")), "…to beside the backup");
  assert.equal(deleteGoal(a).ok, false, "only once");
});
