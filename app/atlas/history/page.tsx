import Link from "next/link";
import {V2Shell} from "@/components/v2/shell";
import {requireV2} from "@/lib/v2/access";
import {acceptedAt} from "@/lib/v2/history";
export default async function History({searchParams}:PageProps<"/atlas/history">){
 requireV2();
 const {date}=await searchParams,today=new Date().toISOString().slice(0,10);
 const day=typeof date==="string"?date:today;
 let state;
 try{state=acceptedAt(day);}catch{return <V2Shell active="Atlas"><h1>Atlas history</h1><Link href="/atlas/history">Choose another date</Link></V2Shell>;}
 const labels=new Map(state.nodes.map(n=>[n.id,n.label]));
 return <V2Shell active="Atlas"><Link href="/atlas">← Atlas</Link><h1>Atlas history</h1>
 <form><label>Accepted through this date (UTC)<input type="date" name="date" defaultValue={day} required/></label><button>View this date</button></form>
 <p>{state.nodes.length} concepts · {state.edges.length} connections · {state.observations.length} observations</p>
 <section><h2>Concepts</h2>{state.nodes.map(n=><details key={n.id}><summary>{n.label}</summary><p>{n.description}</p>{state.edges.filter(e=>e.source===n.id||e.target===n.id).map(e=><p key={e.id}>{labels.get(e.source)} · {e.kind.replaceAll("_"," ")} · {labels.get(e.target)}<br/>{e.rationale}</p>)}
 {state.observations.filter(o=>o.node_id===n.id).map(o=><blockquote key={o.id}>{o.quote} <small>Observed {o.observed_at.slice(0,10)}</small></blockquote>)}</details>)}</section><details><summary>Dated changes · {state.events.length}</summary>{state.events.slice(-100).reverse().map((e,i)=><p key={i}><time>{e.recorded_at}</time> · {e.action} · {labels.get(e.entity_id)||e.entity.replaceAll("_"," ")}</p>)}</details></V2Shell>;
}
