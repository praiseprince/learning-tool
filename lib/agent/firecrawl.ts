// Firecrawl Local (one binary, no API key, no Docker) lets the Guide read whole web pages, JavaScript rendered, on this machine.
// `npm install` builds it into .tools/bin; the app starts `firecrawl-local serve` on 127.0.0.1 the first time it is needed
// and stops it on exit. FIRECRAWL_CLOUD=off: nothing goes to Firecrawl's servers. Finding pages stays with the agents'
// own web search (Firecrawl's keyless search refuses many networks). When it is unavailable, the agents' tools are used.
import {spawn, type ChildProcess} from "node:child_process";
import {existsSync, mkdirSync} from "node:fs";
import {join} from "node:path";

export const firecrawlUrl = () => (process.env.FIRECRAWL_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const headers = () => ({"content-type": "application/json", ...(process.env.FIRECRAWL_API_KEY ? {authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`} : {})});

/** The bundled binary, if `npm install` built it. FIRECRAWL_LOCAL_BIN overrides. */
export function firecrawlBin(): string | null {
  const p = process.env.FIRECRAWL_LOCAL_BIN || join(process.cwd(), ".tools", "bin", "firecrawl-local");
  return existsSync(p) ? p : null;
}

type G = typeof globalThis & {__firecrawl?: ChildProcess; __firecrawlCache?: {at: number; up: boolean}};
const g = globalThis as G;
async function answers() {
  for (const path of ["/health", "/"]) { try { const r = await fetch(firecrawlUrl() + path, {signal: AbortSignal.timeout(1500)}); if (r.ok) return true; } catch { /* not running */ } }
  return false;
}
/** Starts the bundled Firecrawl Local on the configured port, once per app process, and waits until it answers. */
async function launch(): Promise<boolean> {
  const bin = firecrawlBin(), u = new URL(firecrawlUrl());
  if (!bin || g.__firecrawl || !["127.0.0.1", "localhost"].includes(u.hostname)) return false;
  const home = join(process.cwd(), ".tools", "firecrawl-home"); mkdirSync(home, {recursive: true});
  const child = spawn(bin, ["serve", "--host", "127.0.0.1", "--port", u.port || "3002"], {stdio: "ignore",
    env: {...process.env, FIRECRAWL_CLOUD: "off", FIRECRAWL_LOCAL_HOME: home}});
  g.__firecrawl = child;
  child.on("exit", () => { if (g.__firecrawl === child) g.__firecrawl = undefined; g.__firecrawlCache = undefined; });
  const stop = () => { try { child.kill(); } catch { /* gone */ } };
  process.once("exit", stop); // Next.js turns SIGINT/SIGTERM into an exit; an orphan left by a crash is simply reused next time
  for (let i = 0; i < 40; i++) { if (await answers()) return true; if (child.exitCode !== null) return false; await new Promise(r => setTimeout(r, 250)); }
  return false;
}

/** Whether Firecrawl answers, starting the bundled one if needed; checked at most every 30 seconds. FIRECRAWL_URL=off disables it. */
export async function firecrawlUp(): Promise<boolean> {
  if (process.env.FIRECRAWL_URL === "off") return false;
  const c = g.__firecrawlCache; if (c && Date.now() - c.at < 30_000) return c.up;
  const up = await answers() || await launch();
  g.__firecrawlCache = {at: Date.now(), up}; return up;
}

export type Page = {ok: boolean; status: number; url: string; title: string; markdown: string; error?: string};
/** Fetches and renders one page as Markdown (main content only). */
export async function scrape(url: string, timeoutMs = 45_000): Promise<Page> {
  try {
    const r = await fetch(firecrawlUrl() + "/v2/scrape", {method: "POST", headers: headers(), signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({url, formats: ["markdown"], onlyMainContent: true, timeout: Math.max(5000, timeoutMs - 5000)})});
    const j = await r.json().catch(() => ({})) as {success?: boolean; error?: string; data?: {markdown?: string; metadata?: {title?: string | string[]; statusCode?: number; sourceURL?: string; url?: string}}};
    const m = j.data?.metadata ?? {}, status = m.statusCode ?? (r.ok ? 200 : r.status), title = Array.isArray(m.title) ? m.title[0] ?? "" : m.title ?? "";
    return {ok: !!j.success && status < 400, status, url: m.url || m.sourceURL || url, title: String(title).trim(), markdown: j.data?.markdown ?? "", ...(j.success ? {} : {error: String(j.error ?? `HTTP ${r.status}`).slice(0, 200)})};
  } catch (e) { return {ok: false, status: 0, url, title: "", markdown: "", error: (e as Error).name === "TimeoutError" ? "Timed out." : String((e as Error).message).slice(0, 200)}; }
}
