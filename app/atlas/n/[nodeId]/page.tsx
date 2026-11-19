import {ensureNotebook} from "@/lib/v2/notebook";
import Link from "next/link";
import {notFound} from "next/navigation";
import {requireV2} from "@/lib/v2/access";
import {projection,relationKinds,type Observation} from "@/lib/v2/atlas";
import {sqlite} from "@/lib/db/client";
import {linkNodes} from "../../actions";
import {V2Shell} from "@/components/v2/shell";
export default async function NodePage({params,searchParams}:PageProps<"/atlas/n/[nodeId]">){
 requireV2();ensureNotebook();const {nodeId}=await params,query=await searchParams;
 const {nodes,edges}=projection(),node=nodes.find(n=>n.id===nodeId);if(!node)notFound();
 const backlinks=sqlite.prepare("SELECT DISTINCT d.id,d.title FROM entity_link l JOIN document d ON d.current_revision_id=l.from_id WHERE l.from_kind='revision' AND l.to_kind='node' AND l.to_id=?").all(nodeId) as {id:string;title:string}[];
 const legacy=node.legacy_id ? sqlite.prepare("SELECT level FROM skill WHERE id=?").get(node.legacy_id) as {level:number}|undefined : undefined;
 const observations=sqlite.prepare("SELECT * FROM knowledge_observation WHERE node_id=? ORDER BY observed_at DESC").all(nodeId) as Observation[];
 return <V2Shell active="Atlas"><Link href="/atlas" className="back-link">← Atlas</Link><header><p className="kicker">{node.kind} · {node.origin==="import"?"Imported from your skills":node.origin}</p><h1>{node.label}</h1><p className="reading">{node.description}</p></header>
 <section><h2>Your relationship to this concept</h2><p>Exposure · {observations.length>1?"Revisited":observations.length?"Encountered":"Not recorded"}</p><p>Self-assessment · Unknown</p>{legacy&&<small>Legacy skill level {legacy.level} of 5</small>}<p>{observations.length?"Recorded observations: "+observations.length:"You’ve saved this concept, but there isn’t evidence of your understanding yet."}</p></section>
 <section><h2>Evidence and timeline</h2>{observations.map(o=><article key={o.id}><small>{o.observed_at.slice(0,10)} · {o.kind.replaceAll("_"," ")}</small><blockquote className="reading">{o.quote}</blockquote>{o.source_kind==="log_entry"?<Link className="text-link" href={`/j/${o.journey}/journal?entry=${o.source_id}`}>Open original entry</Link>:o.source_kind==="document_revision"?<Link className="text-link" href={`/notebook/d/${(sqlite.prepare("SELECT document_id FROM document_revision WHERE id=?").get(o.source_id) as {document_id:string}).document_id}?rev=${o.source_id}`}>Open original revision</Link>:<Link className="text-link" href={"/atlas/e/"+o.source_id}>Open original skill observation</Link>}</article>)}</section>
 {backlinks.length>0&&<section><h2>Notebook pages</h2>{backlinks.map(d=><p key={d.id}><Link href={"/notebook/d/"+d.id}>{d.title}</Link></p>)}</section>}
 <section><h2>Connections</h2>{edges.filter(e=>e.source===nodeId||e.target===nodeId).map(e=><article key={e.id}><p>{nodes.find(n=>n.id===e.source)?.label} · {e.kind.replaceAll("_"," ")} · <Link href={"/atlas/n/"+(e.target===nodeId?e.source:e.target)}>{nodes.find(n=>n.id===e.target)?.label}</Link></p><small>{e.rationale}</small></article>)}
 <details open={query.linkError==="1"}><summary>Connect a concept</summary>{query.linkError&&<p role="alert">Check the connection. Duplicate links and circular prerequisites cannot be saved.</p>}<form action={linkNodes.bind(null,nodeId)}><label>Relation<select name="kind">{relationKinds.map(k=><option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}</select></label><label>To<select name="target">{nodes.filter(n=>n.id!==nodeId).map(n=><option value={n.id} key={n.id}>{n.label}</option>)}</select></label><label>Why are these connected?<textarea name="rationale" required maxLength={1000}/></label><button>Save connection</button></form></details></section></V2Shell>;
}
