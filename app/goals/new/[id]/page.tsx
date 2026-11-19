import {notFound, redirect} from "next/navigation";
import {answerTurn, confirm, discard, enough, fixDraft} from "../../actions";
import {loadState} from "@/lib/v2/interview";
import {V2Shell} from "@/components/v2/shell";
import {Head} from "@/components/v2/ui";
import {Interview} from "@/components/v2/interview";
import {DraftView} from "@/components/v2/draft-view";

export default async function NewGoalStep({params, searchParams}: PageProps<"/goals/new/[id]">) {
  const {id} = await params, q = await searchParams, r = loadState(id);
  if (!r || r.state.kind !== "new") notFound();
  if (r.status === "accepted") redirect(`/goals/${id}`);
  if (r.status !== "pending") redirect("/goals/new");
  const s = r.state;
  return <V2Shell active="Goals"><div className="page page--read">
    {s.draft ? <><Head back={{href: "/goals", label: "Goals"}} title="Is this right?" lede="This is what I understood from our conversation." />
      <DraftView draft={s.draft} confirm={confirm.bind(null, id)} fix={fixDraft.bind(null, id)} discard={discard.bind(null, id)} confirmLabel="Create this goal" fixed={!!q.fixed} basic={s.basic} /></>
    : s.question ? <><Head back={{href: "/goals", label: "Goals"}} title="Tell me more" />
      <Interview turns={s.turns} question={s.question} answer={answerTurn.bind(null, id)} enough={enough.bind(null, id)} empty={!!q.empty} failed={!!q.failed} count={s.turns.length} /></> : null}
  </div></V2Shell>;
}
