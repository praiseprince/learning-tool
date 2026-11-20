// A QR code as an SVG path, drawn in currentColor so the page styles it (always dark on a light square).
import QRCode from "qrcode";
export function qrSvg(text: string, label: string) {
  const q = QRCode.create(text, {errorCorrectionLevel: "M"}), n = q.modules.size, m = 2;
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules.get(y, x)) d += `M${x + m} ${y + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" role="img" aria-label="${label.replace(/[<>"&]/g, "")}" shape-rendering="crispEdges"><path fill="currentColor" d="${d}"/></svg>`;
}
