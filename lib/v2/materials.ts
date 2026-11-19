import {randomUUID} from "node:crypto";
import {sqlite} from "../db/client.ts";
import {ensureNotebook} from "./notebook.ts";

export const MATERIAL_KINDS = ["book", "course", "video", "article", "podcast", "exercise", "app", "teacher", "other"] as const;
export const MATERIAL_STATUS = ["using", "queued", "done", "dropped"] as const;
export type MaterialKind = typeof MATERIAL_KINDS[number];
export type MaterialStatus = typeof MATERIAL_STATUS[number];
export type Material = {id: string; kind: string; title: string; creator: string; url: string; notes: string; origin: string; status: MaterialStatus; pointer: string; why: string};

type Anchor = {status?: MaterialStatus; pointer?: string; why?: string};
const parse = (a: string): Anchor => { try { return JSON.parse(a) as Anchor; } catch { return {}; } };

/** Materials attached to a goal, using ones first. Titles and links are only ever what the learner added. */
export function materials(goal: string): Material[] {
  ensureNotebook();
  const rows = sqlite.prepare(`SELECT r.*,l.anchor FROM entity_link l JOIN resource r ON r.id=l.to_id WHERE l.from_kind='goal' AND l.from_id=? AND l.to_kind='resource' AND l.label='material'`).all(goal) as (Omit<Material, "status" | "pointer" | "why"> & {anchor: string})[];
  const order: Record<string, number> = {using: 0, queued: 1, done: 2, dropped: 3};
  return rows.map(({anchor, ...r}) => { const a = parse(anchor); return {...r, status: a.status ?? "queued", pointer: a.pointer ?? "", why: a.why ?? ""}; })
    .sort((a, b) => (order[a.status] - order[b.status]) || a.title.localeCompare(b.title));
}
export function material(goal: string, id: string) { return materials(goal).find(m => m.id === id) ?? null; }

const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
const safeUrl = (u: string) => { if (!u) return ""; try { const x = new URL(/^[a-z]+:/i.test(u) ? u : "https://" + u); return /^https?:$/.test(x.protocol) ? x.toString() : ""; } catch { return ""; } };

export function addMaterial(goal: string, input: {title: string; kind?: string; creator?: string; url?: string; notes?: string; status?: string; pointer?: string; why?: string; origin?: string}) {
  ensureNotebook();
  const title = clip(input.title, 200); if (!title) throw Error("Give the material a title.");
  const kind = (MATERIAL_KINDS as readonly string[]).includes(String(input.kind)) ? String(input.kind) : "other";
  const status = (MATERIAL_STATUS as readonly string[]).includes(String(input.status)) ? input.status as MaterialStatus : "using";
  const id = randomUUID(), now = new Date().toISOString();
  sqlite.transaction(() => {
    sqlite.prepare("INSERT INTO resource VALUES (?,?,?,?,?,?,?,?)").run(id, kind, title, clip(input.creator, 160), safeUrl(clip(input.url, 600)), clip(input.notes, 1000), input.origin ?? "user_added", now);
    sqlite.prepare("INSERT INTO entity_link VALUES (?,?,?,?,?,?,?)").run(randomUUID(), "goal", goal, "resource", id, "material", JSON.stringify({status, pointer: clip(input.pointer, 140), why: clip(input.why, 240)}));
  })();
  return id;
}
export function updateMaterial(goal: string, id: string, patch: {status?: string; pointer?: string; notes?: string; why?: string}) {
  const link = sqlite.prepare("SELECT id,anchor FROM entity_link WHERE from_kind='goal' AND from_id=? AND to_kind='resource' AND to_id=? AND label='material'").get(goal, id) as {id: string; anchor: string} | undefined;
  if (!link) throw Error("That material is not on this goal.");
  const a = parse(link.anchor);
  if (patch.status && (MATERIAL_STATUS as readonly string[]).includes(patch.status)) a.status = patch.status as MaterialStatus;
  if (patch.pointer !== undefined) a.pointer = clip(patch.pointer, 140);
  if (patch.why !== undefined) a.why = clip(patch.why, 240);
  sqlite.transaction(() => {
    sqlite.prepare("UPDATE entity_link SET anchor=? WHERE id=?").run(JSON.stringify(a), link.id);
    if (patch.notes !== undefined) sqlite.prepare("UPDATE resource SET notes=? WHERE id=?").run(clip(patch.notes, 1000), id);
  })();
}
/** Detaches a material from a goal. The resource record stays, so nothing you wrote is lost. */
export function detachMaterial(goal: string, id: string) {
  sqlite.prepare("DELETE FROM entity_link WHERE from_kind='goal' AND from_id=? AND to_kind='resource' AND to_id=? AND label='material'").run(goal, id);
}
