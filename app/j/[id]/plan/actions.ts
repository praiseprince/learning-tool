"use server";

import { redirect, notFound } from "next/navigation";
import { getJourneyView } from "@/lib/db/queries";
import { draftPlan, storePlan } from "@/lib/db/plans";
import { sqlite } from "@/lib/db/client";

export async function generatePlan(journey:string, data:FormData) {
  const view = await getJourneyView(journey);
  if (!view) notFound();
  const requested = Number(data.get("minutes"));
  const refinement = String(data.get("refinement") || "");
  const minutes = refinement === "Shorter" ? Math.max(5,Math.round(requested*0.7)) : requested;
  if (!Number.isInteger(minutes) || minutes<5 || minutes>600) throw Error("Choose 5 to 600 minutes.");
  const context = [view.state?.summary, view.charter?.goal, data.get("energy"), String(data.get("note")||"").slice(0,1000)].filter(Boolean).join("\n");
  const plan = await draftPlan(journey,minutes,refinement,context);
  const id = sqlite.transaction(()=>storePlan(journey,plan,"plan"))();
  redirect(`/j/${journey}/plan?plan=${id}`);
}

export async function beginFocus(journey:string,id:string) {
  const changed = sqlite.prepare("UPDATE plan_item SET status='started' WHERE id=? AND journey_id=? AND status IN ('planned','started')").run(id,journey);
  if (!changed.changes) redirect(`/j/${journey}/plan`);
  redirect(`/j/${journey}/focus?plan=${id}`);
}

export async function finishFocus(journey:string,id:string) {
  sqlite.prepare("UPDATE plan_item SET status='finished' WHERE id=? AND journey_id=? AND status='started'").run(id,journey);
}

export async function changeDuration(journey:string,minutes:number) {
  if (!Number.isInteger(minutes) || minutes<5 || minutes>600) throw Error("Choose 5 to 600 minutes.");
  const view=await getJourneyView(journey);
  if(!view) notFound();
  const plan=await draftPlan(journey,minutes,"",view.state?.summary || view.charter?.goal || "");
  sqlite.transaction(()=>storePlan(journey,plan,"duration"))();
}
