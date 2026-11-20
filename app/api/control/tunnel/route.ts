// For the Mac app's menu bar only: read or switch the Tunnel. Needs the launch token, not a sign-in.
import {headers} from "next/headers";
import {CONTROL_HEADER, controlAllowed} from "@/lib/control";
import {hasPin} from "@/lib/auth";
import {startTunnel, stopTunnel, tunnelState} from "@/lib/tunnel";
export const dynamic = "force-dynamic";
const deny = () => Response.json({error: "Not allowed."}, {status: 403});
export async function GET() { if (!controlAllowed((await headers()).get(CONTROL_HEADER))) return deny(); return Response.json(tunnelState()); }
export async function POST(req: Request) {
  if (!controlAllowed((await headers()).get(CONTROL_HEADER))) return deny();
  const on = new URL(req.url).searchParams.get("on") === "1";
  if (on && !hasPin()) return Response.json({status: "failed", error: "Set a PIN first."});
  return Response.json(on ? startTunnel() : stopTunnel());
}
