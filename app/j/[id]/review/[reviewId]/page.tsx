import Link from "next/link";
import {notFound} from "next/navigation";
import {sqlite} from "@/lib/db/client";
import {reviewBody} from "@/lib/db/reviews";
import {resolveChange} from "../../journal/actions";
import {Button} from "@/components/ui/button";
export default async function Review({params}:PageProps<"/j/[id]/review/[reviewId]">) {
 const {id,reviewId}=await params;
 const row=sqlite.prepare("SELECT * FROM review WHERE id=? AND journey_id=?").get(reviewId,id) as {period_start:string;period_end:string;body_json:string}|undefined;
 if(!row)notFound();
 const json=JSON.parse(row.body_json);
 const body=reviewBody.parse(json);
 const changes=sqlite.prepare("SELECT id,diff_json,status FROM proposal WHERE source_ref=? AND journey_id=? AND kind='charter'").all(reviewId,id) as {id:string;diff_json:string;status:string}[];
 return <main className="journey onboarding"><Link className="back-link" href={`/j/${id}/journal?tab=reviews`}>← Journal</Link>
 <small>{row.period_start} to {row.period_end}</small><h1>{body.headline}</h1><div className="review-totals">{[["Planned",json.planned],["Actual",json.actual]].map(([label,minutes])=><div key={label}><span>{label}</span><i className={label==="Actual"?"actual":"planned"} style={{width:`${100*minutes/Math.max(1,json.actual,json.planned)}%`}}/><small>{minutes} min</small></div>)}</div>
 {body.insights.map((item,i)=><p className="reading" key={i}><strong>{item.title}. </strong>{item.text}</p>)}
 {changes.length>0&&<h2>Suggested changes</h2>}{changes.map(row=>{const change=reviewBody.shape.suggestions.element.parse(JSON.parse(row.diff_json));return <section key={row.id}><p>{change.reason}</p>{row.status==="pending"?<form action={resolveChange.bind(null,id,reviewId,row.id)}><label>{change.field}<textarea name="value" defaultValue={change.value} required maxLength={300}/></label><div className="cluster"><Button>Accept</Button><Button variant="ghost" name="intent" value="dismiss" formNoValidate>Dismiss</Button></div></form>:<small>{row.status}</small>}</section>})}</main>;
}
