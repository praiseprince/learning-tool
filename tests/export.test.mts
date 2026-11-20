// Your data leaves with you: the .zip export holds the data and every file; a reset keeps files beside the backup.
import {test, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";

const dir = mkdtempSync(join(tmpdir(), "marginalia-export-"));
process.env.DATABASE_URL = join(dir, "t.db");
process.env.MARGINALIA_WORKSPACES = join(dir, "workspace");
const {sqlite} = await import("../lib/db/client.ts");
const {zip} = await import("../lib/db/zip.ts");
const {workspaceFiles, clearWorkspaces} = await import("../lib/db/personal.ts");
after(() => { sqlite.close(); rmSync(dir, {recursive: true, force: true}); });

const ws = process.env.MARGINALIA_WORKSPACES!;
mkdirSync(join(ws, "g1", "inbox"), {recursive: true}); mkdirSync(join(ws, "g1", "out", "job1"), {recursive: true}); mkdirSync(join(ws, "g1", "context"), {recursive: true});
writeFileSync(join(ws, "g1", "inbox", "ab-essay.md"), "# My essay\nÉté, naïve, 日本語");
writeFileSync(join(ws, "g1", "out", "job1", "sheet.md"), "practice");
writeFileSync(join(ws, "g1", "context", "goal.md"), "derived");

test("the archive holds shared and generated files, not derived context, and unzips cleanly", () => {
  const files = workspaceFiles().map(f => f.path).sort();
  assert.deepEqual(files, ["files/g1/made-by-the-guide/job1/sheet.md", "files/g1/shared/ab-essay.md"]);
  const z = join(dir, "a.zip"); writeFileSync(z, zip([{name: "m/data.json", data: Buffer.from("{}")}, ...workspaceFiles().map(f => ({name: "m/" + f.path, data: f.data, date: f.date}))]));
  const listing = execFileSync("unzip", ["-t", z]).toString();
  assert.match(listing, /No errors detected/);
  assert.equal(execFileSync("unzip", ["-p", z, "m/files/g1/shared/ab-essay.md"]).toString(), "# My essay\nÉté, naïve, 日本語");
});

test("a reset moves the files beside the backup instead of deleting them", () => {
  const keep = join(dir, "backup-files");
  clearWorkspaces(keep);
  assert.ok(!existsSync(ws));
  assert.equal(readFileSync(join(keep, "g1", "inbox", "ab-essay.md"), "utf8").slice(0, 10), "# My essay");
});
