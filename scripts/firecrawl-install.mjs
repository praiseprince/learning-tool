// Builds Firecrawl Local (https://github.com/firecrawl/firecrawl/tree/main/apps/local) into .tools/bin with cargo.
// Runs from `npm install` (postinstall) and never fails it: without Rust, or if the build fails, the app simply uses the
// agents' built-in web tools. Rerun any time with: npm run setup:firecrawl
import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";

const VERSION = "0.1.1", bin = ".tools/bin/firecrawl-local", force = process.argv.includes("--force");
const say = m => console.log(`[firecrawl-local] ${m}`);
if (process.env.CI || process.env.MARGINALIA_SKIP_FIRECRAWL) process.exit(0);
if (existsSync(bin) && !force) {
  const v = spawnSync(bin, ["--version"], {encoding: "utf8"}).stdout ?? "";
  if (v.includes(VERSION)) process.exit(0);
}
if (spawnSync("cargo", ["--version"], {stdio: "ignore"}).status !== 0) {
  say("Rust is not installed, so web reading uses the agents' built-in tools. Install Rust (https://rustup.rs), then run: npm run setup:firecrawl");
  process.exit(0);
}
say(`Building firecrawl-local ${VERSION} into .tools/bin (a few minutes, once)…`);
const r = spawnSync("cargo", ["install", "firecrawl-local", "--version", VERSION, "--locked", "--root", ".tools"], {stdio: "inherit"});
say(r.status === 0 ? "Ready. The app starts it on 127.0.0.1:3002 when the Guide needs the web." : "Build failed; the app will use the agents' built-in web tools. Retry with: npm run setup:firecrawl");
process.exit(0);
