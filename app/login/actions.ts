"use server";
import {cookies, headers} from "next/headers";
import {redirect} from "next/navigation";
import {COOKIE, SESSION_DAYS, deviceName, safeNext, signIn, signOut} from "@/lib/auth";

export async function enter(_: {error?: string} | undefined, data: FormData): Promise<{error?: string}> {
  const h = await headers(), pin = String(data.get("pin") ?? "").replace(/\s/g, "");
  const source = h.get("cf-connecting-ip") ? `tunnel ${h.get("cf-connecting-ip")}` : h.get("x-forwarded-for") ?? "local";
  const r = signIn(pin, deviceName(h.get("user-agent") ?? ""), source);
  if ("error" in r) return {error: r.error};
  const secure = h.get("x-forwarded-proto") === "https";
  (await cookies()).set(COOKIE, r.token, {httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_DAYS * 86400});
  redirect(safeNext(data.get("next")));
}
export async function leave() {
  const c = await cookies(); signOut(c.get(COOKIE)?.value); c.delete(COOKIE); redirect("/login");
}
