// How each agent CLI is invoked for one stateless turn, and how its event stream is read.
import {relative} from "node:path";

export type Step = {at: string; kind: "search" | "open" | "run" | "write" | "say" | "error"; text: string};
export type Turn = {root: string; job: string; schemaPath: string; schemaJson: string; resultPath: string; web: boolean; images: string[]; model: string; rules: string};

/** Codex: one ephemeral run, sandboxed to the workspace folder. */
export function codexArgs(t: Turn) {
  return ["exec", "--json", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--sandbox", "workspace-write", "-C", t.root,
    ...(t.model ? ["--model", t.model] : []), ...(t.web ? ["-c", 'web_search="live"'] : []),
    "--output-schema", t.schemaPath, "-o", t.resultPath, ...t.images.flatMap(p => ["-i", p]), "-"];
}

/** Claude Code validates --json-schema itself and does not know zod's "$schema" draft header, so drop it. */
export function plainSchema(json: string) { const o = JSON.parse(json); delete o.$schema; return JSON.stringify(o); }

/** Claude Code: one print-mode run that is not saved, no user settings or MCP servers, and permissions that only allow reading the workspace and writing to out/<job>/. */
export function claudeArgs(t: Turn) {
  const tools = ["Read", "Grep", "Glob", "Write", "Edit", ...(t.web ? ["WebSearch", "WebFetch"] : [])];
  const allowed = ["Read(./**)", "Grep", "Glob", `Write(./out/${t.job}/**)`, `Edit(./out/${t.job}/**)`, ...(t.web ? ["WebSearch", "WebFetch"] : [])];
  return ["-p", "--output-format", "stream-json", "--verbose", "--json-schema", plainSchema(t.schemaJson), "--no-session-persistence", "--setting-sources", "", "--strict-mcp-config",
    "--permission-mode", "dontAsk", "--tools", tools.join(","), "--allowedTools", ...allowed, "--append-system-prompt", t.rules,
    ...(t.model ? ["--model", t.model] : [])];
}

/** Claude's final event: the structured answer, or why there is none. */
export function claudeResult(e: any): {ok: true; output: unknown} | {ok: false; error: string} | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (e?.type !== "result") return null;
  if (!e.is_error && e.structured_output !== undefined) return {ok: true, output: e.structured_output};
  return {ok: false, error: String(e.result || e.subtype || "No answer.").slice(0, 200)};
}

const now = () => new Date().toISOString();
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u.slice(0, 60); } };

/** Turns one Codex JSONL event into human steps. */
export function codexSteps(e: any): Step[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const at = now(), it = e?.item;
  if (e?.type === "error" && e.message) return [{at, kind: "error", text: String(e.message).slice(0, 200)}];
  if (e?.type === "item.started" && it?.type === "web_search") return it.query ? [{at, kind: "search", text: `Searching the web: ${String(it.query).slice(0, 120)}`}] : [];
  if (e?.type !== "item.completed" || !it) return [];
  if (it.type === "web_search") return !it.query && it.results?.[0]?.domain ? [{at, kind: "open", text: `Reading ${it.results[0].domain}`}] : [];
  if (it.type === "command_execution") return [{at, kind: "run", text: `Running: ${String(it.command ?? "").replace(/^\S*sh -lc\s+/, "").slice(0, 110)}`}];
  if (it.type === "file_change") return [{at, kind: "write", text: `Writing ${(it.changes ?? []).map((c: {path?: string}) => String(c.path ?? "").split("/").pop()).filter(Boolean).slice(0, 3).join(", ") || "a file"}`}];
  if (it.type === "agent_message" && it.text && !String(it.text).trim().startsWith("{")) return [{at, kind: "say", text: String(it.text).slice(0, 160)}];
  return [];
}

/** Turns one Claude Code stream-json event into human steps. */
export function claudeSteps(e: any, root: string): Step[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (e?.type !== "assistant" || !Array.isArray(e.message?.content)) return [];
  const at = now(), rel = (p: unknown) => relative(root, String(p ?? "")) || String(p ?? "");
  const out: Step[] = [];
  for (const b of e.message.content) {
    const i = b?.input ?? {};
    if (b?.type === "text" && b.text && !String(b.text).trim().startsWith("{")) out.push({at, kind: "say", text: String(b.text).slice(0, 160)});
    if (b?.type !== "tool_use") continue;
    if (b.name === "WebSearch" && i.query) out.push({at, kind: "search", text: `Searching the web: ${String(i.query).slice(0, 120)}`});
    else if (b.name === "WebFetch" && i.url) out.push({at, kind: "open", text: `Reading ${host(String(i.url))}`});
    else if (b.name === "Read" && i.file_path) out.push({at, kind: "open", text: `Reading ${rel(i.file_path).replace(/^context\//, "")}`});
    else if (b.name === "Grep" && i.pattern) out.push({at, kind: "search", text: `Searching your files for “${String(i.pattern).slice(0, 60)}”`});
    else if ((b.name === "Write" || b.name === "Edit") && i.file_path) out.push({at, kind: "write", text: `Writing ${String(i.file_path).split("/").pop()}`});
  }
  return out;
}
