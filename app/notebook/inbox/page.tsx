import {ensureBridges} from "@/lib/v2/bridges";
import {reviewBridge} from "@/app/atlas/bridges-actions";
import {relationKinds} from "@/lib/v2/atlas";
import Link from "next/link";
import {requireV2} from "@/lib/v2/access";
import {ensureNotebook,revisionById} from "@/lib/v2/notebook";
import {sqlite} from "@/lib/db/client";
import {resolveObservation,undoAccepted} from "../actions";
import {Select} from "@/components/ui/select";
export default async function Inbox({searchParams}:PageProps<"/notebook/inbox">){
 requireV2();ensureNotebook();ensureBridges();
 const {provider}=await searchParams;
 const accepted=sqlite.prepare("SELECT id,kind,diff_json FROM proposal WHERE kind IN ('bridge','facet_update') AND status='accepted' ORDER BY resolved_at DESC LIMIT 30").all() as {id:string;kind:string;diff_json:string}[];
 const bridges=sqlite.prepare("SELECT id,diff_json,status FROM proposal WHERE kind='bridge' AND status IN ('pending','deferred') ORDER BY created_at DESC").all() as {id:string;diff_json:string;status:string}[];
 const rows=sqlite.prepare("SELECT id,diff_json,status,source_ref FROM proposal WHERE kind='facet_update' AND status IN ('pending','deferred','unsupported') ORDER BY created_at DESC").all() as {id:string;diff_json:string;status:string;source_ref:string}[];
 return <div className="editor legacy"><Link href="/notebook" className="link small">← All notes</Link><h1>Suggestions</h1>{provider==="failed"&&<p role="alert">The Guide could not finish reviewing connections. Your Atlas is saved.</p>}
 {bridges.map(p=>{const b=JSON.parse(p.diff_json);return <section key={p.id}><small>{p.status} · {b.meaning}</small><h2>{b.first} ↔ {b.second}</h2><p>Proposed connection between two journeys</p><form action={reviewBridge.bind(null,p.id)}><label>Connection<Select name="kind" defaultValue="cross_domain_bridge">{relationKinds.map(k=><option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}</Select></label><label>Reason<textarea name="rationale" defaultValue={b.rationale}/></label><div className="v2-tools"><button name="intent" value="accept">Accept connection</button><button name="intent" value="dismiss">Dismiss</button><button name="intent" value="defer">Defer</button></div></form></section>})}
 {!bridges.length&&!rows.length&&<p className="prose">Nothing waiting for review.</p>}{rows.map(p=>{const change=JSON.parse(p.diff_json),r=revisionById(p.source_ref),n=sqlite.prepare("SELECT label FROM atlas_node WHERE id=?").get(change.nodeId) as {label:string}|undefined;
 return <section key={p.id}><small>{p.status} · {change.kind.replaceAll("_"," ")}</small><h2>{n?.label||(change.newConcept?"New concept · "+change.label:"Unknown concept")}</h2><blockquote className="prose">{change.quote}</blockquote>{r&&<Link href={`/notebook/d/${r.document_id}?rev=${r.id}`}>Open original revision</Link>}<form action={resolveObservation.bind(null,p.id)}><label>Scope<textarea name="scope" defaultValue={change.scope}/></label><div className="v2-tools">{p.status!=="unsupported"&&<button name="intent" value="accept">Accept</button>}<button name="intent" value="dismiss">Dismiss</button><button name="intent" value="defer">Defer</button></div></form></section>;})}{accepted.length>0&&<details><summary>Recently accepted</summary>{accepted.map(p=>{const change=JSON.parse(p.diff_json);return <form key={p.id} action={undoAccepted.bind(null,p.id)}><p>{p.kind==="bridge"?change.first+" ↔ "+change.second:change.quote}</p><button>Undo acceptance</button></form>})}</details>}</div>;
}
