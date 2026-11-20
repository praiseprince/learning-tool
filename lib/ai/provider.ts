// Which agent CLI runs the Guide. Every turn is a fresh, stateless run: the database is the memory, rebuilt into context/ each time.
import {execFileSync} from "node:child_process";
import {sqlite} from "../db/client.ts";

export const PROVIDERS = ["codex", "claude"] as const;
export type Provider = typeof PROVIDERS[number];
export const PROVIDER_NAME: Record<Provider, string> = {codex: "Codex", claude: "Claude Code"};

let ready = false;
function ensure() {
  if (ready) return;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS app_setting(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  ready = true;
}

/** "stub" when AI_PROVIDER=stub (tests, offline); otherwise the choice saved in Settings, then AI_PROVIDER, then Codex. */
export function aiProvider(): Provider | "stub" {
  if (process.env.AI_PROVIDER === "stub") return "stub";
  ensure();
  const saved = (sqlite.prepare("SELECT value FROM app_setting WHERE key='ai_provider'").get() as {value: string} | undefined)?.value;
  for (const p of [saved, process.env.AI_PROVIDER]) if ((PROVIDERS as readonly string[]).includes(p ?? "")) return p as Provider;
  return "codex";
}
export function setAiProvider(p: Provider) {
  if (!PROVIDERS.includes(p)) throw Error("Unknown AI.");
  ensure(); sqlite.prepare("INSERT OR REPLACE INTO app_setting(key,value) VALUES ('ai_provider',?)").run(p);
}
/** The model override for a provider, if any. */
export function aiModel(p: Provider) { return (p === "claude" ? process.env.CLAUDE_MODEL : process.env.AI_MODEL) || ""; }

const found = new Map<string, boolean>();
/** Whether the CLI is installed on this computer (cached per process). */
export function installed(p: Provider) {
  if (!found.has(p)) { try { execFileSync(p, ["--version"], {stdio: "ignore", timeout: 5000}); found.set(p, true); } catch { found.set(p, false); } }
  return found.get(p)!;
}

