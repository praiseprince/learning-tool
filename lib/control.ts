// The Mac app talks to its own server with a random token it creates at launch (MARGINALIA_CONTROL_TOKEN), so its
// menu-bar items work without a browser sign-in. Without that variable there is no control access at all.
import {createHash, timingSafeEqual} from "node:crypto";
export const CONTROL_HEADER = "x-marginalia-control";
export function controlAllowed(given: string | null | undefined) {
  const want = process.env.MARGINALIA_CONTROL_TOKEN;
  if (!want || want.length < 32 || !given) return false;
  const a = createHash("sha256").update(given).digest(), b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}
