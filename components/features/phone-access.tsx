// Settings → Phone and iPad: the Wi-Fi address and the Tunnel, each with a QR code to scan.
import {lanUrls, tunnelState, cloudflaredPath} from "@/lib/tunnel";
import {qrSvg} from "@/lib/qr";
import {TunnelControl} from "./tunnel-control";

export function PhoneAccess() {
  const lan = lanUrls()[0], t = tunnelState();
  return <div className="rows-s">
    <div className="srow access"><div><b>On the same Wi-Fi</b><p>{lan ? <>Open <code className="addr">{lan}</code> on the phone or iPad, or scan the code. Use it only on Wi-Fi you trust: this address is not encrypted.</> : "This computer is not on a network right now."}</p></div>
      {lan && <figure className="qr" dangerouslySetInnerHTML={{__html: qrSvg(lan, "QR code for the Wi-Fi address")}} />}</div>
    <TunnelControl initial={{...t, qr: t.url ? qrSvg(t.url, "QR code for the tunnel address") : undefined}} installed={!!cloudflaredPath()} />
  </div>;
}
