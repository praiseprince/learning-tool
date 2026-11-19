import {state} from "@/lib/chat/events";
export const dynamic = "force-dynamic";
export async function GET(_: Request, ctx: RouteContext<"/api/chat/[goal]">) {
  const {goal} = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(goal)) return new Response(null, {status: 400});
  return Response.json(state(goal));
}
