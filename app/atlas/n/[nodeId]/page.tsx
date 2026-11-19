import {ensureRoutes} from "@/lib/v2/route";
import {ensureBridges} from "@/lib/v2/bridges";
import {confirmMerge,undoMerge,nameAlias} from "../../bridges-actions";
import {ensureNotebook} from "@/lib/v2/notebook";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {requireV2} from "@/lib/v2/access";
import {projection,relationKinds,type Observation} from "@/lib/v2/atlas";
import {sqlite} from "@/lib/db/client";
import {linkNodes} from "../../actions";
import {V2Shell} from "@/components/v2/shell";
export default async function NodePage({params,searchParams}:PageProps<"/atlas/n/[nodeId]">){
 requireV2();ensureNotebook();const {nodeId}=await params,query=await searchParams;
 const destination=sqlite.prepare("SELECT target FROM atlas_redirect WHERE source=?").get(nodeId) as {target:string}|undefined;
 if(destination)redirect("/atlas/n/"+destination.target);
 const merged=sqlite.prepare("SELECT n.id,n.label FROM atlas_redirect r JOIN atlas_node n ON n.id=r.source WHERE r.target=?").all(nodeId) as {id:string;label:string}[];
 const {nodes,edges}=projection(),node=nodes.find(n=>n.id===nodeId);if(!node)notFound();
 ensureBridges();const aliases=sqlite.prepare("SELECT label FROM atlas_alias WHERE node_id=? ORDER BY label").all(nodeId) as {label:string}[];
 ensureRoutes();
 const goals=sqlite.prepare(`SELECT c.goal,s.content_json,r.id AS route,(SELECT id FROM guide_conversation WHERE context_id=r.journey_id ORDER BY updated_at DESC LIMIT 1) AS thread FROM route_step s JOIN learning_route r ON r.id=s.route_id JOIN charter c ON c.id=r.charter_id WHERE r.status='active' AND s.node_id=?`).all(nodeId) as {goal:string;content_json:string;route:string;thread:string|null}[];
 const backlinks=sqlite.prepare("SELECT DISTINCT d.id,d.title FROM entity_link l JOIN document d ON d.current_revision_id=l.from_id WHERE l.from_kind='revision' AND l.to_kind='node' AND (l.to_id=? OR l.to_id IN (SELECT source FROM atlas_redirect WHERE target=?))").all(nodeId,nodeId) as {id:string;title:string}[];
 const legacy=node.legacy_id ? sqlite.prepare("SELECT level FROM skill WHERE id=?").get(node.legacy_id) as {level:number}|undefined : undefined;
 const observations=sqlite.prepare("SELECT * FROM knowledge_observation WHERE node_id=? OR node_id IN (SELECT source FROM atlas_redirect WHERE target=?) ORDER BY observed_at DESC").all(nodeId,nodeId) as Observation[];
 return <V2Shell active="Atlas"><Link href="/atlas" className="back-link">← Atlas</Link><header><p className="kicker">{node.kind} · {node.origin==="import"?"Imported from your skills":node.origin}</p><h1>{node.label}</h1><p className="reading">{node.description}</p></header><details><summary>Other names{aliases.length?" · "+aliases.length:""}</summary><p>{aliases.map(a=>a.label).join(", ")}</p><form action={nameAlias.bind(null,nodeId)}><label>Alternative name<input name="label" maxLength={160} required/></label><button>Add name</button></form></details>
 {goals.map(g=><section key={g.route}><h2>In your route</h2><Link href={g.thread?"/guide?thread="+g.thread:"/atlas?route="+g.route}>{g.goal}</Link><p>{JSON.parse(g.content_json).reason}</p></section>)}
 <section><h2>Your relationship to this concept</h2><p>Exposure · {observations.length>1?"Revisited":observations.length?"Encountered":"Not recorded"}</p><p>Self-assessment · Unknown</p>{legacy&&<small>Legacy skill level {legacy.level} of 5</small>}<p>{observations.length?"Recorded observations: "+observations.length:"You’ve saved this concept, but there isn’t evidence of your understanding yet."}</p></section>
 <section><h2>Evidence and timeline</h2>{observations.map(o=><article key={o.id}><small>{o.observed_at.slice(0,10)} · {o.kind.replaceAll("_"," ")}</small><blockquote className="reading">{o.quote}</blockquote>{o.source_kind==="log_entry"?<Link className="text-link" href={`/j/${o.journey}/journal?entry=${o.source_id}`}>Open original entry</Link>:o.source_kind==="document_revision"?<Link className="text-link" href={`/notebook/d/${(sqlite.prepare("SELECT document_id FROM document_revision WHERE id=?").get(o.source_id) as {document_id:string}).document_id}?rev=${o.source_id}`}>Open original revision</Link>:<Link className="text-link" href={"/atlas/e/"+o.source_id}>Open original skill observation</Link>}</article>)}</section>
 {backlinks.length>0&&<section><h2>Notebook pages</h2>{backlinks.map(d=><p key={d.id}><Link href={"/notebook/d/"+d.id}>{d.title}</Link></p>)}</section>}
 <section><h2>Connections</h2>{edges.filter(e=>e.source===nodeId||e.target===nodeId).map(e=><article key={e.id}><p>{nodes.find(n=>n.id===e.source)?.label} · {e.kind.replaceAll("_"," ")} · <Link href={"/atlas/n/"+(e.target===nodeId?e.source:e.target)}>{nodes.find(n=>n.id===e.target)?.label}</Link></p><small>{e.rationale}</small></article>)}
 <details open={query.linkError==="1"}><summary>Connect a concept</summary>{query.linkError&&<p role="alert">Check the connection. Duplicate links and circular prerequisites cannot be saved.</p>}<form action={linkNodes.bind(null,nodeId)}><label>Relation<select name="kind">{relationKinds.map(k=><option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}</select></label><label>To<select name="target">{nodes.filter(n=>n.id!==nodeId).map(n=><option value={n.id} key={n.id}>{n.label}</option>)}</select></label><label>Why are these connected?<textarea name="rationale" required maxLength={1000}/></label><button>Save connection</button></form></details></section><details><summary>Merge duplicate concepts</summary><form action={confirmMerge.bind(null,nodeId)}><label>Keep this concept<select name="target">{nodes.filter(n=>n.id!==nodeId).map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label><input type="checkbox" name="confirmed" value="yes" required/> Redirect {node.label} and show its evidence there</label><button>Confirm merge</button></form></details>{merged.map(m=><form key={m.id} action={undoMerge.bind(null,m.id,nodeId)}><button>Undo merge of {m.label}</button></form>)}</V2Shell>;
}
