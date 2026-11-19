import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {randomUUID} from "node:crypto";
import {sqlite} from "@/lib/db/client";
import {getJourneyView} from "@/lib/db/queries";
import {Button} from "@/components/ui/button";
import {ReviewSheet} from "@/components/features/review-sheet";
const fields=[
 ["goal","What you want"],["why","Why it matters"],["done_looks_like","What done looks like"],
 ["deadline","By when"],["constraints","Limits"],["starting_point","Where you started"]
] as const;
type Version={id:string;version:number;created_at:string}&Record<typeof fields[number][0],string|null>;
export default async function Goal({params,searchParams}:PageProps<"/j/[id]/goal">) {
 const {id}=await params,query=await searchParams,view=await getJourneyView(id);
 if(!view)notFound();
 const versions=sqlite.prepare("SELECT * FROM charter WHERE journey_id=? ORDER BY version DESC").all(id) as Version[];
 const current=versions[0];
 if(!current)notFound();
 const display=versions.find(v=>v.id===query.version)??current;
 const root=`/j/${id}/goal`;
 async function save(data:FormData) {
  "use server";
  sqlite.transaction(()=>{
   const latest=sqlite.prepare("SELECT * FROM charter WHERE journey_id=? ORDER BY version DESC LIMIT 1").get(id) as Version;
   const restore=data.get("restore");
   const source=restore?sqlite.prepare("SELECT * FROM charter WHERE journey_id=? AND id=?").get(id,String(restore)) as Version:latest;
   if(!source)throw Error("Version unavailable.");
   const field=data.get("field");
   const value=String(data.get("value")??"").trim();
   if(!restore && (!fields.some(([key])=>key===field)||value.length>2000||(!value&&["goal","why","done_looks_like"].includes(String(field)))))throw Error("Check the goal text.");
   const values=fields.map(([key])=>!restore&&key===field?value:source[key]);
   sqlite.prepare("INSERT INTO charter(id,journey_id,version,goal,why,done_looks_like,deadline,constraints,starting_point,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(randomUUID(),id,latest.version+1,...values,restore?`Restored version ${source.version}`:"Edited goal",new Date().toISOString());
  })();
  redirect(root);
 }
 async function changeStatus(data:FormData) {
  "use server";
  const status=data.get("status");
  if(status!=="paused" && status!=="archived")throw Error("Unknown status.");
  sqlite.prepare("UPDATE journey SET status=? WHERE id=?").run(status,id);redirect("/");
 }
 return <main className="journey document onboarding"><Link href={`/j/${id}`} className="back-link">Home</Link><h1>Goal</h1>
 {fields.map(([key,label])=><section key={key}><h2>{label}</h2>{display.id===current.id?<details><summary className="reading">{display[key]||"Add a detail"}</summary><form action={save}><input type="hidden" name="field" value={key}/><label>{label}<textarea name="value" maxLength={2000} defaultValue={display[key]??""}/></label><Button>Save change</Button></form></details>:<p className="reading">{display[key]||"—"}</p>}</section>)}
 <small>Version {display.version}, edited {display.created_at.slice(0,10)}</small>
 {display.id!==current.id&&<form action={save}><Button name="restore" value={display.id}>Restore this version</Button></form>}
 <nav className="cluster"><Link className="text-link" href={`${root}?history=1`}>Version history</Link><Link className="text-link" href={`${root}?confirm=paused`}>Pause journey</Link><Link className="text-link" href={`${root}?confirm=archived`}>Archive journey</Link></nav>
 {query.history==="1"&&<ReviewSheet home={root}><h2>Version history</h2>{versions.map(v=><p key={v.id}><Link className="text-link" href={`${root}?version=${v.id}`}>Version {v.version} · {v.created_at.slice(0,10)}</Link></p>)}</ReviewSheet>}
 {(query.confirm==="paused"||query.confirm==="archived")&&<ReviewSheet home={root}><h2>{query.confirm==="paused"?"Pause":"Archive"} {view.journey.name}?</h2><p>Your entries stay in your journal.</p><form action={changeStatus}><Button name="status" value={query.confirm}>Confirm</Button></form></ReviewSheet>}</main>;
}
