// Demo data on the live AI: five real goals, three weeks of history, notes, then live Guide runs.
// Run from the repo root on an EMPTY database: DATABASE_URL=file:./data/app.db npx tsx scripts/seed-live-demo.mts  (uses the live AI; takes 10–20 minutes)
import {randomUUID} from "node:crypto";
import {format, subDays} from "date-fns";
import {sqlite} from "../lib/db/client.ts";
import {analyzeBrief, createGoal} from "../lib/v2/brief.ts";
import {storeDocument} from "../lib/v2/notebook.ts";
import {addEvent} from "../lib/chat/events.ts";
import {startJob, getJob} from "../lib/agent/jobs.ts";
import {accept, pending} from "../lib/agent/accept.ts";
import {acceptWeek} from "../lib/agent/week.ts";

// Pass goal ids to (re)build only those, e.g. after a failed run: npx tsx scripts/seed-live-demo.mts guitar
const only = process.argv.slice(2);
const has = (id: string) => !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name='journey'").get() && !!sqlite.prepare("SELECT 1 FROM journey WHERE id=?").get(id);
if (process.env.AI_PROVIDER === "stub") throw Error("This needs the live AI.");

type Goal = {id: string; brief: string; logs: [number, number, string][]; notes: [string, string][]; jobs: [kind: "research" | "week" | "quiz" | "ask" | "practice", say: string, text: string][]};

const GOALS: Goal[] = [
  {id: "spanish", brief: `Title: Conversational Spanish for Mexico City
I want to hold a 20-minute conversation in Spanish with my partner's family when we visit Mexico City in June. Her grandmother speaks no English and I'd like to talk to her without my partner translating.
Where I am: two years of Spanish at school. I'm comfortable with the present tense, can order food, ask directions and talk about my job in simple sentences. The past tenses are shaky: I mix up the preterite and the imperfect. I freeze when people speak fast, and Mexican slang loses me.
What I use: Duolingo every day (140-day streak) and the book "Madrigal's Magic Key to Spanish" by Margarita Madrigal.
Done looks like: a 20-minute video call with a tutor entirely in Spanish, and following most of an episode of "Club de Cuervos" with Spanish subtitles.
Constraints: 30 minutes on weekday lunch breaks, an hour on Saturdays. Budget for at most one paid tutor session a week.`,
    logs: [[19, 30, "Duolingo plus Madrigal chapter on -ar verbs. Easy."], [17, 30, "Preterite of regular verbs. Wrote 10 sentences about last weekend."], [15, 25, "Tried a podcast (Español con Juan). Understood maybe 40%."], [12, 60, "Saturday: first italki trial lesson with Lucía. Talked about my job and family. Froze twice on past tense, she said my pronunciation is clear."], [10, 30, "Imperfect endings. Made a table comparing with preterite."], [8, 20, "Duolingo only, tired."], [5, 60, "Club de Cuervos ep 1 with Spanish subtitles, paused a lot. Wrote down 25 words, lots of slang (güey, neta, chido)."], [3, 30, "Preterite vs imperfect drills: 'cuando era niño...' stories. Getting better when I slow down."], [1, 35, "Shadowed a 5-minute dialogue about meeting someone's family. Practised 'mucho gusto, señora'."]],
    notes: [["Preterite vs imperfect", "## The rule of thumb\n\n- **Preterite**: completed actions with a clear start or end. *Ayer **comí** tacos.*\n- **Imperfect**: background, habits, descriptions, what *was happening*. *Cuando **era** niño, **comía** tacos los domingos.*\n\n## Together in one sentence\n\n*Mientras **leía** (background), **sonó** el teléfono (the event).*\n\n## Triggers\n\n| Preterite | Imperfect |\n|---|---|\n| ayer, anoche, el año pasado, de repente | siempre, todos los días, mientras, de niño |\n\n## My mistakes\n\n- I said *fui cansado*; it should be *estaba cansado* (a state, not an event).\n- *Conocí* = I met (once). *Conocía* = I knew (ongoing)."],
      ["Phrases for meeting the family", "## Greeting the grandmother (formal, *usted*)\n\n- *Mucho gusto, señora. Encantado de conocerla.*\n- *¿Cómo está usted?*\n- *Muchas gracias por recibirnos.*\n\n## Small talk\n\n- *Su casa es muy bonita.*\n- *¿Desde cuándo vive aquí?*\n- *La comida está riquísima.* (Mexico: *rica* is the normal compliment for food.)\n\n## When I'm lost\n\n- *¿Me lo puede repetir más despacio, por favor?*\n- *¿Cómo se dice ... ?*"]],
    jobs: [["research", "Find me good free listening material for Mexican Spanish at my level", "Free listening practice for Mexican Spanish at A2/B1, ideally podcasts or YouTube with transcripts."], ["ask", "How do I politely tell my partner's grandmother that I'm learning Spanish and ask her to speak slowly?", "How do I politely tell my partner's grandmother (formal usted, Mexico) that I'm learning Spanish and ask her to speak slowly? Give two or three natural options."], ["week", "Plan my week. I can do an hour on Saturday with my tutor.", "Saturday: one hour with my italki tutor. Weekdays 30 minutes at lunch."], ["quiz", "Quiz me", ""]]},

  {id: "linear-algebra", brief: `Title: Linear algebra for machine learning
I'm a backend developer moving towards machine learning. I want to really understand the linear algebra behind neural networks and PCA instead of copying numpy code.
Where I am: I did calculus at university eight years ago but never took linear algebra. I can multiply matrices by hand and know what a dot product is. I've watched the first four videos of 3Blue1Brown's "Essence of linear algebra" (vectors, linear combinations, linear transformations, matrix multiplication as composition).
What I use: Gilbert Strang's "Introduction to Linear Algebra" (5th edition), the 3Blue1Brown series, and Jupyter with numpy.
Done looks like: derive PCA from the eigendecomposition of the covariance matrix, implement it from scratch in numpy and check it against scikit-learn, and explain the SVD to a colleague with a picture.
Constraints: weekday evenings, about 45 minutes, four days a week. I'm tired after work, so visual explanations first, then the algebra.`,
    logs: [[20, 45, "3b1b ep 5 (determinants). The 'area scaling factor' idea clicked."], [18, 40, "Strang 2.1–2.2: elimination. Did 6 exercises, two wrong (sign errors)."], [16, 50, "Wrote numpy code to apply 2x2 matrices to a grid of points and plot it. Shear and rotation make sense now."], [13, 45, "3b1b ep 7: inverse, column space, rank, null space. Rank still fuzzy."], [11, 30, "Strang 3.1 column space. Tired, skimmed."], [9, 50, "Re-did rank: rank = dimension of column space = number of pivots. Checked with np.linalg.matrix_rank on 5 matrices."], [6, 45, "3b1b ep 9 dot products and duality. Hard. Watched twice."], [4, 55, "3b1b ep 14 eigenvectors. Computed eigenvectors of [[2,1],[1,2]] by hand: (1,1) with λ=3, (1,-1) with λ=1. numpy agrees."], [2, 40, "Started covariance matrices: centred a small dataset and computed XᵀX/(n-1) by hand."]],
    notes: [["Eigenvectors, intuitively", "An **eigenvector** of a matrix $A$ is a direction that $A$ only stretches, never turns:\n\n$$A\\mathbf{v} = \\lambda \\mathbf{v}$$\n\n$\\lambda$ is how much it stretches (negative means it flips).\n\n## Finding them\n\n$$\\det(A - \\lambda I) = 0$$\n\nFor $A = \\begin{pmatrix}2 & 1\\\\1 & 2\\end{pmatrix}$: $(2-\\lambda)^2 - 1 = 0$, so $\\lambda = 3$ or $\\lambda = 1$, with eigenvectors $(1,1)$ and $(1,-1)$.\n\n## Why it matters for PCA\n\nThe covariance matrix is symmetric, so its eigenvectors are orthogonal. The eigenvector with the largest eigenvalue is the direction the data varies most: the first principal component."],
      ["Matrix multiplication as composition", "$AB$ means *apply $B$ first, then $A$*. Read right to left, like function composition $f(g(x))$.\n\n- That's why $AB \\neq BA$ in general: rotating then shearing is not shearing then rotating.\n- Columns of $A$ are where the basis vectors land.\n\n```python\nimport numpy as np\nR = np.array([[0, -1], [1, 0]])  # rotate 90°\nS = np.array([[1, 1], [0, 1]])   # shear\nprint(S @ R, R @ S)  # different\n```"]],
    jobs: [["research", "Find materials for eigenvectors and PCA that start visual", "Visual-first explanations of eigenvectors, covariance and PCA, then a rigorous treatment. Free if possible."], ["practice", "Make me a practice sheet on eigenvalues and covariance", "Practice sheet: eigenvalues/eigenvectors by hand for 2x2 and 3x3 symmetric matrices, then covariance matrix of a tiny dataset, with numpy checks and answers."], ["week", "Plan my week", "Four evenings, 45 minutes each."], ["quiz", "Quiz me", ""]]},

  {id: "half-marathon", brief: `Title: Run a half marathon under 2 hours
I want to run the Brighton Half Marathon in February in under 2 hours (about 5:41 per km).
Where I am: I ran my first 10K in 58:40 in September. I run three times a week, about 25 km in total; my longest run is 12 km. Last year I got shin splints when I increased mileage too fast, so I'm careful now.
What I use: Strava and a Garmin Forerunner 55.
Done looks like: finishing the half in under 2:00 without injury.
Constraints: I can run Tuesday and Thursday evenings and Sunday mornings, sometimes Saturday. Gym with a treadmill if it's icy.`,
    logs: [[20, 35, "Easy 6 km, 6:25/km, HR mostly zone 2."], [18, 45, "Intervals 6×800m at 5:15/km, 90s jog recovery. Last two were hard."], [15, 75, "Long run 12 km at 6:20/km. Legs fine, slight left shin tightness after."], [13, 35, "Easy 6 km. Shin OK."], [11, 50, "Tempo: 2 km warm-up, 4 km at 5:40/km, 1 km cool-down. Race pace feels sustainable for now."], [8, 80, "Long run 13 km at 6:15/km. Took a gel at 50 min."], [6, 35, "Easy 6 km plus 15 min calf raises and tibialis raises."], [4, 50, "Intervals 5×1 km at 5:20/km. Strong."], [1, 85, "Long run 14 km, 6:12/km. Longest ever. Tired last 2 km but no pain."]],
    notes: [["Paces for sub-2:00", "| Run | Pace per km | Feel |\n|---|---|---|\n| Easy / long | 6:10–6:40 | can hold a conversation |\n| Tempo | 5:35–5:45 | comfortably hard |\n| Race pace | 5:40 | |\n| Intervals | 5:10–5:20 | hard, controlled |\n\n- Roughly 80% of weekly running should be easy.\n- Increase weekly distance by about 10% at most, with an easier week every 3–4 weeks."],
      ["Shin splints: what I changed", "Last year: went from 15 to 30 km a week in a month and got pain on the inside of both shins.\n\nThis time:\n\n- Max 10% more per week, cut-back week every fourth week.\n- Calf raises and tibialis raises 3×15 after easy runs.\n- Shorter, quicker steps (cadence ~170).\n- Replace shoes around 600 km."]],
    jobs: [["research", "Find me a good sub-2:00 half marathon plan and strength routine", "A credible 12-week sub-2:00 half marathon plan for 3-4 runs a week, plus a runner's strength routine for shin splint prevention."], ["week", "Plan my week. Tuesday, Thursday and Sunday as usual.", "Runs Tuesday and Thursday evenings, long run Sunday morning. Optional strength on Saturday."], ["quiz", "Quiz me", ""]]},

  {id: "guitar", brief: `Title: Fingerstyle guitar: play Blackbird
I've strummed open chords on acoustic guitar for three years. I want to learn fingerstyle: play "Blackbird" by the Beatles cleanly at full tempo (about 94 bpm), and use Travis picking to accompany songs.
Where I am: open chords are solid; the barre F still buzzes. My thumb isn't independent yet: when I add melody notes with my fingers, the thumb stops keeping the bass going.
What I use: the Justin Guitar app and a metronome app.
Done looks like: recording Blackbird from start to finish without stopping, and playing the intro of "Dust in the Wind" by Kansas.
Constraints: 20 minutes most evenings. I live in a flat, so quiet playing after 9 pm.`,
    logs: [[19, 20, "Thumb-only alternating bass on C, G, Am. 60 bpm."], [17, 20, "Added index finger on beat 2 and 4. Thumb kept stopping."], [14, 25, "Travis pattern on C at 60 bpm, almost steady. Recorded it, slightly rushed."], [12, 20, "Blackbird bars 1–4 (the G to Am7 to G/B walk). Slow."], [10, 15, "Barre F practice only. Still buzz on the B string."], [7, 25, "Travis on C–Am–F(easy)–G at 70 bpm. Felt automatic for the first time."], [5, 20, "Blackbird bars 5–10, the chromatic section. Fingers get tangled at the 10th fret shape."], [2, 25, "Blackbird first verse at 60 bpm with metronome, 3 clean takes out of 5."]],
    notes: [["Travis picking pattern", "Thumb alternates bass strings on every beat, fingers fill in between.\n\n```\nBeat:   1  &  2  &  3  &  4  &\nThumb:  5     4     5     4      (on C: A string, D string)\nFinger:    3     2     3     2\n```\n\n- Get the thumb automatic first: count out loud, tap your foot.\n- Then add one finger note per bar, then more.\n- Start at 60 bpm; move up 4 bpm only after three clean passes."],
      ["Blackbird: sections and fingering", "- **Intro / verse A** (bars 1–10): G, Am7, G/B, then the walk up the neck. Thumb and middle finger pluck together, index on the 3rd string in between.\n- **'Blackbird singing...'** the chromatic descent from the 10th fret. Keep the 3rd string open as a drone.\n- **Bridge** ('Blackbird fly'): F, Em, Dm, C, descending.\n\nTrouble spots: the shift at bar 7, and keeping the open G ringing through the descent."]],
    jobs: [["research", "Find me a good Blackbird lesson and Travis picking exercises", "A trustworthy Blackbird fingerstyle lesson (video or tab) and a progressive Travis picking exercise set for beginners."], ["week", "Plan my week, 20 minutes a night", "20 minutes most evenings, quiet after 9 pm."], ["quiz", "Quiz me", ""]]},

  {id: "rome", brief: `Title: Why the Roman Republic fell
I want to understand why the Roman Republic collapsed, from the Gracchi to Augustus (133 to 27 BC), well enough to write a 2,000-word essay arguing which cause mattered most.
Where I am: I've listened to the first 20 episodes of Mike Duncan's "The History of Rome" podcast and read Tom Holland's "Rubicon" years ago, but the details are hazy. I'm now reading Mary Beard's "SPQR", on chapter 6. I don't read Latin.
Done looks like: a timeline from memory of the key events with dates, and the essay.
Constraints: I read on my commute, about 40 minutes a day; weekends for writing.`,
    logs: [[20, 40, "SPQR ch. 5 (Rome's wider world). Notes on the Punic Wars' effect on land."], [17, 40, "SPQR ch. 6 start: Tiberius Gracchus, the land bill, his death in 133."], [15, 45, "History of Rome podcast eps on Gaius Gracchus. Grain law, the equites in the courts."], [12, 40, "SPQR ch. 6: Marius, Jugurtha, the army reforms. Beard is sceptical that the 'Marian reforms' were one big change."], [10, 30, "Made a timeline 133–88 BC from memory, then checked. Got the Social War date wrong (91–88)."], [7, 40, "Sulla's march on Rome (88) and dictatorship. Precedent of using an army against the city."], [3, 90, "Saturday: wrote a 400-word draft paragraph on land and the army. Weak on evidence."], [1, 40, "SPQR ch. 7 start: Pompey and Crassus."]],
    notes: [["Tiberius Gracchus and the land bill (133 BC)", "- **Problem**: public land (*ager publicus*) occupied by the rich; small farmers squeezed out while serving long campaigns.\n- **The bill**: enforce the old limit of 500 *iugera* per holder and redistribute the rest to poor citizens.\n- **Method**: went straight to the popular assembly, had the tribune Octavius who vetoed it deposed. Then stood for a second year as tribune.\n- **End**: killed by senators led by Scipio Nasica. First political killing in Rome in centuries.\n\nFor the essay: the land question and the use of violence both start here."],
      ["Marius' army reforms: what Beard says", "The textbook story: Marius (107 BC) recruited landless men, so soldiers became loyal to generals who could get them land.\n\nBeard's caution (SPQR ch. 6): the property qualification had already been falling for decades; the change was gradual, not one law.\n\nStill true either way: by the 80s BC, armies followed their commanders, as Sulla showed in 88 BC."]],
    jobs: [["research", "Find me good sources on the fall of the Republic beyond SPQR", "Reliable books, lectures or primary sources in translation on the late Roman Republic (133–27 BC), suited to writing an argumentative essay."], ["ask", "Which causes do historians usually argue were most important, and who argues what?", "For an essay on why the Roman Republic fell: which causes do historians usually weigh most (land and the army, the ambition of individuals, the empire's wealth, institutional failure), and which named historians argue each?"], ["week", "Plan my week. Weekdays reading, Saturday writing.", "Commute reading 40 min on weekdays, Saturday morning for essay writing."], ["quiz", "Quiz me", ""]]},
];

const now = () => new Date().toISOString();
const day = (n: number) => format(subDays(new Date(), n), "yyyy-MM-dd");
const log = (msg: string) => console.log(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`);

async function waitJob(id: string) {
  const t0 = Date.now();
  for (;;) { await new Promise(r => setTimeout(r, 4000)); const j = getJob(id)!; if (j.status !== "running") return j; if (Date.now() - t0 > 14 * 60_000) return j; }
}

async function build(g: Goal) {
  const brief = await analyzeBrief(g.brief);
  createGoal(g.id, brief); log(`${g.id}: goal created (${brief.skills.length} skills, ${brief.roadmap.length} phases)`);
  // History, oldest first.
  for (const [ago, minutes, text] of g.logs) {
    const at = subDays(new Date(), ago); at.setHours(19, 15, 0, 0);
    sqlite.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,energy,kind,occurred_on,created_at) VALUES (?,?,?,?,NULL,'practice',?,?)").run(randomUUID(), g.id, text, minutes, day(ago), at.toISOString());
  }
  sqlite.prepare("UPDATE journey SET start_date=?,last_seen_at=? WHERE id=?").run(day(22), now(), g.id);
  for (const [title, body] of g.notes) storeDocument({id: randomUUID(), base: null, title, body, kind: "note", journey: g.id, author: "learner"});
  // Live Guide runs, as if typed into the chat.
  for (const [kind, say, text] of g.jobs) {
    addEvent(g.id, "user", {text: say});
    const id = startJob(g.id, kind, {text}); addEvent(g.id, "job", {job: id, kind}, "working");
    log(`${g.id}: ${kind} started`);
    const j = await waitJob(id); log(`${g.id}: ${kind} ${j.status}${j.error ? " — " + j.error : ""}`);
    if (j.status !== "done") continue;
    if (kind === "research") for (const p of pending(g.id).filter(p => p.kind === "agent_material" && p.payload.check?.ok).slice(0, 2)) {
      try { accept(p.id); addEvent(g.id, "guide", {markdown: `Added *${p.payload.suggestion.title}* to your materials.`}); } catch (e) { log(`${g.id}: accept failed ${(e as Error).message}`); }
    }
    if (kind === "week") { const w = pending(g.id).find(p => p.kind === "week_plan") ?? (sqlite.prepare("SELECT id FROM proposal WHERE journey_id=? AND kind='week_plan' AND status='pending' ORDER BY created_at DESC").get(g.id) as {id: string} | undefined);
      if (w) { acceptWeek(g.id, w.id); addEvent(g.id, "guide", {markdown: "Week saved. **Plan today** now starts from today's slot."}); } }
  }
}

const todo = GOALS.filter(g => only.length ? only.includes(g.id) : true);
for (const g of todo) if (has(g.id)) throw Error(`${g.id} already exists. Remove it or pick other goals.`);
// Staggered: five goal drafts at the same instant made the AI fail now and then.
const results = await Promise.allSettled(todo.map((g, i) => new Promise(r => setTimeout(r, i * 15_000)).then(() => build(g))));
results.forEach((r, i) => log(`${todo[i].id}: ${r.status}${r.status === "rejected" ? " — " + (r.reason as Error).message : ""}`));
process.exit(0);
