// The Tunnel: a Cloudflare quick tunnel (no account) that gives this server a temporary HTTPS address reachable from
// anywhere. Sign-in still applies. It stops when it is turned off, when the server stops, and (through scripts/guard.mjs)
// even when the server is killed. Each start gets a new random address.
import {spawn, type ChildProcess} from "node:child_process";
import {existsSync} from "node:fs";
import {networkInterfaces} from "node:os";
import {join} from "node:path";

export type TunnelState = {status: "off" | "starting" | "on" | "failed"; url?: string; error?: string; since?: string};
type Holder = {child: ChildProcess | null; state: TunnelState; hooked: boolean};
const g = globalThis as unknown as {__mgTunnel?: Holder};
const h: Holder = g.__mgTunnel ??= {child: null, state: {status: "off"}, hooked: false};

export function cloudflaredPath() {
  for (const d of [...(process.env.PATH ?? "").split(":"), "/opt/homebrew/bin", "/usr/local/bin"]) if (d && existsSync(join(d, "cloudflared"))) return join(d, "cloudflared");
  return null;
}
export const tunnelState = (): TunnelState => ({...h.state});
export const port = () => Number(process.env.PORT) || 3000;

export function startTunnel(): TunnelState {
  if (h.child && (h.state.status === "on" || h.state.status === "starting")) return tunnelState();
  const bin = cloudflaredPath();
  if (!bin) { h.state = {status: "failed", error: "cloudflared is not installed. Install it with: brew install cloudflared"}; return tunnelState(); }
  if (!h.hooked) { h.hooked = true; process.once("exit", () => stopTunnel()); } // and the guard stops it if the server is killed
  const guard = join(process.cwd(), "scripts", "guard.mjs");
  const child = spawn(process.execPath, [guard, String(process.pid), bin, "tunnel", "--no-autoupdate", "--url", `http://localhost:${port()}`], {stdio: ["ignore", "pipe", "pipe"]});
  h.child = child; h.state = {status: "starting", since: new Date().toISOString()};
  let log = "";
  const read = (b: Buffer) => {
    log = (log + b.toString()).slice(-4000);
    const m = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && h.child === child && h.state.status === "starting") h.state = {status: "on", url: m[0], since: new Date().toISOString()};
  };
  child.stdout?.on("data", read); child.stderr?.on("data", read);
  child.on("exit", () => {
    if (h.child !== child) return;
    h.child = null;
    if (h.state.status !== "off") h.state = {status: "failed", error: lastError(log) || "The tunnel stopped. Try again."};
  });
  setTimeout(() => { if (h.child === child && h.state.status === "starting") { stopTunnel(); h.state = {status: "failed", error: "Cloudflare did not answer in time. Check the internet connection and try again."}; } }, 45_000).unref();
  return tunnelState();
}
const lastError = (log: string) => log.split("\n").reverse().find(l => /\bERR\b|error|failed/i.test(l))?.replace(/^\S+\s+(ERR|INF|WRN)\s+/, "").slice(0, 200) ?? "";

export function stopTunnel(): TunnelState {
  const c = h.child; h.child = null; h.state = {status: "off"};
  if (c && c.exitCode === null) { try { c.kill("SIGTERM"); } catch { /* gone */ } }
  return tunnelState();
}

/** Addresses on the local network (Wi-Fi or Ethernet), for phones and iPads in the same place. */
export function lanUrls() {
  return Object.values(networkInterfaces()).flat().filter(a => a && a.family === "IPv4" && !a.internal).map(a => `http://${a!.address}:${port()}`);
}
