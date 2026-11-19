import {sqlite} from "@/lib/db/client";
import {projection} from "./atlas";

export type UNode = {
  id: string; label: string; kind: string; description: string; origin: string;
  journeyId: string | null; journeyName: string | null; hue: number;
  level: number; evidence: number; lastSeen: string | null; degree: number;
};
export type ULink = {id: string; source: string; target: string; kind: string; rationale: string};
export type UJourney = {id: string; name: string; hue: number; count: number};

/** Everything the 3D atlas needs. Layout stays in the browser: positions are never stored. */
export function universe(journey?: string) {
  const {nodes, edges} = projection(journey);
  const meta = new Map<string, {jid: string; jname: string; hue: number}>();
  const rows = sqlite.prepare(`SELECT coalesce(r.target,m.node_id) AS id,j.id AS jid,j.name AS jname,j.hue AS hue
    FROM atlas_membership m JOIN journey j ON j.id=m.journey_id LEFT JOIN atlas_redirect r ON r.source=m.node_id WHERE j.status='active' ORDER BY j.name`).all() as {id: string; jid: string; jname: string; hue: number}[];
  for (const r of rows) if (!meta.has(r.id)) meta.set(r.id, r);
  const levels = new Map((sqlite.prepare("SELECT n.id,s.level FROM atlas_node n JOIN skill s ON s.id=n.legacy_id").all() as {id: string; level: number}[]).map(r => [r.id, r.level]));
  const evidence = new Map((sqlite.prepare("SELECT coalesce(r.target,o.node_id) AS id,COUNT(*) AS c,MAX(o.observed_at) AS last FROM knowledge_observation o LEFT JOIN atlas_redirect r ON r.source=o.node_id GROUP BY 1").all() as {id: string; c: number; last: string}[]).map(r => [r.id, r]));
  const degree = new Map<string, number>();
  for (const e of edges) for (const id of [e.source, e.target]) degree.set(id, (degree.get(id) || 0) + 1);
  const inactive = new Set((sqlite.prepare("SELECT DISTINCT coalesce(r.target,m.node_id) AS id FROM atlas_membership m JOIN journey j ON j.id=m.journey_id LEFT JOIN atlas_redirect r ON r.source=m.node_id WHERE j.status<>'active'").all() as {id: string}[]).map(r => r.id));
  const archived = new Set((sqlite.prepare("SELECT 'legacy-'||id AS id FROM skill WHERE archived=1").all() as {id: string}[]).map(r => r.id));
  const unodes: UNode[] = nodes.filter(n => !(inactive.has(n.id) && !meta.has(n.id)) && !archived.has(n.id)).map(n => {
    const m = meta.get(n.id), ev = evidence.get(n.id);
    return {
      id: n.id, label: n.label, kind: n.kind, description: n.description, origin: n.origin,
      journeyId: m?.jid ?? null, journeyName: m?.jname ?? null, hue: m?.hue ?? 250,
      level: levels.get(n.id) ?? 0, evidence: ev?.c ?? 0, lastSeen: ev?.last ?? null, degree: degree.get(n.id) || 0,
    };
  });
  const journeys = new Map<string, UJourney>();
  for (const n of unodes) if (n.journeyId) {
    const j = journeys.get(n.journeyId) ?? {id: n.journeyId, name: n.journeyName!, hue: n.hue, count: 0};
    j.count++; journeys.set(j.id, j);
  }
  const keep = new Set(unodes.map(n => n.id));
  const links: ULink[] = edges.filter(e => keep.has(e.source) && keep.has(e.target)).map(e => ({id: e.id, source: e.source, target: e.target, kind: e.kind, rationale: e.rationale}));
  return {nodes: unodes, links, journeys: [...journeys.values()]};
}
