import Link from "next/link";
import {notFound} from "next/navigation";
import {getJourneyView} from "@/lib/db/queries";
import {sqlite} from "@/lib/db/client";
import {Button} from "@/components/ui/button";
import {Mark} from "@/components/marks/mark";
import {addNote,weeklyReview} from "./actions";
export default async function Journal({params,searchParams}:PageProps<"/j/[id]/journal">) {
 const {id}=await params,query=await searchParams,view=await getJourneyView(id);
 if(!view)notFound();
 const root=`/j/${id}`;
 const reviews=sqlite.prepare("SELECT id,period_start,body_json FROM review WHERE journey_id=? ORDER BY period_start DESC").all(id) as {id:string;period_start:string;body_json:string}[];
 const events=sqlite.prepare("SELECT v.entry_id,s.name,v.level_after,v.delta FROM skill_event v JOIN skill s ON s.id=v.skill_id WHERE s.journey_id=?").all(id) as {entry_id:string;name:string;level_after:number;delta:number}[];
 const statuses=new Map((sqlite.prepare("SELECT e.id,x.status FROM log_entry e JOIN log_extraction x ON x.entry_id=e.id WHERE e.journey_id=?").all(id) as {id:string;status:string}[]).map(row=>[row.id,row.status]));
 const detail=view.entries.find(entry=>entry.id===query.entry);
 return <main className="journey onboarding journal"><Link className="back-link" href={root}>← {view.journey.name}</Link><h1>Journal</h1><nav className="cluster"><Link className="text-link" href={`${root}/journal`}>Entries</Link><Link className="text-link" href={`${root}/journal?tab=reviews`}>Reviews</Link></nav>
 {query.tab==="reviews"?<><form action={weeklyReview.bind(null,id)}><Button>Review this week</Button></form>{reviews.map(r=><section key={r.id}><small>{r.period_start}</small><h2><Link href={`${root}/review/${r.id}`}>{JSON.parse(r.body_json).headline}</Link></h2></section>)}</>:
 <>{!view.entries.length&&<><h2>Nothing here yet.</h2><p>Your entries will appear here.</p><Link className="text-link" href={`${root}/log`}>Write an entry</Link></>}
 {(detail?[detail]:view.entries).map((e,index,rows)=><section className="journal-entry" key={e.id}>{rows[index-1]?.occurredOn!==e.occurredOn&&<h2>{e.occurredOn}</h2>}<small>{e.kind}{e.minutes!==null?` · ${e.minutes} min`:""}</small><p className="reading">{e.rawText}</p>
 {events.filter(v=>v.entry_id===e.id&&v.delta).map(v=><p key={v.name}><Mark>{v.name} {v.level_after-v.delta} to {v.level_after}</Mark></p>)}
 {statuses.get(e.id)==="failed"&&<p>Couldn’t read this one yet. <Link className="text-link" href={`${root}/log?entry=${e.id}`}>Try again</Link></p>}
 {detail?<>{statuses.has(e.id)&&<Link className="text-link" href={`${root}/log?entry=${e.id}`}>View entry review</Link>}<form action={addNote.bind(null,id,e.id)}><label>Add a note<textarea name="note" maxLength={8000} required/></label><Button>Save note</Button></form></>:<Link className="text-link" href={`${root}/journal?entry=${e.id}`}>View entry</Link>}</section>)}</>}</main>;
}
