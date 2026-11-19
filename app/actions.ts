"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { sqlite } from "@/lib/db/client";
import { draftJourney } from "@/lib/ai/stub";

export async function createJourney(formData: FormData) {
  const intent = String(formData.get("intent") || "").trim();
  const starting = String(formData.get("starting") || "").trim();
  const hue = Number(formData.get("hue") || 100);
  if (!intent) return;
  const draft = draftJourney(intent, starting);
  const id = randomUUID(); const now = new Date().toISOString(); const date = now.slice(0, 10);
  sqlite.transaction(() => {
    sqlite.prepare("INSERT INTO journey (id,name,domain,hue,start_date,status,created_at) VALUES (?,?,?,?,?,'active',?)").run(id, draft.name, "general", hue, date, now);
    sqlite.prepare("INSERT INTO charter (id,journey_id,version,goal,why,done_looks_like,starting_point,created_at) VALUES (?,?,?,?,?,?,?,?)").run(randomUUID(), id, 1, draft.goal, draft.why, draft.doneLooksLike, draft.startingPoint, now);
    for (const skill of draft.skills) sqlite.prepare("INSERT INTO skill (id,journey_id,name,level,prereq_ids_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(randomUUID(), id, skill.name, skill.level, "[]", now, now);
    sqlite.prepare("INSERT INTO state_snapshot (id,journey_id,summary,created_at) VALUES (?,?,?,?)").run(randomUUID(), id, draft.startingPoint, now);
  })();
  redirect(`/j/${id}`);
}
