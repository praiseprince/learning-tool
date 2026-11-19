"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireV2} from "@/lib/v2/access";
import {addMaterial, detachMaterial, updateMaterial} from "@/lib/v2/materials";

const f = (d: FormData, k: string, n = 400) => String(d.get(k) ?? "").trim().slice(0, n);
const back = (goal: string) => `/goals/${goal}?tab=materials`;

export async function addMaterialAction(goal: string, data: FormData) {
  requireV2();
  try { addMaterial(goal, {title: f(data, "title", 200), kind: f(data, "kind", 20), creator: f(data, "creator", 160), url: f(data, "url", 600), notes: f(data, "notes", 1000), status: f(data, "status", 10) || "using", pointer: f(data, "pointer", 140)}); }
  catch { redirect(back(goal) + "&bad=1"); }
  revalidatePath(back(goal)); redirect(back(goal) + "&added=1");
}
export async function updateMaterialAction(goal: string, id: string, data: FormData) {
  requireV2();
  try { updateMaterial(goal, id, {status: f(data, "status", 10), pointer: f(data, "pointer", 140)}); } catch { redirect(back(goal) + "&bad=1"); }
  revalidatePath(back(goal)); redirect(back(goal));
}
export async function detachMaterialAction(goal: string, id: string) {
  requireV2(); detachMaterial(goal, id); revalidatePath(back(goal)); redirect(back(goal));
}

