// Screenshots of every screen at phone and desktop widths, light and dark, on throwaway data.
// Fails on horizontal overflow, a page error, or a non-200 response. Output: design/current/<screen>-<width>-<theme>.png
// Usage: npm run shots   (preshots builds first; never touches data/app.db)
import {spawn, execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {mkdir, mkdtemp, rm} from "node:fs/promises";
import {chromium} from "playwright";

const port = 3179, base = `http://127.0.0.1:${port}`;
const temporary = await mkdtemp(join(tmpdir(), "marginalia-shots-"));
const env = {...process.env, AI_PROVIDER: "stub", MARGINALIA_V2: "1", DATABASE_URL: join(temporary, "shots.db"), MARGINALIA_WORKSPACES: join(temporary, "workspace")};
Object.assign(process.env, env);
for (const seed of ["seed-showcase.mjs", "seed-worstcase.mjs"]) execFileSync(process.execPath, ["scripts/" + seed], {env, stdio: "ignore"});

// Put a week plan, an accepted week and a quiz into the Plato thread so their cards are on screen.
const {ingest} = await import("../lib/agent/ingest.ts");
const {acceptWeek} = await import("../lib/agent/week.ts");
const {stubResult} = await import("../lib/agent/tasks.ts");
const {sqlite} = await import("../lib/db/client.ts");
const {events} = await import("../lib/chat/events.ts");
const ctx = {goalName: "Plato", skills: []};
await ingest({id: "shots-week-1", goal: "plato", kind: "week", input: {}}, stubResult("week", "shots-week-1", {}, ctx));
acceptWeek("plato", events("plato").filter(e => e.kind === "week").at(-1).payload.week);
await ingest({id: "shots-week-2", goal: "plato", kind: "week", input: {}}, stubResult("week", "shots-week-2", {}, ctx));
await ingest({id: "shots-quiz", goal: "plato", kind: "quiz", input: {}}, stubResult("quiz", "shots-quiz", {}, ctx));
const note = sqlite.prepare("SELECT id FROM document WHERE journey_id='plato' AND status='active' ORDER BY updated_at DESC LIMIT 1").get()?.id;
const node = sqlite.prepare("SELECT id FROM atlas_node LIMIT 1").get()?.id;
const source = sqlite.prepare("SELECT id FROM resource LIMIT 1").get()?.id;
sqlite.close();

const routes = [
  ["chat", "/?goal=plato"], ["chat-new", "/?goal=w-new"], ["chat-rtl", "/?goal=w-arabic"],
  ["goals", "/goals"], ["goal", "/goals/plato"], ["goal-skills", "/goals/plato?tab=skills"], ["goal-materials", "/goals/plato?tab=materials"],
  ["goal-notes", "/goals/plato?tab=notes"], ["goal-history", "/goals/plato?tab=history"], ["goal-long", "/goals/w-hegel"], ["goal-empty", "/goals/w-new"],
  ["new-goal", "/goals/new"], ["revise", "/goals/plato/revise"],
  ["notes", "/notebook"], ["inbox", "/notebook/inbox"], ["note-long", "/notebook/d/w-note-long"],
  ...(note ? [["note", `/notebook/d/${note}`]] : []), ...(source ? [["source", `/notebook/s/${source}`]] : []),
  ["map", "/atlas"], ...(node ? [["map-node", `/atlas/n/${node}`]] : []),
  ["progress", "/progress"], ["settings", "/you"],
];

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {stdio: "ignore", env});
const problems = [];
try {
  for (let i = 0; ; i++) {
    if (server.exitCode !== null) throw Error("The screenshot server exited. Run npm run build first.");
    try { if ((await fetch(base + "/goals")).ok) break; } catch { /* starting */ }
    if (i > 120) throw Error("The screenshot server did not start.");
    await new Promise(r => setTimeout(r, 250));
  }
  await mkdir("design/current", {recursive: true});
  const browser = await chromium.launch();
  for (const [size, width, height] of [["390", 390, 844], ["1280", 1280, 800]]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({viewport: {width, height}, colorScheme: theme, reducedMotion: "reduce"});
    for (const [name, route] of routes) {
      const page = await context.newPage();
      page.on("pageerror", e => problems.push(`${name} ${size} ${theme}: ${e.message}`));
      const response = await page.goto(base + route, {waitUntil: "networkidle"});
      if (response?.status() !== 200) problems.push(`${name}: ${route} returned ${response?.status()}`);
      if (name.startsWith("map")) await page.waitForTimeout(1500);
      await page.evaluate(() => document.fonts.ready);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${name} ${size} ${theme}: horizontal overflow`);
      await page.screenshot({path: `design/current/${name}-${size}-${theme}.png`, fullPage: !name.startsWith("chat") && !name.startsWith("map")});
      await page.close();
    }
    await context.close();
  }
  await browser.close();
} finally {
  server.kill();
  await rm(temporary, {recursive: true, force: true});
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`${routes.length} screens × 2 widths × 2 themes written to design/current.`);
