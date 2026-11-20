// The second check behind proxy.ts: every server action confirms the device is signed in before doing anything.
import {cookies} from "next/headers";
import {authOn, COOKIE, session} from "./auth";
export async function requireSignedIn() {
  if (!authOn()) return;
  if (!session((await cookies()).get(COOKIE)?.value)) throw Error("Sign in first.");
}
/** For route handlers: a 401 response when the device is not signed in, otherwise null. */
export async function refuseUnlessSignedIn() {
  if (!authOn() || session((await cookies()).get(COOKIE)?.value)) return null;
  return Response.json({error: "Sign in first."}, {status: 401});
}
