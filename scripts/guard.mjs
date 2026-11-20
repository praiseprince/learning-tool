// Runs a command and stops it as soon as the process that started us is gone, even if that process was killed outright.
//   node scripts/guard.mjs <parent-pid> <command> [args...]
// Output passes through. Used for the tunnel, so cloudflared never outlives the app.
import {spawn} from "node:child_process";
const [parent, cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, {stdio: "inherit"});
const stop = () => { try { child.kill("SIGTERM"); } catch { /* gone */ } setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* gone */ } process.exit(0); }, 3000).unref(); };
const alive = () => { try { process.kill(Number(parent), 0); return true; } catch { return false; } };
const timer = setInterval(() => { if (!alive()) stop(); }, 1000);
for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(s, stop);
child.on("exit", code => { clearInterval(timer); process.exit(code ?? 0); });
child.on("error", e => { console.error(String(e)); process.exit(127); });
