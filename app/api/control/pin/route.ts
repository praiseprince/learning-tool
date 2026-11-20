// For the Mac app's menu bar only (launch token): whether a PIN is set, and setting it.
import {headers} from "next/headers";
import {CONTROL_HEADER, controlAllowed} from "@/lib/control";
import {hasPin, setPin} from "@/lib/auth";
export const dynamic = "force-dynamic";
const deny = () => Response.json({error: "Not allowed."}, {status: 403});
export async function GET() { if (!controlAllowed((await headers()).get(CONTROL_HEADER))) return deny(); return Response.json({hasPin: hasPin()}); }
export async function POST(req: Request) {
  if (!controlAllowed((await headers()).get(CONTROL_HEADER))) return deny();
  const pin = String(((await req.json().catch(() => ({}))) as {pin?: unknown}).pin ?? "");
  try { setPin(pin); return Response.json({ok: true}); } catch (e) { return Response.json({error: (e as Error).message}, {status: 400}); }
}
