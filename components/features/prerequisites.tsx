import Link from "next/link";

type Node={id:string;name:string;prereqIds:string};
export function prerequisites(json:string) {
  try { const ids:unknown=JSON.parse(json);return Array.isArray(ids)?ids.filter((id):id is string=>typeof id==="string"):[]; }
  catch {return [];}
}
export function Prerequisites({skills,root}:{skills:Node[];root:string}) {
 const map=new Map(skills.map(skill=>[skill.id,skill]));
 const linked=skills.map(skill=>({skill,parents:prerequisites(skill.prereqIds).map(id=>map.get(id)).filter((s):s is Node=>!!s)})).filter(row=>row.parents.length);
 return <section><h2>Prerequisites</h2>{linked.length===0?<p className="reading">No prerequisites yet. Open a skill to choose what comes before it.</p>:linked.map(({skill,parents})=><div className="prereq-row" key={skill.id}><div>{parents.map(p=><Link className="text-link" key={p.id} href={`${root}?skill=${p.id}`}>{p.name}</Link>)}</div><span aria-label="before">→</span><Link className="text-link" href={`${root}?skill=${skill.id}`}>{skill.name}</Link></div>)}</section>;
}
