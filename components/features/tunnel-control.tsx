"use client";
// The Tunnel switch. While it starts, it asks the server every second for the address.
import {useEffect, useState, useTransition} from "react";
import {setTunnel} from "@/app/you/actions";

type State = {status: "off" | "starting" | "on" | "failed"; url?: string; error?: string; qr?: string};

export function TunnelControl({initial, installed}: {initial: State; installed: boolean}) {
  const [s, setS] = useState<State>(initial), [busy, start] = useTransition(), [copied, setCopied] = useState(false);
  useEffect(() => {
    if (s.status !== "starting") return;
    const t = setInterval(async () => { try { const r = await fetch("/api/tunnel", {cache: "no-store"}); if (r.ok) { const n = await r.json() as State; if (n.status !== "starting") setS(n); } } catch { /* try again */ } }, 1000);
    return () => clearInterval(t);
  }, [s.status]);
  const flip = (on: boolean) => start(async () => { setCopied(false); const r = await setTunnel(on).catch(() => ({status: "failed" as const, error: "That didn't go through. Try again."})); setS(r); });
  const copy = async () => { try { await navigator.clipboard.writeText(s.url!); setCopied(true); } catch { /* not allowed here */ } };
  const on = s.status === "on" || s.status === "starting";
  return <div className="srow access tunnel"><div>
      <b>Tunnel {s.status === "on" ? <span className="status on">On</span> : s.status === "starting" ? <span className="status">Starting…</span> : null}</b>
      <p>A temporary HTTPS address that works from anywhere, until you turn it off or quit Marginalia. Each time it gets a new address, which can take a minute to start working. Devices still need the PIN.</p>
      {s.status === "on" && s.url && <p className="tunnel-url"><code className="addr">{s.url}</code> <button type="button" className="link-btn" onClick={copy}>{copied ? "Copied" : "Copy"}</button></p>}
      {s.status === "failed" && s.error && <p className="login-err" role="alert">{s.error}</p>}
      {!installed && <p className="muted">Needs cloudflared: <code>brew install cloudflared</code></p>}
      <div className="actions"><button type="button" className={on ? "btn btn--quiet btn--sm" : "btn btn--sm"} disabled={busy || !installed} onClick={() => flip(!on)}>{on ? "Turn off" : s.status === "failed" ? "Try again" : "Turn on"}</button></div>
    </div>
    {s.status === "on" && s.qr && <figure className="qr" dangerouslySetInnerHTML={{__html: s.qr}} />}
  </div>;
}
