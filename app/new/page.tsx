import Link from "next/link";
import {randomUUID} from "node:crypto";
import {notFound,redirect} from "next/navigation";
import {advanceInterview} from "@/app/actions";
import {initialInterview,loadInterview} from "@/lib/db/interview";
import {JOURNEY_HUES} from "@/lib/constants";
import {Button} from "@/components/ui/button";
import {ClearSavedAnswer,InterviewAnswer} from "./response";
export default async function NewNotebook({searchParams}:PageProps<"/new">) {
  const query=await searchParams;
  const id=typeof query.draft==="string"?query.draft:randomUUID();
  const saved=loadInterview(id);
  if(query.draft&&!saved)notFound();
  if(saved?.completed)redirect(`/j/${id}`);
  const state=saved?.state??initialInterview();
  const goal=state.stage==="goal",confirm=state.stage==="confirm",review=state.stage==="review";
  const revision=saved?.revision??0;
  const lastAnswer=state.turns.at(-1);
  return <main className="onboarding interview"><Link href="/" className="back-link">← Your learning</Link>
    {lastAnswer?.inputKey && <ClearSavedAnswer storageKey={lastAnswer.inputKey} answer={lastAnswer.answer}/>}
    <p className="kicker">{goal||confirm?"Your goal":"Your starting point"}</p>
    <h1>{confirm?"Does this capture your goal?":review?"Review your starting point":state.pending?"Your answer is saved":state.question}</h1>
    <form key={revision} action={advanceInterview.bind(null,id,revision)}>
    {confirm?<><label>Notebook title<input required name="title" defaultValue={state.title} maxLength={100}/></label>
      <label>What you want to do<textarea required name="goal" defaultValue={state.goal}/></label><label>How you’ll recognize success<textarea required name="criterion" defaultValue={state.criterion}/></label><Button>Confirm goal</Button></>:
    review?<><p className="reading-small">{state.source}{state.skill&&state.level!==null?` · ${state.skill}, level ${state.level} of 5`:""}</p>{state.evidence&&<blockquote className="reading">{state.evidence}</blockquote>}
      <label>Starting point<textarea required name="summary" defaultValue={state.summary || "Starting level not yet assessed."}/></label>{state.skill&&<label>Skill level<select name="level" defaultValue={state.level??""}><option value="">Unassessed</option>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
      <fieldset><legend>Notebook highlighter</legend><div className="cluster">{JOURNEY_HUES.map((hue,index)=><label className="interview-hue" key={hue} style={{"--swatch":hue} as React.CSSProperties}><input type="radio" name="hue" value={hue} defaultChecked={index===0} aria-label={["Yellow","Rose","Green","Blue","Orange","Violet"][index]}/></label>)}</div></fieldset>
      <Button>Confirm and open notebook</Button></>:
    <>{state.pending?<><p className="reading">{query.retry?"The interview couldn’t continue. Your answer is saved.":"Continue from your last answer."}</p><Button>Try again</Button></>:<InterviewAnswer storageKey={`interview-${saved?id:"new"}-${revision}`}/>}
      {!goal&&<Button variant="ghost" name="intent" value="skip" formNoValidate>Skip assessment for now</Button>}</>}
    </form>
    {state.goal&&!confirm&&<section><h2>{goal?"Goal so far":"Confirmed goal"}</h2><p className="reading">{state.goal}</p>{state.criterion&&<p className="reading-small">{state.criterion}</p>}</section>}
    {state.turns.length>0&&<details><summary>Interview notes</summary>{state.turns.map((turn,i)=><div key={i}><h3>{turn.question}</h3><p className="reading">{turn.answer}</p></div>)}</details>}
  </main>;
}
