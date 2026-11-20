import {searchMessages} from "@/lib/chat/events";
import {v2Enabled} from "@/lib/v2/flag";
export const dynamic = "force-dynamic";
/** Messages for the ⌘K palette. Goals, notes and skills are already in the page; the conversation is searched here. */
export async function GET(req: Request) {
  if (!v2Enabled()) return new Response(null, {status: 404});
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 120);
  return Response.json(q.trim().length < 2 ? [] : searchMessages(q, 8));
}
