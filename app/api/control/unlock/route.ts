// For the Mac app's menu bar only (launch token): clears a sign-in lockout after wrong PINs.
import {headers} from "next/headers";
import {CONTROL_HEADER, controlAllowed} from "@/lib/control";
import {clearLock} from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST() {
  if (!controlAllowed((await headers()).get(CONTROL_HEADER))) return Response.json({error: "Not allowed."}, {status: 403});
  clearLock(); return Response.json({ok: true});
}
