import { notFound } from "next/navigation";
import { v2Enabled } from "./flag";
import { ensureAtlas } from "./atlas";
export function requireV2() {
  if(!v2Enabled())notFound();
  ensureAtlas();
}
