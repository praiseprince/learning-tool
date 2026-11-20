import {refuseUnlessSignedIn} from "@/lib/signed-in";
import {getJob} from "@/lib/agent/jobs";
export const dynamic = "force-dynamic";
export async function GET(_: Request, ctx: RouteContext<"/api/agent/[job]">) { const no = await refuseUnlessSignedIn(); if (no) return no;
  const {job} = await ctx.params, j = getJob(job);
  if (!j) return new Response(null, {status: 404});
  return Response.json({id: j.id, kind: j.kind, status: j.status, steps: j.steps.slice(-14), error: j.error, finished_at: j.finished_at, draft: j.status === "running" ? j.draft : null});
}
