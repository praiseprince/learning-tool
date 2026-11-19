// Week plans and quizzes: schema limits, ingest, accepting a week, and which days count as done.
// Runs on a throwaway database: npm test
import {test, before, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marginalia-test-"));
process.env.DATABASE_URL = join(dir, "t.db");
process.env.MARGINALIA_WORKSPACES = join(dir, "workspace");
process.env.AI_PROVIDER = "stub";

const {sqlite} = await import("../lib/db/client.ts");
const {Week, Quiz, nextDays, stubResult} = await import("../lib/agent/tasks.ts");
const {ingest} = await import("../lib/agent/ingest.ts");
const {acceptWeek, currentWeek, todaySlot, weekById, doneDays} = await import("../lib/agent/week.ts");
const {ensureChat, events} = await import("../lib/chat/events.ts");

const goal = "g-test";
const [d0, d1, d2] = nextDays(3);
const now = new Date().toISOString();

before(() => {
  ensureChat();
  sqlite.prepare("INSERT INTO journey (id,name,domain,hue,start_date,status,last_seen_at,created_at) VALUES (?,?,?,?,?,'active',?,?)").run(goal, "Test goal", "test", 200, d0, now, now);
});
after(() => { sqlite.close(); rmSync(dir, {recursive: true, force: true}); });

const week = (days: {date: string; minutes: number}[]) => ({review: "Last week went fine.", adjustments: [], days: days.map(d => ({...d, focus: "Scales", why: "Warm up"}))});
const job = (kind: "week" | "quiz") => ({id: "job-" + Math.random().toString(36).slice(2), goal, kind, input: {}});

test("nextDays gives consecutive local dates, across a month end", () => {
  assert.deepEqual(nextDays(3, new Date(2026, 0, 30)), ["2026-01-30", "2026-01-31", "2026-02-01"]);
});

test("Week schema rejects bad dates, too many days and over-long sessions", () => {
  assert.ok(Week.safeParse(week([{date: d0, minutes: 30}])).success);
  assert.ok(!Week.safeParse(week([{date: "Thursday", minutes: 30}])).success);
  assert.ok(!Week.safeParse(week([{date: d0, minutes: 300}])).success);
  assert.ok(!Week.safeParse(week(nextDays(8).map(date => ({date, minutes: 20})))).success);
  assert.ok(!Week.safeParse(week([])).success);
});

test("Quiz schema needs 1 to 8 questions", () => {
  const q = {q: "What is the tonic?", a: "The first degree.", skill: "", source: ""};
  assert.ok(Quiz.safeParse({title: "Quiz", questions: [q]}).success);
  assert.ok(!Quiz.safeParse({title: "Quiz", questions: []}).success);
  assert.ok(!Quiz.safeParse({title: "Quiz", questions: Array(9).fill(q)}).success);
});

test("stub results satisfy their own schemas", () => {
  const ctx = {goalName: "Test goal", skills: ["Scales"]};
  assert.ok(Week.safeParse(stubResult("week", "j", {}, ctx)).success);
  assert.ok(Quiz.safeParse(stubResult("quiz", "j", {}, ctx)).success);
});

test("a week is ingested as a pending proposal with sorted, de-duplicated days", async () => {
  await ingest(job("week"), week([{date: d2, minutes: 20}, {date: d0, minutes: 30}, {date: d0, minutes: 45}]));
  const ev = events(goal).filter(e => e.kind === "week").at(-1)!;
  const w = weekById(goal, ev.payload.week)!;
  assert.equal(w.status, "pending");
  assert.deepEqual(w.days.map(d => [d.date, d.minutes]), [[d0, 45], [d2, 20]]);
  assert.equal(currentWeek(goal), null, "a pending week is not the current week");
});

test("accepting a week makes it current and supersedes the previous one", async () => {
  await ingest(job("week"), week([{date: d0, minutes: 25}]));
  const first = events(goal).filter(e => e.kind === "week").at(-1)!.payload.week;
  acceptWeek(goal, first);
  assert.equal(todaySlot(goal)?.minutes, 25);

  await ingest(job("week"), week([{date: d0, minutes: 40}, {date: d1, minutes: 0}]));
  const second = events(goal).filter(e => e.kind === "week").at(-1)!.payload.week;
  acceptWeek(goal, second);
  assert.equal(currentWeek(goal)?.id, second);
  assert.equal(todaySlot(goal)?.minutes, 40);
  assert.equal(weekById(goal, first)?.status, "superseded");
  assert.throws(() => acceptWeek(goal, second), /already handled/);
});

test("weekById ignores other goals and non-string ids", () => {
  const id = currentWeek(goal)!.id;
  assert.equal(weekById("other-goal", id), null);
  assert.equal(weekById(goal, 42), null);
});

test("doneDays marks only dates with a logged session", () => {
  sqlite.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,kind,occurred_on,created_at) VALUES (?,?,?,?,'practice',?,?)").run("log-1", goal, "Scales", 30, d1, now);
  assert.deepEqual([...doneDays(goal, [d0, d1, d2])], [d1]);
  assert.equal(doneDays(goal, []).size, 0);
});

test("a quiz is ingested as a chat event carrying its questions", async () => {
  await ingest(job("quiz"), {title: "Scales", questions: [{q: "Name the notes of C major.", a: "C D E F G A B", skill: "Scales", source: "notes/scales.md"}]});
  const ev = events(goal).filter(e => e.kind === "quiz").at(-1)!;
  assert.equal(ev.payload.title, "Scales");
  assert.equal(ev.payload.questions.length, 1);
});
