import Link from "next/link";
import {requireV2} from "@/lib/v2/access";
import {ensureNotebook,searchNotebook,type DocumentRow,type Resource} from "@/lib/v2/notebook";
import {sqlite} from "@/lib/db/client";
import {V2Shell} from "@/components/v2/shell";
import {newNote,addSource} from "./actions";
export default async function Notebook({searchParams}:PageProps<"/notebook">){
 requireV2();ensureNotebook();const query=await searchParams,q=typeof query.q==="string"?query.q:"";
 const docs=sqlite.prepare("SELECT * FROM document WHERE status='active' ORDER BY updated_at DESC").all() as DocumentRow[];
 const sources=sqlite.prepare("SELECT * FROM resource ORDER BY created_at DESC").all() as Resource[];
 const inbox=(sqlite.prepare("SELECT COUNT(*) n FROM proposal WHERE kind IN ('facet_update','bridge') AND status IN ('pending','unsupported')").get() as {n:number}).n;
 const results=searchNotebook(q);
 return <V2Shell active="Notebook"><header><h1>Notebook</h1><Link className="text-link" href="/notebook/inbox">Suggestions{inbox?` · ${inbox}`:""}</Link></header>
 <form action="/notebook"><label>Search notes and history<input type="search" name="q" defaultValue={q}/></label></form>
 {q?<section><h2>Search results</h2>{!results.length&&<p>No matches.</p>}{results.map(r=>{const journey=r.kind==="entry"?(sqlite.prepare("SELECT journey_id FROM log_entry WHERE id=?").get(r.id) as {journey_id:string}|undefined)?.journey_id:"";
 return <article key={r.kind+r.id+r.excerpt}><Link href={r.kind==="entry"?`/j/${journey}/journal?entry=${r.id}`:r.kind==="conversation"?"/guide?thread="+r.id:r.kind==="skill_event"?"/atlas/e/"+r.id:r.kind==="resource"?"/notebook/s/"+r.id:"/notebook/d/"+r.id}>{r.title}</Link><p className="reading-small">{r.excerpt}</p></article>;})}</section>:<>
 <section><h2>Pages</h2><form action={newNote}><label>New page title<input name="title" required maxLength={240}/></label><button>Create page</button></form>{docs.map(d=><article key={d.id}><Link className="text-link" href={"/notebook/d/"+d.id}>{d.title}</Link><small> · {d.updated_at.slice(0,10)}</small></article>)}</section>
 <section><h2>Sources</h2>{sources.map(s=><article key={s.id}><Link href={"/notebook/s/"+s.id}>{s.title}</Link> · {s.kind}</article>)}<details><summary>Add a source</summary><form action={addSource}><label>Title<input name="title" required/></label><label>Type<select name="kind">{["book","article","website","video","file"].map(k=><option key={k}>{k}</option>)}</select></label><label>Creator<input name="creator"/></label><label>URL (optional)<input type="url" name="url"/></label><label>Notes<textarea name="notes"/></label><button>Save source</button></form></details></section></>}</V2Shell>;
}
