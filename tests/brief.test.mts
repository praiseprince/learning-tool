// A drafted goal's roadmap keeps the phase as the step title and survives a round trip through "Revise goal".
import {test, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marginalia-brief-"));
process.env.DATABASE_URL = join(dir, "t.db");
process.env.AI_PROVIDER = "stub";
const {sqlite} = await import("../lib/db/client.ts");
const {createGoal, currentBrief} = await import("../lib/v2/brief.ts");
after(() => { sqlite.close(); rmSync(dir, {recursive: true, force: true}); });

test("roadmap steps are titled by phase, with the focus underneath", () => {
  const roadmap = [{phase: "Vectors and transformations", focus: "Start with the visual ideas, then the algebra.", outcomes: ["Explain matrix multiplication as composition."], skills: ["Matrices"]}];
  createGoal("la", {title: "Linear algebra", goal: "Understand PCA.", why: "", doneLooksLike: "", currentPosition: "", constraints: "", materials: [], roadmap,
    skills: [{name: "Matrices", description: "", status: "target", level: 0, evidence: "", requires: []}]});
  const step = JSON.parse((sqlite.prepare("SELECT content_json c FROM route_step").get() as {c: string}).c);
  assert.equal(step.title, "Vectors and transformations");
  assert.equal(step.reason, "Start with the visual ideas, then the algebra.");
  const back = currentBrief("la").roadmap[0];
  assert.deepEqual({phase: back.phase, focus: back.focus, outcomes: back.outcomes}, {phase: roadmap[0].phase, focus: roadmap[0].focus, outcomes: roadmap[0].outcomes});
});
