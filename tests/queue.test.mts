// Typing ahead: a message that needs the Guide while it is busy waits in the thread and goes when the job ends.
import {test, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marginalia-queue-"));
process.env.DATABASE_URL = join(dir, "t.db");
process.env.MARGINALIA_WORKSPACES = join(dir, "workspace");
process.env.AI_PROVIDER = "stub";

const {sqlite} = await import("../lib/db/client.ts");
const {createGoal} = await import("../lib/v2/brief.ts");
const {post, withdraw} = await import("../lib/chat/route.ts");
const {events} = await import("../lib/chat/events.ts");
const {runningJob, cancelJob} = await import("../lib/agent/jobs.ts");
after(() => { sqlite.close(); rmSync(dir, {recursive: true, force: true}); });

const goal = "q";
createGoal(goal, {title: "Chess", goal: "Reach 1500.", why: "", doneLooksLike: "", currentPosition: "", constraints: "", materials: [],
  roadmap: [{phase: "Tactics", focus: "", outcomes: [], skills: ["Forks"]}], skills: [{name: "Forks", description: "", status: "target", level: 0, evidence: "", requires: []}]});
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const users = () => events(goal).filter(e => e.kind === "user").map(e => [e.payload.text, e.status]);
const until = async (ok: () => boolean, ms = 8000) => { for (let t = 0; t < ms && !ok(); t += 100) await wait(100); assert.ok(ok(), "timed out"); };

test("messages typed while the Guide works wait, then go in order", async () => {
  assert.equal(post(goal, {text: "Why do knights fork so well?"}).queued, false);
  assert.ok(runningJob(goal));
  assert.equal(post(goal, {text: "And how do I spot them in a game?"}).queued, true);
  assert.equal(post(goal, {text: "I practised forks for 20 minutes"}).queued, false, "logging never waits");
  post(goal, {text: "Quiz me on forks"});
  assert.deepEqual(users().map(u => u[1]), ["done", "queued", "done", "queued"]);
  await until(() => events(goal).filter(e => e.kind === "quiz").length === 1);
  assert.deepEqual(users().map(u => u[1]), ["done", "done", "done", "done"]);
  assert.equal(events(goal).filter(e => e.kind === "guide" && /Stub answer/.test(e.payload.markdown)).length, 2, "both questions answered");
});

test("a waiting message can be taken back, and stopping a job lets the next one go", async () => {
  await until(() => !runningJob(goal));
  post(goal, {text: "What is a discovered attack?"}); const job = runningJob(goal)!;
  post(goal, {text: "Never mind this one?"}); post(goal, {text: "What about pins?"});
  const [, , , , , dropped] = events(goal).filter(e => e.kind === "user"); withdraw(goal, dropped.seq);
  cancelJob(job.id);
  await until(() => events(goal).some(e => e.kind === "guide" && /What about pins/.test(e.payload.markdown ?? "")));
  assert.equal(events(goal).find(e => e.seq === dropped.seq)?.status, "withdrawn");
  const {exportContext} = await import("../lib/agent/workspace.ts");
  const {readFileSync} = await import("node:fs");
  const {searchMessages} = await import("../lib/chat/events.ts");
  exportContext(goal);
  assert.doesNotMatch(readFileSync(join(process.env.MARGINALIA_WORKSPACES!, goal, "context", "conversation.md"), "utf8"), /Never mind/, "the Guide never sees a message that was taken back");
  assert.deepEqual(searchMessages("never mind"), []);
  assert.ok(!events(goal).some(e => e.kind === "guide" && /Never mind|discovered attack/.test(e.payload.markdown ?? "")), "nothing from the withdrawn message or the stopped job");
});
