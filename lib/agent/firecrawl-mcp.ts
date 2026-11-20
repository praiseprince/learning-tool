// A minimal MCP server (stdio, newline-delimited JSON-RPC) that gives Codex and Claude Code one tool backed by Firecrawl Local:
// read_page. Every page read is appended to MARGINALIA_READ_LOG so the app can verify what the agent really opened.
// Run with plain node (type stripping): node lib/agent/firecrawl-mcp.ts
import {appendFileSync} from "node:fs";
import {createInterface} from "node:readline";
import {scrape} from "./firecrawl.ts";

const PAGE = 30_000;
const log = process.env.MARGINALIA_READ_LOG;
const tools = [
  {name: "read_page", description: "Read a web page in full as clean Markdown (local Firecrawl renders JavaScript). Long pages come in parts: pass start to continue.",
    inputSchema: {type: "object", properties: {url: {type: "string"}, start: {type: "integer", minimum: 0}}, required: ["url"]},
    annotations: {title: "Read web page", readOnlyHint: true, destructiveHint: false, openWorldHint: true}},
];

type Msg = {id?: number | string; method?: string; params?: {name?: string; arguments?: Record<string, unknown>; protocolVersion?: string}};
const send = (m: unknown) => process.stdout.write(JSON.stringify(m) + "\n");
const text = (t: string, isError = false) => ({content: [{type: "text", text: t}], ...(isError ? {isError} : {})});

async function call(name: string, a: Record<string, unknown>) {
  if (name === "read_page") {
    const url = String(a.url ?? ""), start = Math.max(0, Number(a.start) || 0);
    if (!/^https?:\/\//i.test(url)) return text("Give a full http(s) URL.", true);
    const p = await scrape(url);
    if (log) try { appendFileSync(log, JSON.stringify({url, final: p.url, ok: p.ok, status: p.status, title: p.title, at: new Date().toISOString()}) + "\n"); } catch { /* logging is best effort */ }
    if (!p.ok) return text(`Could not read ${url}: ${p.error ?? `status ${p.status}`}.`, true);
    const part = p.markdown.slice(start, start + PAGE), rest = p.markdown.length - start - part.length;
    return text(`# ${p.title || url}\nURL: ${p.url} (status ${p.status})\n\n${part}${rest > 0 ? `\n\n[${rest} more characters: call read_page with start=${start + part.length}]` : ""}`);
  }
  return text(`Unknown tool ${name}.`, true);
}

createInterface({input: process.stdin}).on("line", async line => {
  let m: Msg; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return; // notifications
  try {
    if (m.method === "initialize") send({jsonrpc: "2.0", id: m.id, result: {protocolVersion: m.params?.protocolVersion ?? "2025-06-18", capabilities: {tools: {}}, serverInfo: {name: "firecrawl-local", version: "1.0.0"}}});
    else if (m.method === "tools/list") send({jsonrpc: "2.0", id: m.id, result: {tools}});
    else if (m.method === "tools/call") send({jsonrpc: "2.0", id: m.id, result: await call(String(m.params?.name), m.params?.arguments ?? {})});
    else if (m.method === "ping") send({jsonrpc: "2.0", id: m.id, result: {}});
    else send({jsonrpc: "2.0", id: m.id, error: {code: -32601, message: "Method not found"}});
  } catch (e) { send({jsonrpc: "2.0", id: m.id, result: text(String((e as Error).message).slice(0, 300), true)}); }
});
