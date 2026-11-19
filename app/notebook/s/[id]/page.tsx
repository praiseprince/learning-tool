import Link from "next/link";
import {notFound} from "next/navigation";
import {requireV2} from "@/lib/v2/access";
import {ensureNotebook,type Resource} from "@/lib/v2/notebook";
import {sqlite} from "@/lib/db/client";
import {newNote} from "../../actions";
export default async function Source({params}:PageProps<"/notebook/s/[id]">){
 requireV2();ensureNotebook();const {id}=await params,s=sqlite.prepare("SELECT * FROM resource WHERE id=?").get(id) as Resource|undefined;if(!s)notFound();
 const notes=sqlite.prepare("SELECT d.id,d.title FROM entity_link l JOIN document d ON d.id=l.from_id WHERE l.to_kind='resource' AND l.to_id=?").all(id) as {id:string;title:string}[];
 return <div className="editor legacy"><Link href="/notebook" className="link small">← All notes</Link><p className="eyebrow">{s.kind} · Added by you</p><h1>{s.title}</h1><p>{s.creator}</p><p className="prose">{s.notes}</p>{s.url&&<a className="link" href={s.url}>Open source</a>}<section><h2>Source notes</h2>{notes.map(n=><p key={n.id}><Link href={"/notebook/d/"+n.id}>{n.title}</Link></p>)}<form action={newNote}><input type="hidden" name="source" value={id}/><input type="hidden" name="kind" value="source note"/><label>Page title<input name="title" defaultValue={s.title+" notes"} required/></label><button>Add source note</button></form></section></div>;
}
