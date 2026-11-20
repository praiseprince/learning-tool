import {redirect} from "next/navigation";
import {cookies} from "next/headers";
import {authOn, COOKIE, hasPin, safeNext, session} from "@/lib/auth";
import {PinForm} from "./pin-form";

export const metadata = {title: "Sign in · Marginalia"};

export default async function Login({searchParams}: {searchParams: Promise<{next?: string | string[]}>}) {
  const next = safeNext((await searchParams).next);
  if (!authOn() || session((await cookies()).get(COOKIE)?.value)) redirect(next);
  return <main className="login">
    <div className="login-card">
      <p className="login-mark">Marginalia</p>
      <h1>Enter your PIN</h1>
      {hasPin() ? <PinForm next={next} /> : <p className="prose">No PIN is set yet. On the Mac running Marginalia, run <code>node scripts/pin.mjs</code> in the project folder.</p>}
      <p className="hint">This device stays signed in for 30 days.</p>
    </div>
  </main>;
}
