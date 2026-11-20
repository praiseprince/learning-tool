import {refuseUnlessSignedIn} from "@/lib/signed-in";
import {tunnelState} from "@/lib/tunnel";
import {qrSvg} from "@/lib/qr";
export const dynamic = "force-dynamic";
/** The tunnel's state for the Settings page while it starts (and its QR code once it has an address). */
export async function GET() { const no = await refuseUnlessSignedIn(); if (no) return no;
  const s = tunnelState(); return Response.json({...s, qr: s.url ? qrSvg(s.url, "QR code for the tunnel address") : undefined});
}
