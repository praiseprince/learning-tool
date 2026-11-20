// Every page, API route and server action needs a signed-in device (see lib/auth.ts); only the sign-in page and static
// files are open. Server actions check again on their own (requireSignedIn), in case a route ever slips past this.
import {NextResponse, type NextRequest} from "next/server";
import {authOn, COOKIE, session} from "@/lib/auth";
import {CONTROL_HEADER, controlAllowed} from "@/lib/control";

export function proxy(req: NextRequest) {
  if (!authOn()) return NextResponse.next();
  const path = req.nextUrl.pathname;
  if (path === "/login") return NextResponse.next();
  if (path.startsWith("/api/control/")) return controlAllowed(req.headers.get(CONTROL_HEADER)) ? NextResponse.next() : NextResponse.json({error: "Not allowed."}, {status: 403});
  if (session(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  const page = req.method === "GET" && (req.headers.get("sec-fetch-mode") === "navigate" || (req.headers.get("accept") ?? "").includes("text/html"));
  if (page) {
    const to = new URL("/login", req.url); to.search = "";
    if (path !== "/") to.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
  return NextResponse.json({error: "Sign in first."}, {status: 401});
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|marginalia-192.png|marginalia-512.png).*)"],
};
