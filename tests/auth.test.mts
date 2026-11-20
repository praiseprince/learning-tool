// PIN sign-in: hashing, sessions that expire, and a lockout that makes guessing impractical.
import {test, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marginalia-auth-"));
process.env.DATABASE_URL = join(dir, "t.db");
const {sqlite} = await import("../lib/db/client.ts");
const a = await import("../lib/auth.ts");
after(() => { sqlite.close(); rmSync(dir, {recursive: true, force: true}); });

test("no PIN: nobody can sign in", () => {
  assert.equal(a.hasPin(), false);
  assert.match((a.signIn("8076", "x", "t") as {error: string}).error, /No PIN/);
});

test("the PIN is stored only as a hash; a right PIN gives a session, a wrong one does not", () => {
  a.setPin("4321");
  const stored = (sqlite.prepare("SELECT value FROM app_setting WHERE key='pin_hash'").get() as {value: string}).value;
  assert.ok(!stored.includes("4321") && stored.includes(":"));
  assert.deepEqual(a.signIn("1111", "x", "t"), {error: "Wrong PIN."});
  const r = a.signIn("4321", "Safari on iPhone", "t") as {token: string};
  assert.ok(r.token.length > 30);
  assert.equal(a.session(r.token)?.device, "Safari on iPhone");
  assert.equal(a.session(r.token + "x"), null);
  assert.ok(!JSON.stringify(sqlite.prepare("SELECT * FROM auth_session").all()).includes(r.token), "only a hash of the token is stored");
  a.signOut(r.token); assert.equal(a.session(r.token), null);
});

test("a session ends when it expires", () => {
  const r = a.signIn("4321", "x", "t") as {token: string};
  sqlite.prepare("UPDATE auth_session SET expires_at=? WHERE id=?").run(new Date(Date.now() - 1000).toISOString(), a.sessionId(r.token));
  assert.equal(a.session(r.token), null);
});

test("five wrong PINs lock sign-in, even for the right PIN, and the lock grows", () => {
  sqlite.prepare("DELETE FROM auth_attempt").run();
  for (let i = 0; i < 4; i++) assert.deepEqual(a.signIn("0000", "x", "t"), {error: "Wrong PIN."});
  assert.match((a.signIn("0000", "x", "t") as {error: string}).error, /locked in 1 minute/);
  assert.match((a.signIn("4321", "x", "t") as {error: string}).error, /Too many wrong PINs/);
  // pretend the minute passed, then fail again: two minutes
  sqlite.prepare("UPDATE auth_attempt SET at=? WHERE ok=0").run(new Date(Date.now() - 61_000).toISOString());
  assert.match((a.signIn("0000", "x", "t") as {error: string}).error, /locked in 2 minutes/);
  for (let i = 0; i < 20; i++) sqlite.prepare("INSERT INTO auth_attempt VALUES (?,0,'t')").run(new Date().toISOString());
  assert.ok(a.lockState().until - Date.now() <= 24 * 3600_000 + 1000, "never more than a day");
  a.clearLock(); assert.ok("token" in a.signIn("4321", "x", "t"), "the Mac can clear the lock");
});

test("only same-site paths are followed after signing in", () => {
  assert.equal(a.safeNext("/goals?x=1"), "/goals?x=1");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/login", undefined, ["/x"]]) assert.equal(a.safeNext(bad), "/");
  assert.equal(a.deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari/604.1"), "Safari on iPhone");
});
