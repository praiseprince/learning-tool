import Link from "next/link";
import {notFound} from "next/navigation";
import {format} from "date-fns";
import {requireV2} from "@/lib/v2/access";
import {documentById, revisionById, wikiLinks} from "@/lib/v2/notebook";
import {sqlite} from "@/lib/db/client";
import {Editor} from "@/components/v2/editor";
import {Markdown} from "@/components/v2/markdown";
import {projection} from "@/lib/v2/atlas";
import {retryRevision} from "../../actions";
import {fromNote} from "@/app/chat-actions";

export default async function Page({params, searchParams}: PageProps<"/notebook/d/[id]">) {
  requireV2();
  const {id} = await params, q = await searchParams, doc = documentById(id);
  if (!doc) notFound();
  const requested = typeof q.rev === "string" ? q.rev : doc.current_revision_id, r = revisionById(requested);
  if (!r || r.document_id !== id) notFound();
  const links = wikiLinks(r.id), history = sqlite.prepare("SELECT id,created_at FROM document_revision WHERE document_id=? ORDER BY rowid DESC").all(id) as {id: string; created_at: string}[];
  const goals = sqlite.prepare("SELECT id,name FROM journey WHERE status='active' ORDER BY name COLLATE NOCASE").all() as {id: string; name: string}[];
  const footer = <div className="stack" style={{borderTop: "1px solid var(--rule)", paddingTop: 16}}>
    <details><summary className="small">Earlier versions · {history.length}</summary><ul className="stack" style={{listStyle: "none", padding: "8px 0"}}>{history.map(h => <li key={h.id}><Link className="link small" href={`/notebook/d/${id}?rev=${h.id}`}>{format(new Date(h.created_at), "d MMM yyyy, HH:mm")}</Link></li>)}</ul></details>
    {doc.journey_id && <form action={fromNote.bind(null, id, "quiz")}><button className="btn btn--quiet btn--sm">Quiz me on this note</button></form>}
    <a className="link small" href={`/notebook/d/${id}/export`}>Export as Markdown</a>
    {Boolean(r.can_retry) && <form action={retryRevision.bind(null, r.id)} className="stack"><p className="small">Your note is saved. Suggestions for the map can be retried.</p><div><button className="btn btn--quiet btn--sm">Retry suggestions</button></div></form>}
  </div>;
  if (q.rev) return <div className="editor"><h1 className="title" style={{fontSize: "2rem"}}>{doc.title}</h1><p className="status">Earlier version, saved {format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</p>
    <div className="md"><Markdown text={r.content_md} links={links} /></div><div className="actions"><Link className="btn btn--quiet" href={"/notebook/d/" + id}>Back to the current note</Link></div>{footer}</div>;
  return <Editor id={id} initial={r.content_md} title={doc.title} revision={doc.current_revision_id} links={links} goal={doc.journey_id ?? ""} goals={goals} nodes={projection().nodes.map(n => ({id: n.id, label: n.label}))} footer={footer} />;
}
