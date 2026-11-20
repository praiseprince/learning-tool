// How each agent CLI is invoked for one turn, and how its event stream is read.
// A turn either starts a fresh session or resumes the goal's recent one (see lib/agent/session.ts); the database stays the memory either way.
import {basename, relative} from "node:path";

export type Step = {at: string; kind: "search" | "open" | "run" | "write" | "say" | "error"; text: string};
export type Turn = {root: string; job: string; schemaPath: string; schemaJson: string; resultPath: string; web: boolean; images: string[]; model: string; rules: string; resume: string | null; mcp: Mcp | null};
/** A local MCP server to attach (Firecrawl). */
export type Mcp = {name: string; command: string; args: string[]; env: Record<string, string>; tools: string[]};
const toml = (v: unknown): string => Array.isArray(v) ? `[${v.map(toml).join(",")}]` : typeof v === "object" && v ? `{${Object.entries(v).map(([k, x]) => `${k}=${toml(x)}`).join(",")}}` : JSON.stringify(v);

/** Codex: `codex exec` (or `codex exec resume <id>`), run in the workspace folder with the workspace-write sandbox. */
export function codexArgs(t: Turn) {
  const m = t.mcp && t.web ? t.mcp : null, k = m ? `mcp_servers.${m.name}` : "";
  // Codex never continues a session here, so it keeps no transcript: removed messages leave nothing behind in ~/.codex
  return ["exec", ...(t.resume ? ["resume"] : []), "--json", ...(t.resume ? [] : ["--ephemeral"]), "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "-c", 'sandbox_mode="workspace-write"',
    // the workspace is its own project: without this Codex walks up to the app's git root and loads the developer AGENTS.md
    "-c", "project_root_markers=[]",
    ...(t.model ? ["--model", t.model] : []), ...(t.web ? ["-c", 'web_search="live"'] : []),
    ...(m ? ["-c", `${k}.command=${toml(m.command)}`, "-c", `${k}.args=${toml(m.args)}`, "-c", `${k}.env=${toml(m.env)}`, "-c", `${k}.startup_timeout_sec=20`, "-c", `${k}.default_tools_approval_mode="approve"`, "-c", `${k}.tool_timeout_sec=90`] : []),
    "--output-schema", t.schemaPath, "-o", t.resultPath, ...t.images.flatMap(p => ["-i", p]), ...(t.resume ? [t.resume] : []), "-"];
}

/** Claude Code validates --json-schema itself and does not know zod's "$schema" draft header, so drop it. */
export function plainSchema(json: string) { const o = JSON.parse(json); delete o.$schema; return JSON.stringify(o); }

/** Claude Code: print mode, no user settings and only our MCP server, and permissions that only allow reading the workspace and writing to out/<job>/. */
export function claudeArgs(t: Turn) {
  const m = t.mcp && t.web ? t.mcp : null;
  const tools = ["Read", "Grep", "Glob", "Write", "Edit", ...(t.web ? ["WebSearch", "WebFetch"] : [])];
  const allowed = ["Read(./**)", "Grep", "Glob", `Write(./out/${t.job}/**)`, `Edit(./out/${t.job}/**)`, ...(t.web ? ["WebSearch", "WebFetch"] : []), ...(m ? m.tools.map(x => `mcp__${m.name}__${x}`) : [])];
  return ["-p", "--output-format", "stream-json", "--verbose", "--json-schema", plainSchema(t.schemaJson), "--setting-sources", "", "--strict-mcp-config",
    ...(m ? ["--mcp-config", JSON.stringify({mcpServers: {[m.name]: {type: "stdio", command: m.command, args: m.args, env: m.env}}})] : []),
    "--include-partial-messages", "--permission-mode", "dontAsk", "--tools", tools.join(","), "--allowedTools", ...allowed, "--append-system-prompt", t.rules,
    ...(t.model ? ["--model", t.model] : []), ...(t.resume ? ["--resume", t.resume] : [])];
}

/** The session id, when this event announces it. */
export function sessionFrom(p: "codex" | "claude", e: any): string | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (p === "codex") return e?.type === "thread.started" && typeof e.thread_id === "string" ? e.thread_id : null;
  return e?.type === "system" && e.subtype === "init" && typeof e.session_id === "string" ? e.session_id : null;
}

/** Tokens a turn used: everything sent in (cached or not) and everything generated. */
export function usageFrom(p: "codex" | "claude", e: any): {input: number; cached: number; output: number} | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const u = e?.usage;
  if (p === "codex" && e?.type === "turn.completed" && u) return {input: Number(u.input_tokens) || 0, cached: Number(u.cached_input_tokens) || 0, output: (Number(u.output_tokens) || 0) + (Number(u.reasoning_output_tokens) || 0)};
  if (p === "claude" && e?.type === "result" && u) { const c = (Number(u.cache_read_input_tokens) || 0); return {input: (Number(u.input_tokens) || 0) + c + (Number(u.cache_creation_input_tokens) || 0), cached: c, output: Number(u.output_tokens) || 0}; }
  return null;
}

/** Claude's final event: the structured answer, or why there is none. */
export function claudeResult(e: any): {ok: true; output: unknown} | {ok: false; error: string} | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (e?.type !== "result") return null;
  if (!e.is_error && e.structured_output !== undefined) return {ok: true, output: e.structured_output};
  return {ok: false, error: String(e.result || e.subtype || "No answer.").slice(0, 200)};
}

const now = () => new Date().toISOString();
/** A workspace path as the learner would say it: "sessions.md", "your file essay.pdf". */
export const pathLabel = (r: string) => r.startsWith("inbox/") ? `your file ${r.slice(6).replace(/^[a-f0-9]{8}-/, "").replace(/\.txt$/, "")}` : r.replace(/^(\.\/)?context\//, "");
/** A search pattern as words: "(?i)sun|line" reads as “sun, line”; a pattern of punctuation reads as nothing in particular. */
export const searchLabel = (raw: string) => { const q = raw.replace(/^\(\?[a-z]+\)/, "").replace(/\\[bswdB]/g, "").replace(/^["'\\]+|["'\\]+$/g, "").replace(/\\?\|/g, ", ").trim(); return /[\p{L}\p{N}]{2}/u.test(q) ? `Searching your files for “${q.slice(0, 60)}”` : "Searching your files"; };
/** What a shell command the agent ran was for, in plain words, when that is clear; otherwise the command itself. */
export function commandLabel(cmd: string): string {
  const c = cmd.replace(/^\S*sh -lc\s+/, "").trim().replace(/^(['"])([\s\S]*)\1$/, "$2").trim();
  const expand = (t: string) => { const m = /^(.*)\{([^{}]+)\}(.*)$/.exec(t); return m ? m[2].split(",").map(x => m[1] + x + m[3]) : [t]; };
  const one = (part: string): string | null => {
    const paths = [...new Set((part.match(/(?:\.\/)?(?:context|inbox)\/[^\s'";|&><)]+/g) ?? []).flatMap(expand).map(pathLabel).filter(x => x && !/[*?]/.test(x)))];
    const search = /^(rg|grep)\b/.test(part) && !/--files\b/.test(part) && /(?:rg|grep)\s+(?:-[\w-]+(?:\s+\d+)?\s+)*(?:"([^"]+)"|'([^']+)'|(\S+))/.exec(part);
    if (search) return searchLabel(search[1] ?? search[2] ?? search[3]);
    if (/^(cat|sed|head|tail|nl|less|wc|pdftotext|awk)\b/.test(part) && paths.length) return `Reading ${paths.slice(0, 4).join(", ")}${paths.length > 4 ? ` and ${paths.length - 4} more` : ""}`;
    if (/^(ls|rg --files|find|tree)\b/.test(part)) return "Looking through your files";
    return null;
  };
  const labels = [...new Set(c.split(/\n|&&|\|\||;/).map(x => x.trim()).filter(Boolean).map(one).filter((x): x is string => !!x))];
  return labels.length ? labels.slice(0, 2).join(" · ") : `Running: ${c.replace(/\s+/g, " ").slice(0, 110)}`;
}
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u.slice(0, 60); } };

/** Turns one Codex JSONL event into human steps. */
export function codexSteps(e: any): Step[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const at = now(), it = e?.item;
  if (e?.type === "error" && e.message) return [{at, kind: "error", text: String(e.message).slice(0, 200)}];
  if (e?.type === "item.started" && it?.type === "web_search") return it.query ? [{at, kind: "search", text: `Searching the web: ${String(it.query).slice(0, 120)}`}] : [];
  if (e?.type !== "item.completed" || !it) return [];
  if (it.type === "web_search") return !it.query && it.results?.[0]?.domain ? [{at, kind: "open", text: `Reading ${it.results[0].domain}`}] : [];
  if (it.type === "mcp_tool_call") { const a = it.arguments ?? {}; if (it.tool === "read_page" && a.url) return [{at, kind: "open", text: `Reading ${host(String(a.url))}`}]; return []; }
  if (it.type === "command_execution") { const t = commandLabel(String(it.command ?? "")); return [{at, kind: t.startsWith("Running") ? "run" : t.startsWith("Reading") ? "open" : "search", text: t}]; }
  if (it.type === "file_change") return [{at, kind: "write", text: `Writing ${(it.changes ?? []).map((c: {path?: string}) => String(c.path ?? "").split("/").pop()).filter(Boolean).slice(0, 3).join(", ") || "a file"}`}];
  if (it.type === "agent_message" && it.text && !String(it.text).trim().startsWith("{")) return [{at, kind: "say", text: String(it.text).slice(0, 160)}];
  return [];
}

/** Turns one Claude Code stream-json event into human steps. */
export function claudeSteps(e: any, root: string): Step[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (e?.type !== "assistant" || !Array.isArray(e.message?.content)) return [];
  const at = now(), rel = (p: unknown) => {
    const f = String(p ?? ""), r = relative(root, f); if (r && !r.startsWith("..")) return r;
    const mark = "/" + basename(root) + "/", i = f.lastIndexOf(mark); return i >= 0 ? f.slice(i + mark.length) : basename(f); // e.g. /private/var vs /var
  };
  const label = (p: unknown) => pathLabel(rel(p));
  const out: Step[] = [];
  for (const b of e.message.content) {
    const i = b?.input ?? {};
    if (b?.type === "text" && b.text && !String(b.text).trim().startsWith("{")) out.push({at, kind: "say", text: String(b.text).slice(0, 160)});
    if (b?.type !== "tool_use") continue;
    if (/^mcp__.+__read_page$/.test(b.name) && i.url) out.push({at, kind: "open", text: `Reading ${host(String(i.url))}`});
    else if (b.name === "WebSearch" && i.query) out.push({at, kind: "search", text: `Searching the web: ${String(i.query).slice(0, 120)}`});
    else if (b.name === "WebFetch" && i.url) out.push({at, kind: "open", text: `Reading ${host(String(i.url))}`});
    else if (b.name === "Read" && i.file_path) out.push({at, kind: "open", text: `Reading ${label(i.file_path)}`});
    else if (b.name === "Grep" && i.pattern) out.push({at, kind: "search", text: searchLabel(String(i.pattern))});
    else if ((b.name === "Write" || b.name === "Edit") && i.file_path) out.push({at, kind: "write", text: `Writing ${String(i.file_path).split("/").pop()}`});
  }
  return out;
}

/** The text of one string field in JSON that is still being written, decoded as far as it goes (null until the field starts). */
export function partialString(json: string, field: string): string | null {
  const m = new RegExp(`"${field}"\\s*:\\s*"`).exec(json); if (!m) return null;
  let out = "", i = m.index + m[0].length;
  const esc: Record<string, string> = {n: "\n", t: "\t", r: "", b: "", f: "", '"': '"', "\\": "\\", "/": "/"};
  while (i < json.length) {
    const ch = json[i];
    if (ch === '"') break;
    if (ch !== "\\") { out += ch; i++; continue; }
    const nx = json[i + 1]; if (nx === undefined) break;
    if (nx === "u") { const hex = json.slice(i + 2, i + 6); if (hex.length < 4) break; out += String.fromCharCode(parseInt(hex, 16)); i += 6; continue; }
    out += esc[nx] ?? nx; i += 2;
  }
  return out;
}
/** Follows Claude Code's partial messages and returns the answer written so far each time it grows (Claude only: Codex reports whole items). */
export function draftReader(field: string) {
  let idx = -1, json = "";
  return (e: any): string | null => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (e?.type !== "stream_event") return null;
    const ev = e.event;
    if (ev?.type === "content_block_start" && ev.content_block?.type === "tool_use" && ev.content_block.name === "StructuredOutput") { idx = ev.index; json = ""; return null; }
    if (ev?.type === "content_block_delta" && ev.index === idx && ev.delta?.type === "input_json_delta") { json += ev.delta.partial_json ?? ""; return partialString(json, field); }
    return null;
  };
}
