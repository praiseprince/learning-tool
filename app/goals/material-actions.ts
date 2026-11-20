"use server";
import {requireSignedIn} from "@/lib/signed-in";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireV2} from "@/lib/v2/access";
import {addMaterial, detachMaterial, updateMaterial} from "@/lib/v2/materials";
import {fileHref, sharedFiles} from "@/lib/chat/files";

const f = (d: FormData, k: string, n = 400) => String(d.get(k) ?? "").trim().slice(0, n);
const back = (goal: string) => `/goals/${goal}?tab=materials`;

export async function addMaterialAction(goal: string, data: FormData) {
  await requireSignedIn(); requireV2();
  try { addMaterial(goal, {title: f(data, "title", 200), kind: f(data, "kind", 20), creator: f(data, "creator", 160), url: f(data, "url", 600), notes: f(data, "notes", 1000), status: f(data, "status", 10) || "using", pointer: f(data, "pointer", 140)}); }
  catch { redirect(back(goal) + "&bad=1"); }
  revalidatePath(back(goal)); redirect(back(goal) + "&added=1");
}
export async function updateMaterialAction(goal: string, id: string, data: FormData) {
  await requireSignedIn(); requireV2();
  try { updateMaterial(goal, id, {status: f(data, "status", 10), pointer: f(data, "pointer", 140)}); } catch { redirect(back(goal) + "&bad=1"); }
  revalidatePath(back(goal)); redirect(back(goal));
}
export async function detachMaterialAction(goal: string, id: string) {
  await requireSignedIn(); requireV2(); detachMaterial(goal, id); revalidatePath(back(goal)); redirect(back(goal));
}

/** A file shared in the chat (a book, a worksheet) becomes a material, pointing at the learner's own copy. */
export async function fileToMaterial(goal: string, stored: string) {
  await requireSignedIn(); requireV2();
  const f = sharedFiles(goal).find(x => x.stored === stored); if (!f) redirect(back(goal) + "&bad=1");
  addMaterial(goal, {title: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || f.name, kind: f.type === "doc" ? "book" : "other", url: fileHref(goal, stored),
    notes: `Your copy, shared in the chat on ${f.at.slice(0, 10)}. The Guide can open it at inbox/${stored}${f.text ? ` (text in inbox/${f.text})` : ""}.`, status: "using"});
  revalidatePath(back(goal)); redirect(back(goal) + "&added=1");
}
