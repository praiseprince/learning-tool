import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const port = 3100;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], { stdio: "ignore" });
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
  for (const [name, width, height] of [["390", 390, 844], ["1280", 1280, 800]]) {
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(`http://127.0.0.1:${port}/styleguide`, { waitUntil: "networkidle" });
      await page.evaluate((currentTheme) => { document.documentElement.dataset.theme = currentTheme; }, theme);
      await page.screenshot({ path: `design/current/styleguide-${name}-${theme}.png`, fullPage: true });
      await page.close();
    }
  }
  await browser.close();
  console.log("Styleguide screenshots written to design/current.");
} finally {
  server.kill();
}
