import Link from "next/link";
import {notFound} from "next/navigation";
import {requireV2} from "@/lib/v2/access";
import {documentById,revisionById,wikiLinks} from "@/lib/v2/notebook";
import {sqlite} from "@/lib/db/client";
import {V2Shell} from "@/components/v2/shell";
import {Editor} from "@/components/v2/editor";
import {Markdown} from "@/components/v2/markdown";
import {projection} from "@/lib/v2/atlas";
import {retryRevision} from "../../actions";
export default async function Page({params,searchParams}:PageProps<"/notebook/d/[id]">){
 requireV2();const {id}=await params,q=await searchParams,doc=documentById(id);if(!doc)notFound();
 const requested=typeof q.rev==="string"?q.rev:doc.current_revision_id,r=revisionById(requested);if(!r||r.document_id!==id)notFound();
 const links=wikiLinks(r.id),history=sqlite.prepare("SELECT id,created_at FROM document_revision WHERE document_id=? ORDER BY rowid DESC").all(id) as {id:string;created_at:string}[];
 return <V2Shell active="Notebook"><Link className="back-link" href="/notebook">← Notebook</Link>{q.rev?<><h1>{doc.title}</h1><small>Revision saved {r.created_at}</small><Markdown text={r.content_md} links={links}/><Link href={"/notebook/d/"+id}>Open current page</Link></>:<><h1>Notebook page</h1><Editor key={id} id={id} initial={r.content_md} title={doc.title} revision={r.id} links={links} nodes={projection().nodes.map(({id,label})=>({id,label}))}/></>}
 <section><details><summary>Revision history · {history.length}</summary>{history.map(h=><p key={h.id}><Link href={`/notebook/d/${id}?rev=${h.id}`}>{h.created_at}</Link></p>)}</details>
 <a className="text-link" href={`/notebook/d/${id}/export`}>Export Markdown</a>
 {r.extraction_status==="failed"&&<form action={retryRevision.bind(null,r.id)}><p>The Guide is unavailable. Your work is saved.</p><button>Retry suggestions</button></form>}</section></V2Shell>;
}
