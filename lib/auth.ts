// Sign-in with a PIN. Every device signs in once and stays signed in until the sign-in expires (30 days).
// The PIN is stored only as a scrypt hash; sessions only as a SHA-256 of their token. Wrong PINs lock sign-in for a while,
// for everyone (an address can be faked on the Wi-Fi), doubling each time, so guessing a 4-digit PIN would take years.
// `node scripts/pin.mjs` (on the Mac) sets the PIN and clears a lockout.
import {createHash, randomBytes, scryptSync, timingSafeEqual} from "node:crypto";
import {sqlite} from "./db/client.ts";

export const COOKIE = "mg_session";
export const SESSION_DAYS = 30;
const FREE_TRIES = 5, MAX_LOCK_MIN = 24 * 60;

let ready = false;
function ensure() {
  if (ready) return;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS app_setting(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS auth_session(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,last_seen TEXT NOT NULL,device TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS auth_attempt(at TEXT NOT NULL,ok INTEGER NOT NULL,source TEXT NOT NULL DEFAULT '');`);
  ready = true;
}
const setting = (k: string) => (sqlite.prepare("SELECT value FROM app_setting WHERE key=?").get(k) as {value: string} | undefined)?.value;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** Whether sign-in is required at all. Only tests and screenshots turn it off. */
export const authOn = () => process.env.MARGINALIA_AUTH !== "off";
export function hasPin() { ensure(); return !!setting("pin_hash"); }

export function setPin(pin: string) {
  if (!/^\d{4,12}$/.test(pin)) throw Error("Use 4 to 12 digits.");
  ensure(); const salt = randomBytes(16).toString("hex"), hash = scryptSync(pin, salt, 32).toString("hex");
  sqlite.prepare("INSERT OR REPLACE INTO app_setting(key,value) VALUES ('pin_hash',?)").run(`${salt}:${hash}`);
  clearLock();
}
export function clearLock() { ensure(); sqlite.prepare("INSERT INTO auth_attempt(at,ok,source) VALUES (?,1,'reset')").run(new Date().toISOString()); }

function pinMatches(pin: string) {
  const v = setting("pin_hash"); if (!v) return false;
  const [salt, hash] = v.split(":"), got = scryptSync(pin, salt, 32), want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Failures since the last success (or reset) in the past day, and when sign-in opens again. */
export function lockState(now = Date.now()) {
  ensure();
  const since = new Date(now - 24 * 3600_000).toISOString();
  const lastOk = (sqlite.prepare("SELECT MAX(at) AS at FROM auth_attempt WHERE ok=1").get() as {at: string | null}).at ?? "";
  const fails = sqlite.prepare("SELECT at FROM auth_attempt WHERE ok=0 AND at>? AND at>? ORDER BY at").all(since, lastOk) as {at: string}[];
  if (fails.length < FREE_TRIES) return {fails: fails.length, until: 0};
  const minutes = Math.min(MAX_LOCK_MIN, 2 ** (fails.length - FREE_TRIES)), until = Date.parse(fails[fails.length - 1].at) + minutes * 60_000;
  return {fails: fails.length, until: until > now ? until : 0};
}

/** Checks a PIN against the lockout, and records the attempt. */
export function checkPin(pin: string, source: string): {ok: true} | {error: string} {
  ensure();
  if (!hasPin()) return {error: "No PIN is set yet. On the Mac, run: node scripts/pin.mjs"};
  const lock = lockState();
  if (lock.until) return {error: `Too many wrong PINs. Try again ${waitText(lock.until - Date.now())}.`};
  const ok = /^\d{4,12}$/.test(pin) && pinMatches(pin), now = new Date();
  sqlite.prepare("INSERT INTO auth_attempt(at,ok,source) VALUES (?,?,?)").run(now.toISOString(), ok ? 1 : 0, source.slice(0, 80));
  sqlite.prepare("DELETE FROM auth_attempt WHERE at<?").run(new Date(now.getTime() - 30 * 86400_000).toISOString());
  if (!ok) { const next = lockState(); return {error: next.until ? `Wrong PIN. Sign-in is locked ${waitText(next.until - Date.now())}.` : "Wrong PIN."}; }
  return {ok: true};
}

/** Checks a PIN. On success returns a new session token for the cookie. */
export function signIn(pin: string, device: string, source: string): {token: string} | {error: string} {
  const c = checkPin(pin, source); if ("error" in c) return c;
  const now = new Date();
  const token = randomBytes(32).toString("base64url"), expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  sqlite.prepare("INSERT INTO auth_session VALUES (?,?,?,?,?)").run(sha(token), now.toISOString(), expires.toISOString(), now.toISOString(), device.slice(0, 80));
  return {token};
}
const waitText = (ms: number) => { const m = Math.ceil(ms / 60_000); return m >= 120 ? `in about ${Math.round(m / 60)} hours` : `in ${m} minute${m === 1 ? "" : "s"}`; };

/** The session for a cookie value, if it is valid. Notes when it was last used. */
export function session(token: string | undefined) {
  if (!token || token.length > 100) return null;
  ensure();
  const id = sha(token), now = new Date();
  const s = sqlite.prepare("SELECT id,created_at,expires_at,last_seen,device FROM auth_session WHERE id=?").get(id) as {id: string; created_at: string; expires_at: string; last_seen: string; device: string} | undefined;
  if (!s) return null;
  if (s.expires_at <= now.toISOString()) { sqlite.prepare("DELETE FROM auth_session WHERE id=?").run(id); return null; }
  if (now.getTime() - Date.parse(s.last_seen) > 5 * 60_000) sqlite.prepare("UPDATE auth_session SET last_seen=? WHERE id=?").run(now.toISOString(), id);
  return s;
}
export function sessions() { ensure(); return sqlite.prepare("SELECT id,created_at,expires_at,last_seen,device FROM auth_session WHERE expires_at>? ORDER BY last_seen DESC").all(new Date().toISOString()) as {id: string; created_at: string; expires_at: string; last_seen: string; device: string}[]; }
export function signOut(token: string | undefined) { if (token) { ensure(); sqlite.prepare("DELETE FROM auth_session WHERE id=?").run(sha(token)); } }
export function signOutSession(id: string) { ensure(); sqlite.prepare("DELETE FROM auth_session WHERE id=?").run(id); }
export function signOutEverywhere() { ensure(); sqlite.prepare("DELETE FROM auth_session").run(); }
export const sessionId = (token: string | undefined) => token ? sha(token) : "";

/** A short, readable name for the device, from its user agent. */
export function deviceName(ua: string) {
  const os = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const app = /Marginalia/.test(ua) ? "Marginalia app" : /Edg\//.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "browser";
  return `${app} on ${os}`;
}
/** A safe place to go after signing in: only a path on this site. */
export const safeNext = (n: unknown) => typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") && !n.startsWith("/login") ? n.slice(0, 500) : "/";
