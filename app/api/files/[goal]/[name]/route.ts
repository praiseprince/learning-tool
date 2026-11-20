import {refuseUnlessSignedIn} from "@/lib/signed-in";
import {readFileSync, statSync} from "node:fs";
import {inside} from "@/lib/agent/workspace";
import {extname} from "@/lib/chat/ext";
import {kindOf} from "@/lib/chat/file-types";
export const dynamic = "force-dynamic";
const IMAGES: Record<string, string> = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"};
/** Serves a file the learner shared back to them: images inline (for the thread), everything else as a download, never as a page. */
export async function GET(req: Request, ctx: RouteContext<"/api/files/[goal]/[name]">) { const no = await refuseUnlessSignedIn(); if (no) return no;
  const {goal, name} = await ctx.params, file = decodeURIComponent(name);
  try {
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(file) || !kindOf(file.replace(/\.txt$/, "")) && !kindOf(file)) return new Response(null, {status: 400});
    const path = inside(goal, "inbox", file), st = statSync(path); if (!st.isFile()) return new Response(null, {status: 404});
    const type = IMAGES[extname(file)], dl = new URL(req.url).searchParams.has("download") || !type;
    const shown = file.replace(/^[a-f0-9]{8}-/, "").replace(/"/g, "");
    return new Response(readFileSync(path), {headers: {"content-type": type ?? "application/octet-stream", "content-disposition": `${dl ? "attachment" : "inline"}; filename="${shown}"`,
      "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox", "cache-control": "private, max-age=31536000, immutable"}});
  } catch { return new Response(null, {status: 404}); }
}
