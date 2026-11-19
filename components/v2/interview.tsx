import {Submit, Working} from "./pending";
import type {Turn} from "@/lib/v2/interview";

/** The chat-style interview: what was asked and answered so far, then the next question and one big answer box. */
export function Interview({turns, question, answer, enough, empty, failed, count}: {
  turns: Turn[]; question: {q: string; why: string}; answer: (d: FormData) => void | Promise<void>; enough: () => void | Promise<void>; empty?: boolean; failed?: boolean; count: number;
}) {
  return <div className="stack stack--lg">
    {turns.length > 0 && <ol className="talk" aria-label="So far">{turns.map((t, i) => <li key={i}><p className="q">{t.q}</p><p className="a prose">{t.a}</p></li>)}</ol>}
    <form action={answer} className="form ask-next">
      <div className="stack"><p className="eyebrow num">Question {count}</p><h2 className="q-now">{question.q}</h2>{question.why && <p className="muted small">{question.why}</p>}</div>
      <label className="field"><span className="sr">Your answer</span><textarea name="text" rows={6} required autoFocus placeholder="Answer in your own words. Detail helps." /></label>
      {empty && <p className="form-note" role="alert">Write an answer first.</p>}
      {failed && <p className="form-note" role="alert">The Guide could not answer just now. Your words are safe. Try again.</p>}
      <div className="actions"><Submit pending="Thinking…">Answer</Submit><Submit className="btn btn--quiet" pending="Drafting…" formNoValidate formAction={enough}>That’s enough, draft my goal</Submit></div>
      <p className="muted small">Take your time. Long answers are better than short ones.</p>
      <Working>Reading what you wrote…</Working>
    </form>
  </div>;
}
