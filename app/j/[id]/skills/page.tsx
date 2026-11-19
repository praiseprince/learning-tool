import Link from "next/link";
import { notFound } from "next/navigation";
import { getJourneyView } from "@/lib/db/queries";
import { sqlite } from "@/lib/db/client";
import { SkillRow } from "@/components/marks/skill-stroke";
import { ReviewSheet } from "@/components/features/review-sheet";
import { Button } from "@/components/ui/button";
import {saveSkill} from "./actions";
export default async function Skills({ params,searchParams }: PageProps<"/j/[id]/skills">) {
 const {id}=await params,view=await getJourneyView(id),query=await searchParams;
 if(!view)notFound();
 const root=`/j/${id}/skills`,now=new Date().getTime();
 const events=sqlite.prepare("SELECT v.* FROM skill_event v JOIN skill s ON s.id=v.skill_id WHERE s.journey_id=? ORDER BY v.at").all(id) as {id:string;skill_id:string;entry_id:string;at:string;level_after:number;delta:number;evidence_quote:string}[];
 const skills=view.skills.filter(s=>!s.archived).map(skill=>{
   const history=events.filter(e=>e.skill_id===skill.id);
   const weight=history.filter(e=>e.entry_id).reduce((sum,e)=>sum+Math.exp(-Math.max(0,now-Date.parse(e.at))/86400000/21),0)/3;
   const evidence=weight<0.35?"penciled" as const:weight<0.7?"building" as const:"inked" as const;
   const moved=history.some(e=>e.delta && e.at>(view.journey.lastSeenAt||view.journey.createdAt));
   return {...skill,history,evidence,moved};
 });
 const selected=skills.find(s=>s.id===query.skill);
 return <main className="journey" style={{"--hue":view.journey.hue} as React.CSSProperties}><Link className="back-link" href={`/j/${id}`}>Home</Link><h1>Skills</h1>
 <p className="reading">{skills.length} skills, {skills.filter(s=>s.moved).length} moved since you last looked.</p>
 {skills.map(skill=><Link key={skill.id} href={`${root}?skill=${skill.id}`} className="skill-link"><SkillRow name={skill.name} level={skill.level} evidence={skill.evidence} moved={skill.moved}/></Link>)}
 <Link className="text-link" href={`${root}?new=1`}>Add a skill</Link>
 {(selected || query.new==="1")&&<ReviewSheet home={root}><h2>{selected?.name||"Add a skill"}</h2>
 {selected&&<><p>{selected.evidence==="penciled"?"Penciled in":selected.evidence==="building"?"Building":"Inked"}. {new Set(selected.history.filter(e=>e.entry_id&&now-Date.parse(e.at)<=30*86400000).map(e=>e.entry_id)).size} entries in the last 30 days.</p>
 {selected.history.length>0&&<svg className="sparkline" viewBox="0 0 180 36" role="img" aria-label="Recorded skill levels"><path d={selected.history.map((e,i)=>`${i?"L":"M"}${4+i*172/Math.max(1,selected.history.length-1)} ${32-e.level_after*5}`).join(" ")}/></svg>}
 {selected.history.filter(e=>e.entry_id).slice(-5).reverse().map(e=><p key={e.id} className="reading-small"><Link href={`/j/${id}/journal?entry=${e.entry_id}`}>{e.at.slice(0,10)}</Link> · {e.evidence_quote}</p>)}</>}
 <form className="review-form" action={saveSkill.bind(null,id,selected?.id??null)}><label>Name <input name="name" required maxLength={100} defaultValue={selected?.name}/></label>
 <fieldset><legend>Level</legend><div className="cluster">{[0,1,2,3,4,5].map(n=><label key={n}><input type="radio" name="level" value={n} defaultChecked={n===(selected?.level??0)}/>{n}</label>)}</div></fieldset>
 <label>Notes<textarea name="note" maxLength={1000} defaultValue={selected?.description??""}/></label><Button>Save skill</Button>{selected&&<Button variant="ghost" name="intent" value="archive">Archive skill</Button>}</form></ReviewSheet>}</main>;
}
