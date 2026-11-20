// Deleting an archived goal for good: its chat, notes, sessions, skills, plans, materials, its place on the Map and its
// files. Map concepts another goal still uses stay (the Atlas is shared); concepts only this goal had go with it.
// A copy of the database and the goal's files is kept next to the database first, like a reset, so it can be undone by hand.
import {existsSync, renameSync, rmSync} from "node:fs";
import {sqlite} from "../db/client.ts";
import {backupBeforeReset} from "../db/personal.ts";
import {inside} from "../agent/workspace.ts";
import {forgetTranscript} from "../chat/remove.ts";

const has = (t: string) => !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const ids = (sql: string, ...a: unknown[]) => (sqlite.prepare(sql).all(...a) as {id: string}[]).map(r => r.id);
const marks = (n: number) => Array(n).fill("?").join(",");
/** Runs `sql` with `IN (?)` expanded over `list`, in chunks, when the table exists. */
function each(table: string, sql: string, list: string[], ...before: unknown[]) {
  if (!list.length || !has(table)) return;
  for (let i = 0; i < list.length; i += 400) { const c = list.slice(i, i + 400); sqlite.prepare(sql.replaceAll("(?)", `(${marks(c.length)})`)).run(...before, ...c); }
}

export function deleteGoal(goal: string): {ok: true; backup: string} | {ok: false; error: string} {
  const j = sqlite.prepare("SELECT status FROM journey WHERE id=?").get(goal) as {status: string} | undefined;
  if (!j) return {ok: false, error: "That goal is already gone."};
  if (j.status !== "archived") return {ok: false, error: "Archive the goal first; only archived goals can be deleted."};
  if (has("agent_job") && sqlite.prepare("SELECT 1 FROM agent_job WHERE goal=? AND status='running'").get(goal)) return {ok: false, error: "The Guide is still working in this goal. Try again when it has finished."};

  const backup = backupBeforeReset(`deleting-${goal.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}`);
  const sessions = has("agent_job") ? (sqlite.prepare("SELECT json_extract(usage_json,'$.provider') AS p,json_extract(usage_json,'$.session') AS s FROM agent_job WHERE goal=? AND usage_json IS NOT NULL").all(goal) as {p: string | null; s: string | null}[]) : [];

  sqlite.transaction(() => {
    const entries = ids("SELECT id FROM log_entry WHERE journey_id=?", goal), skills = ids("SELECT id FROM skill WHERE journey_id=?", goal);
    const docs = has("document") ? ids("SELECT id FROM document WHERE journey_id=?", goal) : [], revs: string[] = [];
    for (let i = 0; i < docs.length; i += 400) revs.push(...ids(`SELECT id FROM document_revision WHERE document_id IN (${marks(Math.min(400, docs.length - i))})`, ...docs.slice(i, i + 400)));
    const plans = ids("SELECT id FROM plan_item WHERE journey_id=?", goal), routes = has("learning_route") ? ids("SELECT id FROM learning_route WHERE journey_id=?", goal) : [];
    const convs = has("guide_conversation") ? ids("SELECT id FROM guide_conversation WHERE context_id=?", goal) : [];

    // sessions, skills and their evidence (search rows go with them through triggers)
    each("skill_event", "DELETE FROM skill_event WHERE entry_id IN (?)", entries); each("skill_event", "DELETE FROM skill_event WHERE skill_id IN (?)", skills);
    for (const t of ["entry_time", "log_extraction", "extraction_answer"]) each(t, `DELETE FROM ${t} WHERE entry_id IN (?)`, entries);
    each("knowledge_observation", "DELETE FROM knowledge_observation WHERE source_id IN (?)", [...entries, ...docs, ...revs]);
    // notes
    each("notebook_search", "DELETE FROM notebook_search WHERE id IN (?)", [...docs, ...revs]);
    each("entity_link", "DELETE FROM entity_link WHERE from_id IN (?)", [...docs, ...revs, ...entries]);
    each("entity_link", "DELETE FROM entity_link WHERE to_id IN (?)", [...docs, ...revs, ...entries]);
    each("document_revision", "DELETE FROM document_revision WHERE document_id IN (?)", docs);
    // materials: the goal's links, and the material itself when no other goal or note uses it
    const res = has("entity_link") ? ids("SELECT to_id AS id FROM entity_link WHERE from_kind='goal' AND from_id=? AND to_kind='resource'", goal) : [];
    if (has("entity_link")) sqlite.prepare("DELETE FROM entity_link WHERE from_kind='goal' AND from_id=?").run(goal);
    for (const r of res) if (!sqlite.prepare("SELECT 1 FROM entity_link WHERE to_id=? OR from_id=?").get(r, r)) sqlite.prepare("DELETE FROM resource WHERE id=?").run(r);
    // plans, routes, the Guide
    each("plan_mark", "DELETE FROM plan_mark WHERE plan_id IN (?)", plans);
    each("route_step", "DELETE FROM route_step WHERE route_id IN (?)", routes);
    each("guide_turn", "DELETE FROM guide_turn WHERE conversation_id IN (?)", convs);
    if (has("bridge_review")) sqlite.prepare("DELETE FROM bridge_review WHERE proposal_id IN (SELECT id FROM proposal WHERE journey_id=?)").run(goal);
    const byGoal: [string, string][] = [["learning_route", "journey_id"], ["guide_conversation", "context_id"], ["document", "journey_id"], ["knowledge_observation", "journey"],
      ["chat_event", "goal"], ["agent_job", "goal"], ["agent_session", "goal"], ["proposal", "journey_id"], ["state_snapshot", "journey_id"], ["review", "journey_id"],
      ["rollup", "journey_id"], ["plan_item", "journey_id"], ["log_entry", "journey_id"], ["skill", "journey_id"], ["charter", "journey_id"]];
    for (const [t, c] of byGoal) if (has(t)) sqlite.prepare(`DELETE FROM ${t} WHERE ${c}=?`).run(goal);

    // the Map: this goal's memberships; concepts no other goal holds go, with their links
    if (has("atlas_membership")) {
      const nodes = ids("SELECT DISTINCT node_id AS id FROM atlas_membership WHERE journey_id=?", goal);
      sqlite.prepare("DELETE FROM atlas_membership WHERE journey_id=?").run(goal);
      const lone = nodes.filter(n => !sqlite.prepare("SELECT 1 FROM atlas_membership WHERE node_id=?").get(n) && !(has("route_step") && sqlite.prepare("SELECT 1 FROM route_step WHERE node_id=?").get(n)));
      const rels = has("atlas_relation") ? lone.flatMap(n => ids("SELECT id FROM atlas_relation WHERE source=? OR target=?", n, n)) : [];
      each("graph_event", "DELETE FROM graph_event WHERE entity_id IN (?)", [...lone, ...rels]);
      for (const n of lone) {
        if (has("atlas_relation")) sqlite.prepare("DELETE FROM atlas_relation WHERE source=? OR target=?").run(n, n);
        if (has("atlas_redirect")) sqlite.prepare("DELETE FROM atlas_redirect WHERE source=? OR target=?").run(n, n);
        for (const [t, c] of [["atlas_alias", "node_id"], ["knowledge_observation", "node_id"]]) if (has(t)) sqlite.prepare(`DELETE FROM ${t} WHERE ${c}=?`).run(n);
        if (has("bridge_review")) sqlite.prepare("DELETE FROM bridge_review WHERE source=? OR target=?").run(n, n);
        if (has("entity_link")) sqlite.prepare("DELETE FROM entity_link WHERE to_id=? OR from_id=?").run(n, n);
        sqlite.prepare("DELETE FROM atlas_node WHERE id=?").run(n);
      }
    }
    sqlite.prepare("DELETE FROM journey WHERE id=?").run(goal);
  })();

  // files: kept beside the backup, like a reset
  const ws = inside(goal);
  if (existsSync(ws)) { try { renameSync(ws, `${backup.replace(/\.db$/, "")}-files`); } catch { rmSync(ws, {recursive: true, force: true}); } }
  for (const x of sessions) if (x.p && x.s) forgetTranscript(x.p, x.s);
  try { sqlite.pragma("wal_checkpoint(TRUNCATE)"); } catch { /* folded in later */ }
  return {ok: true, backup};
}
