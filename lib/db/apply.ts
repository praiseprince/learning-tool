"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sqlite } from "./client";
import { LogExtraction } from "../ai/extraction";

type Previous = {id:string; level:number; updated_at:string} ;
export async function resolveExtraction(entry: string, data: FormData) {
  const proposal = sqlite.prepare("SELECT * FROM proposal WHERE source_ref=? AND kind='extraction'").get(entry) as
    {id:string; journey_id:string; status:string; diff_json:string} | undefined;
  if (!proposal) throw Error("Suggestion unavailable.");
  const now = new Date().toISOString();
  sqlite.transaction(() => {
    if (data.get("intent") === "undo" && proposal.status === "applied") {
      const { before, created, snapshot } = JSON.parse(proposal.diff_json) as {before:Previous[];created:string[];snapshot:string|null};
      for (const id of [...created, ...before.map(row=>row.id)]) {
        const latest = sqlite.prepare("SELECT entry_id,at FROM skill_event WHERE skill_id=? ORDER BY rowid DESC LIMIT 1").get(id) as {entry_id:string;at:string};
        const skill = sqlite.prepare("SELECT updated_at FROM skill WHERE id=?").get(id) as {updated_at:string};
        if (latest?.entry_id !== entry || latest.at !== skill?.updated_at) throw Error("This skill has changed since this entry.");
      }
      for (const row of before) sqlite.prepare("UPDATE skill SET level=?,updated_at=? WHERE id=?").run(row.level,row.updated_at,row.id);
      for (const id of created) sqlite.prepare("DELETE FROM skill WHERE id=?").run(id);
      sqlite.prepare("DELETE FROM state_snapshot WHERE id=?").run(snapshot);
      sqlite.prepare("DELETE FROM entry_time WHERE entry_id=?").run(entry);
      sqlite.prepare("DELETE FROM skill_event WHERE entry_id=?").run(entry);
      sqlite.prepare("UPDATE proposal SET status='undone',resolved_at=? WHERE id=?").run(now,proposal.id);
      return;
    }
    if (proposal.status !== "pending") return;
    if (data.get("intent") === "dismiss") {
      sqlite.prepare("UPDATE proposal SET status='dismissed',resolved_at=? WHERE id=?").run(now,proposal.id);
      return;
    }
    const extraction = LogExtraction.parse(JSON.parse(proposal.diff_json));
    const before: Previous[] = [];
    const created: string[] = [];
    let snapshot = null;
    if (data.has("time")) {
      const minutes = Number(data.get("minutes"));
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 600) throw Error("Invalid duration.");
      sqlite.prepare("INSERT INTO entry_time VALUES (?,?)").run(entry,minutes);
    }
    extraction.skills.forEach((suggestion,index) => {
      if (!data.has(`skill-${index}`)) return;
      const level = Number(data.get(`level-${index}`));
      if (!Number.isInteger(level) || level<0 || level>5) throw Error("Invalid skill level.");
      const id = suggestion.skill_id ?? randomUUID();
      const old = sqlite.prepare("SELECT id,level,updated_at FROM skill WHERE journey_id=? AND id=?").get(proposal.journey_id,id) as Previous | undefined;
      if (old) {
        if (before.some(row=>row.id===id)) return;
        before.push(old);
        sqlite.prepare("UPDATE skill SET level=?,updated_at=? WHERE id=?").run(level,now,id);
      } else if (!suggestion.skill_id && suggestion.new_skill_name) {
        created.push(id);
        sqlite.prepare("INSERT INTO skill (id,journey_id,name,level,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(id,proposal.journey_id,suggestion.new_skill_name,level,now,now);
      } else return;
      sqlite.prepare("INSERT INTO skill_event VALUES (?,?,?,?,?,?,?)").run(randomUUID(),id,entry,level,level-(old?.level??0),suggestion.evidence_quote,now);
    });
    if (data.has("state")) {
      const summary = String(data.get("summary")??"").trim().slice(0,240);
      if (summary) {
        snapshot = randomUUID();
        sqlite.prepare("INSERT INTO state_snapshot (id,journey_id,summary,source_entry_id,created_at) VALUES (?,?,?,?,?)").run(snapshot,proposal.journey_id,summary,entry,now);
      }
    }
    sqlite.prepare("UPDATE proposal SET status='applied',diff_json=?,resolved_at=? WHERE id=?").run(JSON.stringify({extraction,before,created,snapshot}),now,proposal.id);
  })();
  revalidatePath(`/j/${proposal.journey_id}`);
}
