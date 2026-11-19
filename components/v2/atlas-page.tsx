import {ensureRoutes} from "@/lib/v2/route";
import {findBridges} from "@/app/atlas/bridges-actions";
import {requireV2} from "@/lib/v2/access";
import {sqlite} from "@/lib/db/client";
import {createNode} from "@/app/atlas/actions";
import {universe} from "@/lib/v2/universe";
import {Universe} from "./universe";
import {AppShell} from "./shell";
import {Select} from "@/components/ui/select";

export function AtlasPage({goal}: {goal?: string}) {
  requireV2(); ensureRoutes();
  const world = universe();
  const goals = sqlite.prepare("SELECT id,name FROM journey WHERE status='active' ORDER BY name COLLATE NOCASE").all() as {id: string; name: string}[];
  const initial = goal && goals.some(g => g.id === goal) ? goal : undefined;
  const route = (sqlite.prepare("SELECT r.journey_id AS goal,s.node_id AS node,s.position AS idx FROM route_step s JOIN learning_route r ON r.id=s.route_id AND r.status='active' JOIN journey j ON j.id=r.journey_id WHERE j.status='active' ORDER BY r.journey_id,s.position").all() as {goal: string; node: string; idx: number}[]).map(r => ({goal: r.goal, node: r.node, index: r.idx}));
  return <AppShell active="Map"><Universe nodes={world.nodes} links={world.links} journeys={world.journeys} route={route} initialGoal={initial}>
    <details className="map-add"><summary>Add a skill</summary><form action={createNode.bind(null, initial ?? "")}>
      <label className="field"><span>Name</span><input name="label" required maxLength={160} /></label>
      <label className="field"><span>Kind</span><Select name="kind">{["skill", "concept", "topic", "question"].map(k => <option key={k}>{k}</option>)}</Select></label>
      <label className="field"><span>Description</span><textarea name="description" rows={2} maxLength={3000} /></label>
      <button className="btn btn--quiet btn--sm">Add to map</button></form></details>
    <form action={findBridges}><button className="btn btn--quiet btn--sm">Find links between goals</button></form>
  </Universe></AppShell>;
}
