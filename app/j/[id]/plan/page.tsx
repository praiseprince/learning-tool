import { preferences } from "@/lib/db/personal";
import { PlanPreferences } from "@/components/features/plan-preferences";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJourney } from "@/lib/db/queries";
import { findPlan } from "@/lib/db/plans";
import { generatePlan, beginFocus } from "./actions";
import { Button } from "@/components/ui/button";

export default async function PlanPage({params,searchParams}:PageProps<"/j/[id]/plan">) {
  const {id}=await params;
  const journey=await getJourney(id);
  if (!journey) notFound();
  const query=await searchParams;
  const plan=findPlan(id,query.plan);
  const minutes=plan?.blocks.reduce((sum,b)=>sum+b.minutes,0) ?? Number(query.minutes || preferences().minutes);
  return <main className="onboarding"><Link href={`/j/${id}`} className="back-link">← {journey.name}</Link>
    <h1>{plan?.title || "Plan today"}</h1>
    {plan && <><p className="reading">{plan.why}</p>{plan.blocks.map((block,i)=><section key={i}><h2>{block.title} <small>{block.minutes} min</small></h2><p className="reading">{block.instructions}</p></section>)}
    <form action={beginFocus.bind(null,id,plan.id)}><Button>Start session</Button></form></>}
    <form action={generatePlan.bind(null,id)}>
      {plan ? <><input type="hidden" name="minutes" value={minutes}/><div className="cluster">{["Make it easier","Shorter","Different focus"].map(label=><button className="chip" key={label} name="refinement" value={label}>{label}</button>)}</div></> :
      <><PlanPreferences initial={minutes}/>
      <label>Anything the plan should know?<textarea name="note" maxLength={1000}/></label><Button>Plan my session</Button></>}
    </form></main>;
}
