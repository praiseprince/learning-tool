import { spawn,execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir,mkdtemp,rm } from "node:fs/promises";
import { chromium } from "playwright";

const port = 3100;
const temporary = await mkdtemp(join(tmpdir(),"marginalia-shots-"));
const env = {...process.env,AI_PROVIDER:"stub",DATABASE_URL:join(temporary,"demo.db")};
execFileSync(process.execPath,["scripts/seed-demo.mjs"],{env});
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", process.env.SHOTS_PRODUCTION ? "start" : "dev", "-p", String(port)], { stdio: "ignore",env });
const waitForServer = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/styleguide`)).ok) return; } catch { /* wait */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The screenshot server did not start.");
};

try {
  await mkdir("design/current", { recursive: true });
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const routes = [["styleguide", "/styleguide"], ["home", "/j/piano"], ["log", "/j/piano/log"], ["plan", "/j/piano/plan"], ["focus","/j/piano/focus?plan=piano-demo-plan"], ["understood","/j/piano/log?entry=piano-entry-1"], ["skills", "/j/piano/skills"], ["skill-drawer","/j/piano/skills?skill=piano-0"], ["journal","/j/piano/journal"], ["journal-reviews","/j/piano/journal?tab=reviews"], ["review","/j/piano/review/piano-demo-review"], ["goal", "/j/piano/goal"], ["new", "/new"]];
  for (const [name, width, height] of [["390", 390, 844], ["1280", 1280, 800]]) {
    for (const theme of ["light", "dark"]) {
      for (const [routeName, route] of routes) {
        const page = await browser.newPage({ viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "networkidle" });
        await page.evaluate((currentTheme) => { document.documentElement.dataset.theme = currentTheme; }, theme);
        if (routeName === "understood") await page.getByRole("button", {name:"Looks right"}).waitFor();
        await page.screenshot({ path: `design/current/${routeName}-${name}-${theme}.png`, fullPage: true });
        await page.close();
      }
    }
  }
  await browser.close();
  console.log("Styleguide screenshots written to design/current.");
} finally {
  server.kill();
  await rm(temporary,{recursive:true,force:true});
}
