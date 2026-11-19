import {ensureRoutes} from "@/lib/v2/route";
import {findBridges} from "@/app/atlas/bridges-actions";
import Link from "next/link";
import {notFound} from "next/navigation";
import {projection} from "@/lib/v2/atlas";
import {requireV2} from "@/lib/v2/access";
import {sqlite} from "@/lib/db/client";
import {createNode} from "@/app/atlas/actions";
import {AtlasGraph} from "./atlas-graph";
import {V2Shell} from "./shell";
type Filters=Record<string,string|string[]|undefined>;
export function AtlasPage({journey,filters={}}:{journey?:string;filters?:Filters}) {
 requireV2();ensureRoutes();
 const row=journey?sqlite.prepare("SELECT name FROM journey WHERE id=?").get(journey) as {name:string}|undefined:null;
 if(journey&&!row)notFound();
 const area=journey||(typeof filters.area==="string"?filters.area:"");
 const graph=projection(area||undefined);
 const areas=sqlite.prepare("SELECT id,name FROM journey ORDER BY name").all() as {id:string;name:string}[];
 const evidence=new Set((sqlite.prepare("SELECT DISTINCT coalesce(r.target,o.node_id) AS id FROM knowledge_observation o LEFT JOIN atlas_redirect r ON r.source=o.node_id WHERE o.observed_at>=?").all(typeof filters.since==="string"?filters.since:"") as {id:string}[]).map(r=>r.id));
 const routeNodes=new Set((sqlite.prepare("SELECT s.node_id FROM route_step s JOIN learning_route r ON r.id=s.route_id WHERE r.id=?").all(String(filters.route||"")) as {node_id:string}[]).map(r=>r.node_id));
 const routes=sqlite.prepare("SELECT r.id,c.goal FROM learning_route r JOIN charter c ON c.id=r.charter_id WHERE r.status='active' AND (?='' OR r.journey_id=?) ORDER BY c.goal").all(area,area) as {id:string;goal:string}[];
 const nodes=graph.nodes.filter(n=>(!filters.route||routeNodes.has(n.id))&&(!filters.kind||n.kind===filters.kind)&&(!(filters.evidence||filters.since)||evidence.has(n.id)));
 const memberships=sqlite.prepare("SELECT DISTINCT coalesce(r.target,m.node_id) AS id,j.id AS journey,j.name FROM atlas_membership m JOIN journey j ON j.id=m.journey_id LEFT JOIN atlas_redirect r ON r.source=m.node_id ORDER BY j.name").all() as {id:string;journey:string;name:string}[];
 const visible=new Set(nodes.map(n=>n.id));
 const edges=graph.edges.filter(e=>visible.has(e.source)&&visible.has(e.target));
 return <V2Shell active="Atlas"><header><p className="kicker">{row?.name||"Marginalia"}</p><h1>{row?"Local atlas":"Your atlas"}</h1><Link href="/atlas/history">Atlas history</Link>{journey&&<> · <Link href="/atlas">All journeys</Link></>}</header>
 <details open={Object.values(filters).some(Boolean)}><summary>Filter concepts</summary><form>
 {!journey&&<label>Journey<select name="area" defaultValue={area}><option value="">All journeys</option>{areas.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>}
 {routes.length>0&&<label>Goal route<select name="route" defaultValue={String(filters.route||"")}><option value="">All concepts</option>{routes.map(r=><option key={r.id} value={r.id}>{r.goal}</option>)}</select></label>}
 <label>Concept type<select name="kind" defaultValue={String(filters.kind||"")}><option value="">All types</option>{["concept","skill","topic","question"].map(k=><option key={k}>{k}</option>)}</select></label>
 <label>Evidence observed since<input type="date" name="since" defaultValue={String(filters.since||"")}/></label>
 <label><input type="checkbox" name="evidence" value="yes" defaultChecked={filters.evidence==="yes"}/> With recorded evidence</label>
 <button>Apply filters</button><Link href={journey?`/j/${journey}/atlas`:"/atlas"}>Clear filters</Link></form></details><AtlasGraph nodes={nodes} edges={edges} memberships={journey||area?[]:memberships.filter(m=>visible.has(m.id))}/>
 {!journey&&<form action={findBridges}><button>Look for connections across journeys</button></form>}
 <details className="v2-section"><summary>Add a concept</summary><form action={createNode.bind(null,journey||"")}><label>Name<input name="label" required maxLength={160}/></label><label>Kind<select name="kind">{["concept","skill","topic","question"].map(k=><option key={k}>{k}</option>)}</select></label><label>Description<textarea name="description" maxLength={3000}/></label><button>Add to atlas</button></form></details></V2Shell>;
}
