import {refuseUnlessSignedIn} from "@/lib/signed-in";
import {readFileSync, statSync} from "node:fs";
import {basename, extname} from "node:path";
import {inside} from "@/lib/agent/workspace";
export const dynamic = "force-dynamic";
const TYPES: Record<string, string> = {".md": "text/markdown", ".txt": "text/plain", ".csv": "text/csv", ".json": "application/json", ".svg": "text/plain", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".pdf": "application/pdf", ".py": "text/plain", ".html": "text/plain"};
/** Serves files the agent made, always as downloads and never as pages, so nothing it writes can run in your browser. */
export async function GET(_: Request, ctx: RouteContext<"/api/workspace/[goal]/[job]/[...path]">) { const no = await refuseUnlessSignedIn(); if (no) return no;
  const {goal, job, path} = await ctx.params;
  try {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(job)) return new Response(null, {status: 400});
    const file = inside(goal, "out", job, ...path.map(decodeURIComponent)), ext = extname(file).toLowerCase();
    if (!TYPES[ext]) return new Response("Unsupported file type.", {status: 415});
    const st = statSync(file); if (!st.isFile() || st.size > 10 * 1024 * 1024) return new Response(null, {status: 404});
    return new Response(readFileSync(file), {headers: {"content-type": TYPES[ext], "content-disposition": `attachment; filename="${basename(file).replace(/"/g, "")}"`, "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox"}});
  } catch { return new Response(null, {status: 404}); }
}
