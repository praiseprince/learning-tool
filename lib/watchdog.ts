// Started by the Mac app (MARGINALIA_PARENT_PID), the server stops itself and everything it started (tunnel, Firecrawl)
// as soon as the app is gone, even after a force quit.
export function watchParent() {
  const parent = Number(process.env.MARGINALIA_PARENT_PID);
  if (!(parent > 1)) return;
  const alive = () => { try { process.kill(parent, 0); return true; } catch { return false; } };
  setInterval(() => {
    if (alive()) return;
    try { process.kill(-process.pid, "SIGTERM"); } catch { /* not a group leader */ }
    setTimeout(() => process.exit(0), 2000).unref();
  }, 1000).unref();
}
