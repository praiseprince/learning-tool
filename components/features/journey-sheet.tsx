import Link from "next/link";
import {differenceInCalendarDays,parseISO} from "date-fns";
import {sqlite} from "@/lib/db/client";
import {ReviewSheet} from "./review-sheet";
export function JourneySheet({journey}:{journey:string}) {
 const rows=sqlite.prepare("SELECT id,name,hue,status,start_date FROM journey ORDER BY created_at DESC").all() as {id:string;name:string;hue:number;status:string;start_date:string}[];
 return <ReviewSheet home={`/j/${journey}`}><h2>Journeys</h2>{["active","paused"].map(group=><div key={group}>{group==="paused"&&rows.some(r=>r.status!=="active")&&<h3>Paused</h3>}{rows.filter(r=>group==="active"?r.status==="active":r.status!=="active").map(r=><p key={r.id}><Link className="journey-pill" href={`/j/${r.id}`} style={{"--hue":r.hue} as React.CSSProperties}><i/>{r.name} · Day {Math.max(1,differenceInCalendarDays(new Date(),parseISO(r.start_date))+1)} {r.id===journey?"✓":""}</Link></p>)}</div>)}<nav className="cluster"><Link className="text-link" href={`/j/${journey}/goal`}>Goal</Link><Link className="text-link" href="/new">New journey</Link></nav></ReviewSheet>;
}
