// Settings → Devices: who is signed in, signing out, and the PIN.
import {cookies} from "next/headers";
import {authOn, COOKIE, sessionId, sessions} from "@/lib/auth";
import {ago} from "@/lib/v2/when";
import {leave} from "@/app/login/actions";
import {signOutAll, signOutDevice} from "@/app/you/actions";
import {ChangePin} from "./change-pin";

export async function Devices() {
  if (!authOn()) return <p className="muted">Sign-in is turned off (MARGINALIA_AUTH=off).</p>;
  const me = sessionId((await cookies()).get(COOKIE)?.value), list = sessions();
  const until = (iso: string) => new Date(iso).toLocaleDateString(undefined, {day: "numeric", month: "short"});
  return <div className="rows-s">
    {list.map(s => <div key={s.id} className="srow"><div><b>{s.device || "A device"}{s.id === me ? " · this one" : ""}</b><p>Last used {ago(s.last_seen)} · signed in until {until(s.expires_at)}</p></div>
      {s.id === me ? <form action={leave}><button className="btn btn--quiet btn--sm">Sign out</button></form>
        : <form action={signOutDevice.bind(null, s.id)}><button className="btn btn--quiet btn--sm">Sign out</button></form>}</div>)}
    <div className="srow"><div><b>PIN</b><p>Every device needs it once, then stays signed in for 30 days. After five wrong tries, sign-in locks for a while, longer each time.</p></div><ChangePin /></div>
    {list.length > 1 && <div className="srow"><div><b>Sign out everywhere</b><p>Every device, this one included, needs the PIN again.</p></div><form action={signOutAll}><button className="btn btn--quiet btn--sm">Sign out all</button></form></div>}
  </div>;
}
