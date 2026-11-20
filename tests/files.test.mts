// Files shared in the chat: checked, kept in the goal's inbox, given a text copy when needed, and remembered in context/.
import {test, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, existsSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";

const dir = mkdtempSync(join(tmpdir(), "marginalia-files-"));
process.env.DATABASE_URL = join(dir, "t.db");
process.env.MARGINALIA_WORKSPACES = join(dir, "workspace");
process.env.AI_PROVIDER = "stub";

const {sqlite} = await import("../lib/db/client.ts");
const {createGoal} = await import("../lib/v2/brief.ts");
const {exportContext} = await import("../lib/agent/workspace.ts");
const {addEvent} = await import("../lib/chat/events.ts");
const {saveShared, refuse, sharedFrom} = await import("../lib/chat/files.ts");
const {withFiles, classify} = await import("../lib/chat/run.ts");
const {attachmentNote, promptFor} = await import("../lib/agent/tasks.ts");
after(() => { sqlite.close(); rmSync(dir, {recursive: true, force: true}); });

const goal = "gtr";
createGoal(goal, {title: "Guitar", goal: "Play a song.", why: "", doneLooksLike: "", currentPosition: "", constraints: "", materials: [],
  roadmap: [{phase: "Basics", focus: "", outcomes: [], skills: ["Chords"]}], skills: [{name: "Chords", description: "", status: "target", level: 0, evidence: "", requires: []}]});
const inbox = (f: string) => join(process.env.MARGINALIA_WORKSPACES!, goal, "inbox", f);

test("types and sizes are checked before anything is saved", () => {
  assert.equal(refuse("tab.png", 1000), null);
  assert.equal(refuse("essay.docx", 1000), null);
  assert.equal(refuse("solve.py", 10), null);
  assert.match(refuse("song.mp3", 1000)!, /isn't supported/);
  assert.match(refuse("scan.pdf", 21 * 1024 * 1024)!, /over 20 MB/);
  assert.match(refuse("empty.txt", 0)!, /empty/);
});

test("a long message that asks something reaches the Guide, a short time window is a plan", () => {
  assert.equal(classify("I have 25 minutes, what now?").kind, "plan");
  assert.equal(classify("I just started a new job with a long commute, so from now on I can only study on the train for about 25 minutes. What should I read next?").kind, "ask");
  assert.equal(classify("I practised scales for 20 minutes").kind, "log");
});

test("a message with files goes where its words point", () => {
  assert.equal(withFiles(""), "review");
  assert.equal(withFiles("Can you give me feedback on my chord changes?"), "review");
  assert.equal(withFiles("I practised this for 20 minutes"), "review");
  assert.equal(withFiles("What does the second chapter say about barre chords?"), "ask");
  assert.equal(withFiles("Quiz me on this"), "quiz");
  assert.equal(withFiles("Make me practice exercises from this worksheet"), "practice");
});

test("files are stored under unique, safe names and documents get a text copy", async () => {
  const pdf = (() => { try { execFileSync("which", ["pdftotext"]); return true; } catch { return false; } })();
  const files = [new File(["# Notes\nG C D"], "../../My notes (v2).md"), new File([Buffer.from([0x89, 0x50, 0x4e, 0x47])], "photo.png")];
  if (pdf) files.push(new File([readFileSync(new URL("./fixtures/hello.pdf", import.meta.url))], "hello.pdf"));
  const saved = await saveShared(goal, files);
  assert.match(saved[0].stored, /^[a-f0-9]{8}-My_notes_v2_\.md$/);
  assert.ok(existsSync(inbox(saved[0].stored)));
  assert.equal(saved[1].type, "image");
  if (pdf) { assert.equal(saved[2].text, saved[2].stored + ".txt"); assert.match(readFileSync(inbox(saved[2].text!), "utf8"), /Hello from a PDF/); }
  await assert.rejects(saveShared(goal, [new File(["x"], "a.exe")]), /isn't supported/);

  addEvent(goal, "user", {text: "Here are my notes", files: saved});
  addEvent(goal, "user", {text: "old style", files: ["legacy.png"]});
  assert.equal(sharedFrom({files: ["legacy.png"]})[0].type, "image");
  exportContext(goal);
  const ctx = (f: string) => readFileSync(join(process.env.MARGINALIA_WORKSPACES!, goal, "context", f), "utf8");
  assert.match(ctx("files.md"), new RegExp(`inbox/${saved[0].stored}.*they wrote “Here are my notes”`));
  assert.match(ctx("conversation.md"), new RegExp(`Here are my notes \\[attached: inbox/${saved[0].stored}`));
  assert.match(ctx("README.md"), /files\.md/);
});

test("every task is told about the attached files", () => {
  const a = [{name: "scan.pdf", path: "inbox/ab-scan.pdf", text: "inbox/ab-scan.pdf.txt", type: "doc" as const}];
  assert.equal(attachmentNote([]), "");
  assert.match(attachmentNote(a), /inbox\/ab-scan\.pdf \("scan\.pdf", document; its text is in inbox\/ab-scan\.pdf\.txt\)/);
  for (const k of ["ask", "quiz", "practice", "review"] as const) assert.match(promptFor(k, "j1", {text: "x", attachments: a}), /attached a file/);
  assert.doesNotMatch(promptFor("ask", "j1", {text: "x"}), /attached/);
});
