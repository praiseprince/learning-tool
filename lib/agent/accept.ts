import {randomUUID} from "node:crypto";
import {sqlite} from "../db/client.ts";
import {addMaterial} from "../v2/materials.ts";
import {storeDocument} from "../v2/notebook.ts";
import type {Check} from "./ingest.ts";

export type Pending = {id: string; kind: string; payload: any; created_at: string}; // eslint-disable-line @typescript-eslint/no-explicit-any
export function pending(goal: string): Pending[] {
  return (sqlite.prepare("SELECT id,kind,diff_json,created_at FROM proposal WHERE journey_id=? AND kind IN ('agent_material','agent_action','agent_evidence') AND status='pending' ORDER BY created_at DESC").all(goal) as {id: string; kind: string; diff_json: string; created_at: string}[])
    .map(r => ({id: r.id, kind: r.kind, payload: JSON.parse(r.diff_json), created_at: r.created_at}));
}

/** Applying a suggestion is always an explicit act by the learner. Returns where to send them next. */
export function accept(id: string): {goal: string; next: string} {
  const r = sqlite.prepare("SELECT journey_id,kind,diff_json FROM proposal WHERE id=? AND status='pending'").get(id) as {journey_id: string; kind: string; diff_json: string} | undefined;
  if (!r) throw Error("That suggestion was already handled.");
  const goal = r.journey_id, p = JSON.parse(r.diff_json), now = new Date().toISOString();
  let next = `/goals/${goal}?tab=guide`;
  sqlite.transaction(() => {
    if (r.kind === "agent_material") {
      const sug = p.suggestion, c: Check = p.check;
      addMaterial(goal, {title: sug.title, kind: sug.kind, creator: sug.creator, url: sug.url, notes: `${sug.why}${c.ok ? ` Link checked ${c.at.slice(0, 10)}.` : ""}`, status: "queued", origin: c.ok ? "agent_checked" : "agent_unchecked"});
      next = `/goals/${goal}?tab=materials&added=1`;
    } else if (r.kind === "agent_action") {
      if (p.type === "add_note") { const id2 = randomUUID(); storeDocument({id: id2, base: null, title: p.title || "Note from the Guide", body: p.body, kind: "note", journey: goal, author: "ai"}); next = `/notebook/d/${id2}`; }
      else if (p.type === "add_material") { addMaterial(goal, {title: p.title, url: p.url, notes: p.body.slice(0, 600), status: "queued", origin: "agent_unchecked"}); next = `/goals/${goal}?tab=materials&added=1`; }
      else if (p.type === "revise_goal") next = `/goals/${goal}/revise?text=${encodeURIComponent((p.body || p.title).slice(0, 800))}`;
      else if (p.type === "plan_today") next = `/?goal=${goal}&note=${encodeURIComponent((p.body || p.title).slice(0, 400))}`;
    } else if (r.kind === "agent_evidence") {
      const sk = sqlite.prepare("SELECT level FROM skill WHERE id=? AND journey_id=?").get(p.skill, goal) as {level: number} | undefined;
      if (sk) {
        const after = Math.min(5, Math.max(sk.level, Math.min(Number(p.hint) || 0, sk.level + 1))), delta = after - sk.level;
        sqlite.prepare("INSERT INTO skill_event VALUES (?,?,?,?,?,?,?)").run(randomUUID(), p.skill, p.entry, after, delta, String(p.quote).slice(0, 300), now);
        if (delta > 0) sqlite.prepare("UPDATE skill SET level=?,updated_at=? WHERE id=?").run(after, now, p.skill);
        sqlite.prepare("INSERT INTO knowledge_observation VALUES (?,?,?,?,?,?,?,?,?)").run(randomUUID(), "legacy-" + p.skill, "work_review", "log_entry", p.entry, String(p.quote).slice(0, 300), now.slice(0, 10), now, goal);
      }
      next = `/goals/${goal}?tab=skills`;
    }
    sqlite.prepare("UPDATE proposal SET status='accepted',resolved_at=? WHERE id=?").run(now, id);
  })();
  return {goal, next};
}
export function dismiss(id: string) { sqlite.prepare("UPDATE proposal SET status='dismissed',resolved_at=? WHERE id=? AND status='pending'").run(new Date().toISOString(), id); }
