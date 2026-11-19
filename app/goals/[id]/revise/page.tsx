import {notFound, redirect} from "next/navigation";
import {answerTurn, confirm, discard, enough, fixDraft, resumeRevision, startRevise} from "../../actions";
import {loadState, pendingRevision} from "@/lib/v2/interview";
import {currentBrief} from "@/lib/v2/brief";
import {goalDetail} from "@/lib/v2/goals";
import {V2Shell} from "@/components/v2/shell";
import {GoalName, Head} from "@/components/v2/ui";
import {Interview} from "@/components/v2/interview";
import {DraftView} from "@/components/v2/draft-view";
import {Submit, Working} from "@/components/v2/pending";

export default async function Revise({params, searchParams}: PageProps<"/goals/[id]/revise">) {
  const {id} = await params, q = await searchParams, d = goalDetail(id);
  if (!d) notFound();
  const step = typeof q.step === "string" ? q.step : "", r = step ? loadState(step) : null;
  const back = {href: `/goals/${id}`, label: d.goal.name};
  const pending = pendingRevision(id);
  if (!r) return <V2Shell active="Goals" hue={d.goal.hue} goal={id}><div className="page page--read">
    <Head back={back} eyebrow={<GoalName name={d.goal.name} hue={d.goal.hue} />} title="Revise this goal" lede="Tell me what changed: you got further than expected, your time shrank, you want a different direction, or you just want to adjust. I will ask only what I need, then show the new version before anything changes." />
    {pending && <form action={resumeRevision.bind(null, id)} className="form-note"><span>You have an unfinished revision. </span><button className="btn btn--text">Continue it</button></form>}
    <form action={startRevise.bind(null, id)} className="form">
      <label className="field"><span className="sr">What changed</span><textarea name="text" rows={8} required autoFocus defaultValue={typeof q.text === "string" ? q.text : ""} placeholder="I can now play C, F, G and Am cleanly, so the first month is done. I would also like to add transposing, and I only have 20 minutes on weekdays now." /></label>
      {q.short && <p className="form-note" role="alert">Say a little more so I know what to change.</p>}
      {q.failed && <p className="form-note" role="alert">The Guide could not start just now. Try again.</p>}
      <div className="actions"><Submit pending="Reading…">Continue</Submit></div><p className="muted small">The old plan, your history and your evidence are never deleted.</p><Working>Reading what you wrote…</Working>
    </form></div></V2Shell>;
  if (r.state.kind !== "revise" || r.state.goal !== id) notFound();
  if (r.status === "accepted") redirect(`/goals/${id}`);
  if (r.status !== "pending") redirect(`/goals/${id}/revise`);
  const s = r.state;
  return <V2Shell active="Goals" hue={d.goal.hue} goal={id}><div className="page page--read">
    {s.draft ? <><Head back={back} eyebrow={<GoalName name={d.goal.name} hue={d.goal.hue} />} title="Here is the revised goal" lede="Check the new version. Nothing changes until you confirm." />
      <DraftView draft={s.draft} current={currentBrief(id)} confirm={confirm.bind(null, step)} fix={fixDraft.bind(null, step)} discard={discard.bind(null, step)} confirmLabel="Apply this revision" fixed={!!q.fixed} basic={s.basic} /></>
    : s.question ? <><Head back={back} title="One more thing" />
      <Interview turns={s.turns} question={s.question} answer={answerTurn.bind(null, step)} enough={enough.bind(null, step)} empty={!!q.empty} failed={!!q.failed} count={s.turns.length} /></> : null}
  </div></V2Shell>;
}
