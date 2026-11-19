import Link from "next/link";
import {requireV2} from "@/lib/v2/access";
import {ensureNotebook,revisionById} from "@/lib/v2/notebook";
import {sqlite} from "@/lib/db/client";
import {V2Shell} from "@/components/v2/shell";
import {resolveObservation} from "../actions";
export default function Inbox(){
 requireV2();ensureNotebook();const rows=sqlite.prepare("SELECT id,diff_json,status,source_ref FROM proposal WHERE kind='facet_update' AND status IN ('pending','deferred','unsupported') ORDER BY created_at DESC").all() as {id:string;diff_json:string;status:string;source_ref:string}[];
 return <V2Shell active="Notebook"><Link href="/notebook" className="back-link">← Notebook</Link><h1>Suggestions</h1>{!rows.length&&<p className="reading">Nothing waiting for review.</p>}{rows.map(p=>{const change=JSON.parse(p.diff_json),r=revisionById(p.source_ref),n=sqlite.prepare("SELECT label FROM atlas_node WHERE id=?").get(change.nodeId) as {label:string}|undefined;
 return <section key={p.id}><small>{p.status} · {change.kind.replaceAll("_"," ")}</small><h2>{n?.label||"Unknown concept"}</h2><blockquote className="reading">{change.quote}</blockquote>{r&&<Link href={`/notebook/d/${r.document_id}?rev=${r.id}`}>Open original revision</Link>}<form action={resolveObservation.bind(null,p.id)}><label>Scope<textarea name="scope" defaultValue={change.scope}/></label><div className="v2-tools">{p.status!=="unsupported"&&<button name="intent" value="accept">Accept</button>}<button name="intent" value="dismiss">Dismiss</button><button name="intent" value="defer">Defer</button></div></form></section>;})}</V2Shell>;
}
