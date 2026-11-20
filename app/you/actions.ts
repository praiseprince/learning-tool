"use server";
import {requireSignedIn} from "@/lib/signed-in";
import {revalidatePath} from "next/cache";
import {sqlite} from "@/lib/db/client";
import {backupBeforeReset,clearPersonalData,clearWorkspaces} from "@/lib/db/personal";
import {setAiProvider,type Provider} from "@/lib/ai/provider";
export async function savePreferences(data:FormData) { await requireSignedIn();
 const minutes=Number(data.get("minutes")),week=Number(data.get("week")),time=String(data.get("time")),theme=String(data.get("theme"));
 if(!Number.isInteger(minutes)||minutes<5||minutes>600||![0,1].includes(week)||!["Any time","Morning","Afternoon","Evening"].includes(time)||!["system","light","dark"].includes(theme))throw Error("Check your preferences.");
 sqlite.prepare("INSERT OR REPLACE INTO preference VALUES (1,?,?,?,?)").run(minutes,time,week,theme);
 revalidatePath("/","layout");
}
export async function editFact(id:string,data:FormData) { await requireSignedIn();
 if(data.get("intent")==="delete") sqlite.prepare("UPDATE profile_fact SET status='deleted',edited_at=? WHERE id=?").run(new Date().toISOString(),id);
 else {const text=String(data.get("text")||"").trim();if(!text||text.length>500)throw Error("Check the fact text.");sqlite.prepare("UPDATE profile_fact SET text=?,edited_at=? WHERE id=?").run(text,new Date().toISOString(),id);}
 revalidatePath("/you");
}
export async function deleteData(data:FormData) { await requireSignedIn();
 if(data.get("confirmation")!=="DELETE")throw Error("Type DELETE to confirm.");
 const backup=backupBeforeReset();
 clearPersonalData();
 clearWorkspaces(backup.replace(/\.db$/,"-files"));
 revalidatePath("/","layout");
}
export async function chooseAi(data:FormData) { await requireSignedIn();
 setAiProvider(String(data.get("ai")) as Provider);
 revalidatePath("/you");
}

/** Changes the PIN after checking the current one. Devices already signed in stay signed in. */
export async function changePin(_: {error?: string; done?: boolean} | undefined, data: FormData): Promise<{error?: string; done?: boolean}> {
  await requireSignedIn();
  const {checkPin, setPin} = await import("@/lib/auth");
  const cur = String(data.get("current") ?? "").trim(), next = String(data.get("pin") ?? "").trim(), again = String(data.get("again") ?? "").trim();
  if (next !== again) return {error: "The new PINs differ."};
  if (!/^\d{4,12}$/.test(next)) return {error: "Use 4 to 12 digits."};
  const c = checkPin(cur, "settings"); if ("error" in c) return {error: c.error === "Wrong PIN." ? "The current PIN is wrong." : c.error};
  setPin(next); return {done: true};
}
export async function signOutDevice(id: string) {
  await requireSignedIn(); const {signOutSession} = await import("@/lib/auth"); signOutSession(id); revalidatePath("/you");
}
export async function signOutAll() {
  await requireSignedIn(); const {signOutEverywhere} = await import("@/lib/auth"); signOutEverywhere();
  const {redirect} = await import("next/navigation"); redirect("/login");
}

/** Turns the Cloudflare quick tunnel on or off. */
export async function setTunnel(on: boolean) {
  await requireSignedIn();
  const {hasPin} = await import("@/lib/auth"), t = await import("@/lib/tunnel");
  if (on && !hasPin()) return {status: "failed" as const, error: "Set a PIN first, from the Marginalia menu-bar icon (Set PIN…)."};
  const s = on ? t.startTunnel() : t.stopTunnel(); revalidatePath("/you"); return s;
}
