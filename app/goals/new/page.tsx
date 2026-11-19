import {startNew} from "../actions";
import {V2Shell} from "@/components/v2/shell";
import {Head} from "@/components/v2/ui";
import {Submit, Working} from "@/components/v2/pending";

export default async function NewGoal({searchParams}: PageProps<"/goals/new">) {
  const q = await searchParams;
  return <V2Shell active="Goals"><div className="page page--read">
    <Head back={{href: "/goals", label: "Goals"}} title="What do you want to learn?" lede="Start in your own words, as short or as long as you like. If you already wrote a detailed brief somewhere else, paste it. I will ask what I need to know, one question at a time." />
    <form action={startNew} className="form">
      <label className="field"><span className="sr">What you want to learn</span><textarea name="text" rows={9} required autoFocus placeholder="I want to play piano well enough to sing and accompany myself at my sister’s wedding next April…" /></label>
      {q.short && <p className="form-note" role="alert">Say a little more so I know where to start.</p>}
      {q.failed && <p className="form-note" role="alert">The Guide could not start just now. Your words are still in the box above, try again.</p>}
      <div className="actions"><Submit pending="Reading…">Start</Submit></div>
      <p className="muted small">Nothing becomes a goal until you have seen it and said yes.</p>
      <Working>Reading what you wrote…</Working>
    </form></div></V2Shell>;
}
