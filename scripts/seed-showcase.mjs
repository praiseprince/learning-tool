// Showcase data: four journeys (Marx, Plato, a first 5K, piano with singing and chords).
// Usage: DATABASE_URL=./data/app.db node scripts/seed-showcase.mjs   (run on an EMPTY database; see npm run seed:showcase)
import {format, subDays} from "date-fns";
import {randomUUID} from "node:crypto";
import {sqlite as db} from "../lib/db/client.ts";
import {ensureAtlas, insertRelation, event} from "../lib/v2/atlas.ts";
import {ensureRoutes} from "../lib/v2/route.ts";
import {ensureGuide} from "../lib/v2/guide.ts";
import {storeDocument} from "../lib/v2/notebook.ts";
import {addMaterial} from "../lib/v2/materials.ts";

if (db.prepare("SELECT COUNT(*) AS n FROM journey").get().n) throw new Error("Refusing to seed a database that already has journeys.");
const today = new Date();
const day = n => format(subDays(today, n), "yyyy-MM-dd");
const stamp = (n, hour = 19, minute = 10) => { const d = subDays(today, n); d.setHours(hour, minute, 0, 0); return d.toISOString(); };
const now = new Date().toISOString();

const journeys = {};
function journey(id, name, domain, hue, startAgo, charter, snapshot, skills) {
  journeys[id] = {id, skills: new Map(), entries: [], events: new Map()};
  db.prepare("INSERT INTO journey (id,name,domain,hue,start_date,status,last_seen_at,created_at) VALUES (?,?,?,?,?,'active',?,?)").run(id, name, domain, hue, day(startAgo), stamp(0, 8), stamp(startAgo));
  db.prepare("INSERT INTO charter (id,journey_id,version,goal,why,done_looks_like,deadline,constraints,starting_point,created_at) VALUES (?,?,1,?,?,?,?,?,?,?)")
    .run(id + "-charter", id, charter.goal, charter.why, charter.done, charter.deadline ?? null, charter.constraints, charter.start, stamp(startAgo));
  db.prepare("INSERT INTO state_snapshot (id,journey_id,summary,changed_phrases_json,created_at) VALUES (?,?,?,?,?)").run(id + "-state", id, snapshot, "[]", now);
  for (const s of skills) {
    const sid = `${id}-${s.k}`;
    journeys[id].skills.set(s.k, {...s, id: sid, level: s.level ?? 0});
  }
  for (const s of journeys[id].skills.values()) {
    const pre = (s.pre || []).map(k => { if (!journeys[id].skills.has(k)) throw new Error("unknown prerequisite " + k); return `${id}-${k}`; });
    db.prepare("INSERT INTO skill (id,journey_id,parent_id,name,description,level,prereq_ids_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(s.id, id, s.parent ? `${id}-${s.parent}` : null, s.name, s.d, s.level, JSON.stringify(pre), stamp(startAgo), now);
  }
}
let entryNo = 0;
/** one practice entry; events = [[skillKey, levelAfter, "exact quote from text"]] */
function entry(j, ago, minutes, text, events = [], kind = "practice", extra = {}) {
  const id = `${j}-e${++entryNo}`, created = stamp(ago, extra.hour ?? 19, extra.min ?? 20);
  db.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,energy,mood,kind,occurred_on,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, j, text, kind === "rest" ? null : minutes, extra.energy ?? null, extra.mood ?? null, kind, day(ago), created);
  journeys[j].entries.push({id, text, created, ago});
  for (const [k, level, quote] of events) {
    if (!text.includes(quote)) throw new Error(`Quote not in entry ${id}: ${quote}`);
    const s = journeys[j].skills.get(k); if (!s) throw new Error("unknown skill " + k);
    const prev = journeys[j].events.get(k) ?? 0;
    db.prepare("INSERT INTO skill_event VALUES (?,?,?,?,?,?,?)").run(`${id}-${k}`, s.id, id, level, level - prev, quote, created);
    journeys[j].events.set(k, level); s.level = level;
    db.prepare("UPDATE skill SET level=?,updated_at=? WHERE id=?").run(level, created, s.id);
  }
  return id;
}

/* ───────────────────────────── MARX ───────────────────────────── */
journey("marx", "Understand Marx", "philosophy", 25, 74, {
  goal: "Understand Marx well enough to explain his critique of capitalism and judge the main objections to it.",
  why: "I keep meeting his ideas second-hand in arguments about work, inequality and ideology. I want to read him instead of reading about him.",
  done: "I can explain alienation, historical materialism and surplus value in my own words, work through the first chapters of Capital, and say where I think Marx is right and wrong.",
  deadline: null, constraints: "Evenings and weekends, 3 to 5 hours a week. No economics degree. Reading in English translation.",
  start: "Read the Communist Manifesto in school and half of a podcast series on Capital. No Hegel. Little economics."
}, "Comfortable with the Manifesto and early Marx on alienation. Capital Vol. 1 is where I am now: commodities are clear, surplus value is shaky, fetishism is just starting to make sense.", [
  {k: "hegel", name: "Hegel's dialectic (the short version)", d: "Thesis, antithesis and synthesis as a way history and thought develop; what Marx keeps and what he turns upside down."},
  {k: "feuerbach", name: "Feuerbach's critique of religion", d: "Humans project their own essence onto God. Marx extends the move from religion to politics and economics."},
  {k: "alienation", name: "Alienated labour", d: "In the 1844 Manuscripts: estrangement from the product, the activity, species-being and other people.", pre: ["hegel", "feuerbach"]},
  {k: "histmat", name: "Historical materialism", d: "How material conditions and relations of production shape society and its transformation.", pre: ["hegel", "alienation"]},
  {k: "basesuper", name: "Base and superstructure", d: "The economic base and the legal, political and cultural forms that rest on it. Debated: one-way or reciprocal?", pre: ["histmat"]},
  {k: "class", name: "Class and class struggle", d: "Classes defined by relation to the means of production; struggle as the motor of history.", pre: ["histmat"]},
  {k: "commodity", name: "Commodities, use value and exchange value", d: "Opening of Capital: what a commodity is and why exchange value is not a property of the thing itself."},
  {k: "labourvalue", name: "Labour theory of value", d: "Value as socially necessary labour time, and the difference between value and price.", pre: ["commodity"]},
  {k: "surplus", name: "Surplus value", d: "Where profit comes from: labour power sold at its value produces more value than it costs.", pre: ["labourvalue"]},
  {k: "fetish", name: "Commodity fetishism", d: "Social relations between people appear as relations between things.", pre: ["commodity", "alienation"]},
  {k: "circuit", name: "The circuit of capital (M-C-M')", d: "Money becomes more money: why capitalism has no natural stopping point.", pre: ["commodity", "surplus"]},
  {k: "primitive", name: "Primitive accumulation", d: "The historical separation of producers from the land that makes wage labour possible (Capital, Part 8).", pre: ["surplus"]},
  {k: "manifesto", name: "Reading the Communist Manifesto", d: "Text, context (1848) and what it claims versus what people say it claims."},
  {k: "ideology", name: "Ideology", d: "Ruling ideas as the ideas of the ruling class; how conditions make some beliefs seem natural.", pre: ["basesuper"]},
  {k: "state", name: "Marx on the state", d: "The state as an instrument of class rule, and the late nuance in the Eighteenth Brumaire.", pre: ["class"]},
  {k: "influence", name: "Later Marxism (Lenin, Gramsci, Frankfurt School)", d: "How later thinkers revised Marx and what that tells you about what he left open.", pre: ["manifesto"]},
]);
entry("marx", 73, 55, "Started the Communist Manifesto with a pencil. Section 1 is shorter and angrier than I remembered. Wrote one sentence per page so I can explain it back.", [["manifesto", 1, "Started the Communist Manifesto with a pencil"]]);
entry("marx", 70, 70, "Finished the Manifesto. Main claim: all history is the history of class struggles, and the bourgeoisie has revolutionised production constantly. I can say that in my own words, but the Section 2 demands (abolishing property) still feel slippery.", [["manifesto", 3, "I can say that in my own words"], ["class", 1, "all history is the history of class struggles"]]);
entry("marx", 66, 45, "Podcast on Hegel, 45 min. Thesis, antithesis, synthesis is a bad summary apparently; Hegel never used those words for it. Better: a concept contains a contradiction that pushes it into a richer concept.", [["hegel", 1, "a concept contains a contradiction that pushes it into a richer concept"]]);
entry("marx", 61, 60, "Read Marx's 1844 Manuscripts, the section on estranged labour. Four kinds of alienation: from the product, from the act of production, from species-being, from other people. The worker puts life into the object and it comes back as an alien power.", [["alienation", 2, "Four kinds of alienation: from the product, from the act of production, from species-being, from other people"]]);
entry("marx", 58, 40, "Short one on Feuerbach. God as projection of human essence. Marx's Theses on Feuerbach: philosophers have only interpreted the world, the point is to change it. Eleventh thesis is a good one-liner but I should know what the other ten say.", [["feuerbach", 1, "God as projection of human essence"]], "practice", {mood: "curious"});
entry("marx", 56, 0, "Rest week from reading. Work deadline.", [], "rest");
entry("marx", 52, 80, "German Ideology excerpts on historical materialism. 'Life is not determined by consciousness, but consciousness by life.' So I start from the material conditions: how people produce what they need. Relations of production, forces of production. I tried explaining feudalism to capitalism as a change in relations, not just ideas.", [["histmat", 2, "I start from the material conditions: how people produce what they need"], ["hegel", 2, "Relations of production"]].filter(e => e[0] !== "hegel"));
entry("marx", 49, 50, "Preface to A Contribution to the Critique of Political Economy: base and superstructure. The metaphor is a building. I think the question I need to answer: is the superstructure just a reflection, or does it push back? Engels' late letters say it pushes back.", [["basesuper", 1, "is the superstructure just a reflection, or does it push back"]]);
entry("marx", 45, 75, "Capital Vol. 1, Chapter 1 section 1. A commodity has use value and exchange value. Exchange value looks like a property of the thing but it is a social relation. Twenty yards of linen equals one coat only because both embody abstract labour. I redid the linen-coat example on paper.", [["commodity", 3, "A commodity has use value and exchange value"], ["labourvalue", 1, "Twenty yards of linen equals one coat only because both embody abstract labour"]]);
entry("marx", 42, 65, "Capital Chapter 1, the 'socially necessary labour time' part. A value is not how long it took me, it is how long it takes on average with normal skill and tools. That also explains why a new machine makes old goods lose value.", [["labourvalue", 2, "it is how long it takes on average with normal skill and tools"]]);
entry("marx", 38, 90, "Capital Ch. 1 section 4, commodity fetishism. This is the part I most wanted to understand. The mysterious character of the commodity is not in its use value; it is that the social character of labour appears as a property of the products. People relate to each other through things. Ties back to alienation in 1844.", [["fetish", 2, "People relate to each other through things"], ["alienation", 3, "Ties back to alienation in 1844"]], "practice", {energy: "high"});
entry("marx", 33, 60, "Watched David Harvey's lecture on Chapter 4, 'The General Formula of Capital'. M-C-M' means you spend money to get more money, and unlike C-M-C there is no natural limit. Wrote that circuit on a card and put it above my desk.", [["circuit", 1, "M-C-M' means you spend money to get more money"]]);
entry("marx", 29, 85, "Chapters 6 to 7, labour power. The worker sells labour power for a day at its value (the cost of the worker's own reproduction), then works longer than that. The extra hours are surplus value. I still stumble on why the wage is 'fair' in exchange terms yet exploitative, but the key is that the sale happens in the market and the production happens in the workplace, which Marx calls the hidden abode.", [["surplus", 2, "the worker sells labour power for a day at its value"]].map(([k, l]) => [k, l, "The worker sells labour power for a day at its value"]));
entry("marx", 24, 40, "Argued with a friend about whether Marx thinks capitalism is evil. He doesn't moralise; he says it is a system with its own logic and contradictions. We disagreed about whether exploitation is a moral claim. I need to read Wood and Cohen on this.", [["class", 2, "he says it is a system with its own logic and contradictions"]]);
entry("marx", 19, 75, "Eighteenth Brumaire, first sections. 'Men make their own history, but they do not make it as they please.' This is the passage that makes me doubt the crude determinist reading of base and superstructure. The state also has some autonomy here, as Bonaparte rules for no single class.", [["state", 1, "The state also has some autonomy here"], ["basesuper", 2, "Men make their own history, but they do not make it as they please"]]);
entry("marx", 14, 55, "Capital Part 8 on primitive accumulation: enclosure of the commons, the Highland clearances, the creation of a propertyless class who have to sell their labour. Without this the story 'workers just freely contract' collapses.", [["primitive", 1, "enclosure of the commons, the Highland clearances"]]);
entry("marx", 9, 50, "Gramsci on hegemony, a summary article. Ideology as common sense: consent not just coercion. Link to Marx's 'ruling ideas are the ideas of the ruling class'. I can now say what ideology means in a sentence, but I haven't read Gramsci himself yet.", [["ideology", 2, "Ideology as common sense: consent not just coercion"], ["influence", 1, "Gramsci on hegemony"]]);
entry("marx", 4, 70, "Re-read the fetishism section after the Gramsci reading and it landed differently. The commodity form is a kind of ideology that is produced by the market itself, not by anybody's conspiracy. Wrote a one-page note and linked it to alienation and the Cave.", [["fetish", 3, "The commodity form is a kind of ideology that is produced by the market itself"]], "practice", {hour: 21, mood: "satisfied"});
entry("marx", 0, 35, "Reviewed surplus value on paper with a numeric example: 6 hours necessary labour, 6 hours surplus, so rate of surplus value s/v = 100 percent. Easy when the numbers are given. Tomorrow I'll try deriving it without notes.", [["surplus", 3, "rate of surplus value s/v = 100 percent"]], "practice", {hour: 8, min: 15});

/* ───────────────────────────── PLATO ───────────────────────────── */
journey("plato", "Understand Plato", "philosophy", 280, 68, {
  goal: "Read the Republic and four earlier dialogues closely enough to explain Plato's main arguments and to say where I think they fail.",
  why: "Everything in the Western tradition is a footnote to Plato, supposedly. I want to know what is actually in the dialogues rather than the textbook version.",
  done: "I can reconstruct the argument of the Republic in order, explain the Forms and the Cave without hand-waving, and write a 1,500-word essay arguing for or against the claim that justice pays.",
  deadline: null, constraints: "Two evenings a week plus Sunday mornings. Tolerates dense text, loses interest in secondary scholarship fast.",
  start: "Know the Allegory of the Cave from school. Never read a whole dialogue. Never heard of the Third Man argument."
}, "Through Republic Book VII. Forms, Cave, Line and the tripartite soul are solid. Now stuck on why the Form of the Good is 'beyond being', and about to start the Symposium for contrast.", [
  {k: "socratic", name: "Socratic method (elenchus)", d: "Question-and-answer testing of definitions until an interlocutor sees a contradiction in their beliefs."},
  {k: "euthyphro", name: "Euthyphro dilemma", d: "Is the pious loved by the gods because it is pious, or pious because the gods love it? A model elenchus.", pre: ["socratic"]},
  {k: "forms", name: "Theory of Forms", d: "Abstract, unchanging Forms are the real objects of knowledge; particulars only partake in them."},
  {k: "knowopin", name: "Knowledge vs opinion", d: "Republic V: knowledge is of what is, opinion of what is and is not; the lovers of sights and sounds.", pre: ["forms"]},
  {k: "line", name: "The Divided Line", d: "Four levels of cognition: imagination, belief, thought, understanding.", pre: ["forms", "knowopin"]},
  {k: "cave", name: "Allegory of the Cave", d: "Education as turning the soul toward what is real; the prisoner who returns.", pre: ["forms", "line"]},
  {k: "good", name: "The Form of the Good", d: "The source of being and intelligibility, compared to the sun.", pre: ["cave"]},
  {k: "soul", name: "The tripartite soul", d: "Reason, spirit and appetite, with justice as each part doing its job.", pre: ["socratic"]},
  {k: "justice", name: "Justice in the Republic", d: "City and soul as parallel: justice as harmony of parts. Thrasymachus and Glaucon's challenge.", pre: ["soul"]},
  {k: "king", name: "Philosopher-kings", d: "Why the rulers must be those who know the Good and do not want power.", pre: ["justice", "cave"]},
  {k: "recollection", name: "Theory of recollection (Meno)", d: "Learning as remembering; the slave boy and the doubled square.", pre: ["forms", "socratic"]},
  {k: "phaedo", name: "Immortality of the soul (Phaedo)", d: "Four arguments for the soul's survival and what they assume about the Forms.", pre: ["forms", "recollection"]},
  {k: "eros", name: "Eros in the Symposium", d: "The ladder of love from bodies to Beauty itself.", pre: ["forms"]},
  {k: "poetry", name: "Critique of poetry and art", d: "Republic II-III and X: imitation as third from truth, and what Plato wants to censor.", pre: ["justice"]},
  {k: "thirdman", name: "The Third Man argument", d: "Parmenides: Plato's own objection to the Forms, which regress without a fix.", pre: ["forms"]},
  {k: "timaeus", name: "Timaeus and cosmology", d: "A craftsman builds the world according to Forms, with the soul built from musical ratios.", pre: ["forms"]},
]);
entry("plato", 67, 60, "Started Euthyphro in the Grube translation. Shortest dialogue so far. Socrates asks 'What is piety?' and every answer Euthyphro gives falls apart, and then Euthyphro leaves in a hurry. It is a pattern: question, definition, counterexample, retreat.", [["socratic", 1, "question, definition, counterexample, retreat"]]);
entry("plato", 64, 45, "The dilemma at 10a: is the pious loved by the gods because it is pious, or is it pious because it is loved? I wrote it as a modern ethics question: is something good because God commands it, or does God command it because it is good? That is the Euthyphro dilemma and it works against divine command theory.", [["euthyphro", 3, "is something good because God commands it, or does God command it because it is good"], ["socratic", 2, "Euthyphro dilemma"]]);
entry("plato", 60, 70, "Meno. The slave boy and the square of side two. Socrates leads him through diagrams until he sees the doubled square needs a diagonal. Plato says this shows learning is recollection. I'm not convinced the boy wasn't led, which I assume is the standard objection.", [["recollection", 2, "Socrates leads him through diagrams until he sees the doubled square needs a diagonal"]]);
entry("plato", 55, 85, "Republic Book I. Thrasymachus: justice is the advantage of the stronger. Socrates takes him apart but not very convincingly, and that is on purpose; the rest of the book is Glaucon and Adeimantus asking him to try again properly. Noted the ring of Gyges.", [["justice", 1, "justice is the advantage of the stronger"]], "practice", {mood: "engaged"});
entry("plato", 50, 80, "Book II to IV. The city in speech to find justice in the soul: producers, auxiliaries, guardians. Soul has reason, spirit, appetite. Leontius and the corpses is the best illustration of spirit fighting appetite. Justice as each part doing its own work.", [["soul", 3, "producers, auxiliaries, guardians"], ["justice", 2, "Justice as each part doing its own work"]]);
entry("plato", 47, 0, "Skipped, travel.", [], "rest");
entry("plato", 43, 75, "Book V, the end: knowledge vs opinion. Lovers of sights and sounds like many beautiful things; philosophers love the Beautiful itself. Knowledge is of what is, ignorance of what is not, opinion in between. I had to read the argument twice because 'what is and is not' means a thing that is both beautiful and ugly in different respects.", [["knowopin", 2, "Knowledge is of what is, ignorance of what is not, opinion in between"], ["forms", 2, "philosophers love the Beautiful itself"]]);
entry("plato", 39, 90, "Book VI, the Sun and the Divided Line. The Line has four sections: eikasia (images), pistis (belief), dianoia (thought, using hypotheses like geometers), noesis (understanding, the Forms). I drew it to scale with the ratio A:B = C:D. The Good is to the intelligible what the sun is to the visible.", [["line", 3, "eikasia (images), pistis (belief), dianoia (thought, using hypotheses like geometers), noesis (understanding, the Forms)"], ["good", 1, "The Good is to the intelligible what the sun is to the visible"]], "practice", {energy: "high"});
entry("plato", 36, 70, "Book VII: the Cave. The way up is education as turning the soul around, not putting sight into blind eyes. And the returning philosopher is laughed at and might be killed, so Plato is thinking of Socrates. I wrote down how each stage of the Cave lines up with the Line: shadows are eikasia, objects are pistis, outside is noesis.", [["cave", 3, "education as turning the soul around, not putting sight into blind eyes"]]);
entry("plato", 31, 55, "Why philosopher-kings? Because only those who have seen the Good will rule well, and because they won't want to rule, so they won't be power-hungry. Plato thinks the best rulers would rather be doing philosophy. The compulsion to go back down the Cave is the interesting bit.", [["king", 2, "only those who have seen the Good will rule well"]]);
entry("plato", 27, 60, "Phaedo, the final argument. Four arguments for immortality: cyclical, recollection, affinity, and the final argument from the Form of Life. I can state the first two and the third. The fourth I can only paraphrase, and I think the problem is I don't understand 'forms as causes' yet.", [["phaedo", 1, "Four arguments for immortality: cyclical, recollection, affinity, and the final argument from the Form of Life"]]);
entry("plato", 22, 65, "Symposium, Diotima's speech. The ladder of love: one beautiful body, all beautiful bodies, souls, laws, knowledge, then Beauty itself. It's the Forms again through desire instead of argument. The change of register from the Republic is striking.", [["eros", 2, "the ladder of love: one beautiful body, all beautiful bodies, souls, laws, knowledge, then Beauty itself".replace("the ladder", "The ladder")].map(x => x)].map(([k, l]) => [k, l, "The ladder of love: one beautiful body, all beautiful bodies, souls, laws, knowledge, then Beauty itself"]));
entry("plato", 16, 50, "Republic X: the painter makes a copy of a copy, third from the truth. Plato sounds like he wants to ban poets, but what he objects to is how mimesis shapes the soul, which I think is a serious point about media. Still not sure he is fair to Homer.", [["poetry", 2, "the painter makes a copy of a copy, third from the truth"]]);
entry("plato", 11, 70, "Parmenides, first part. Parmenides' objection to the young Socrates: if large things are large by partaking in Largeness, then Largeness and the large things need a further Form to explain what they share, and so on forever. It's the Third Man and it's Plato attacking himself. I do not yet know how he responds.", [["thirdman", 1, "if large things are large by partaking in Largeness"]]);
entry("plato", 6, 45, "Read the Timaeus summary notes. The world soul is built from ratios of the Pythagorean scale, 1:2, 2:3, 3:4 and so on. The cosmos is a musical instrument in a loose sense. I want to find out how this connects to harmony in music, which links to my piano practice.", [["timaeus", 1, "The world soul is built from ratios of the Pythagorean scale"]], "practice", {mood: "curious"});
entry("plato", 2, 75, "Reread the Cave beside the Line and wrote a one-page note on how they fit. The prisoners' shadows are eikasia and the fire is a kind of belief; the climb is the education of the guardians. Realised the Cave is not about Forms as other-worldly but about education. Linked it to Marx on ideology.", [["cave", 4, "the Cave is not about Forms as other-worldly but about education"]], "practice", {hour: 21});
entry("plato", 0, 40, "Looked up the Form of the Good: 'beyond being'. Can't yet say what that means. Possibly that the Good explains why anything is intelligible at all, as the sun lets us see without being one of the visible things.", [["good", 2, "the Good explains why anything is intelligible at all"]].map(([k, l]) => [k, l, "the Good explains why anything is intelligible at all"]), "practice", {hour: 8, min: 40});

/* ───────────────────────────── 5K ───────────────────────────── */
journey("run", "Run a 5K", "fitness", 150, 70, {
  goal: "Run a 5K without stopping at the local parkrun and finish feeling like I could do it again.",
  why: "I haven't run since school and I want a plain, measurable thing that gets me outside three mornings a week.",
  done: "Cross the line at the 5K parkrun on 12 December having run the whole thing at an even, conversational-to-comfortable effort. Time is irrelevant; stopping is not.",
  deadline: "2026-12-12", constraints: "Three runs a week before work, 30 to 40 minutes. Left knee gets cranky above 6 km per week jumps. No treadmill.",
  start: "Can jog about two minutes before my lungs burn. Reasonably healthy. Own decent shoes bought at a running shop."
}, "Weeks 1 to 8 done. Can run 25 minutes continuously at an easy pace. First full-distance trial run planned for Sunday.", [
  {k: "walkrun", name: "Run/walk intervals", d: "Alternating short runs and walks to build aerobic fitness without injury."},
  {k: "easy", name: "Easy conversational pace", d: "Running slowly enough to speak in sentences; the base for everything else."},
  {k: "cont20", name: "Run 20 minutes continuously", d: "The first real milestone: running without a walk break.", pre: ["walkrun", "easy"]},
  {k: "breath", name: "Rhythmic breathing", d: "Matching breath to steps (3 in, 2 out) to avoid side stitches and panic.", pre: ["easy"]},
  {k: "cadence", name: "Cadence around 170 steps/min", d: "Shorter, quicker steps reduce overstriding and knee load."},
  {k: "form", name: "Posture and foot strike", d: "Tall posture, relaxed shoulders, landing under the body."},
  {k: "pacing", name: "Even pacing", d: "Starting slow and holding the effort instead of sprinting then fading.", pre: ["easy"]},
  {k: "strides", name: "Strides and short surges", d: "Four to six 20-second relaxed accelerations to practise form and rhythm.", pre: ["form"]},
  {k: "hills", name: "Hill running", d: "Shorter steps, upper body tall, easy effort up and relaxed down.", pre: ["form", "breath"]},
  {k: "long", name: "Long slow run (45 minutes)", d: "Weekly longer run at an easy pace to build endurance beyond race distance.", pre: ["cont20"]},
  {k: "strength", name: "Strength: calves, glutes, core", d: "Two 15-minute sessions a week: calf raises, bridges, planks, split squats."},
  {k: "injury", name: "Injury prevention (shins and knee)", d: "Listen to early warning, add rest, keep weekly jumps under 10 percent.", pre: ["form", "strength"]},
  {k: "fuel", name: "Fuelling and hydration", d: "What to eat before a morning run, when water matters, how to avoid bonking."},
  {k: "recovery", name: "Recovery and sleep", d: "Rest days as part of the plan; sleep as the real training effect."},
  {k: "fivek", name: "Run 5K continuously", d: "The goal: 5 km without stopping.", pre: ["cont20", "pacing", "long"]},
  {k: "race", name: "Race-day routine", d: "Night-before prep, warm-up, start position, plan for the first kilometre.", pre: ["fivek", "fuel"]},
]);
entry("run", 70, 25, "First run/walk: 1 minute jog, 2 minutes walk, eight rounds. Felt great for the first two and terrible after. Knees fine. Wore the new shoes.", [["walkrun", 1, "First run/walk: 1 minute jog, 2 minutes walk, eight rounds"]], "practice", {hour: 7, min: 0, energy: "medium"});
entry("run", 67, 28, "Run/walk 90 seconds jog, 90 walk, nine rounds. Breathing is the limiter, not legs. Started too fast again.", [["walkrun", 2, "Run/walk 90 seconds jog, 90 walk, nine rounds"]], "practice", {hour: 7, min: 5});
entry("run", 64, 28, "Same as Tuesday but I forced myself to go slower. Could talk in short sentences the whole time. That is what easy actually feels like.", [["easy", 1, "I forced myself to go slower"]], "practice", {hour: 7, min: 0, mood: "good"});
entry("run", 60, 30, "Run/walk 2 min jog, 1 min walk, ten rounds. Side stitch in round 6. Slowed to a walk and breathed out hard on the left foot.", [["breath", 1, "breathed out hard on the left foot"]], "practice", {hour: 6, min: 55});
entry("run", 57, 0, "Rest. Calves sore from Wednesday.", [], "rest");
entry("run", 55, 32, "3 minutes jog, 1 minute walk, eight rounds. First time I ran three minutes without wanting to quit. Slow enough to talk. Pace was 7:40 per km on the watch.", [["walkrun", 3, "3 minutes jog, 1 minute walk, eight rounds"]], "practice", {hour: 7, min: 0});
entry("run", 51, 34, "5 minutes jog, 1 minute walk, six rounds. Breath rhythm of three steps in, two out stopped the stitch. Cadence check on the watch said 158, so I am overstriding.", [["breath", 2, "three steps in, two out stopped the stitch"], ["cadence", 1, "Cadence check on the watch said 158"]], "practice", {hour: 7, min: 0});
entry("run", 47, 20, "Short easy run 20 min plus strength: calf raises 3 by 15, glute bridges 3 by 12, plank 3 by 30 seconds. Left knee a bit tight after. Foam rolled.", [["strength", 1, "calf raises 3 by 15, glute bridges 3 by 12, plank 3 by 30 seconds"]], "practice", {hour: 7, min: 10});
entry("run", 44, 36, "8 minutes jog, 1 walk, 3 rounds. Ran with a metronome app at 170 and my steps got shorter and lighter. Knee felt better than the last two runs. Cadence of 170 is the first thing that has made running feel efficient.", [["cadence", 2, "Ran with a metronome app at 170 and my steps got shorter and lighter"], ["walkrun", 4, "8 minutes jog, 1 walk, 3 rounds"]], "practice", {hour: 6, min: 50, mood: "excited"});
entry("run", 40, 35, "First 15 minutes without stopping! Slow, 7:20 per km, talking pace. Stopped because the plan said so but I could have done five more.", [["cont20", 1, "First 15 minutes without stopping"], ["easy", 2, "talking pace"]], "practice", {hour: 7, min: 0, mood: "proud"});
entry("run", 37, 0, "Rest. Slept badly, skipped.", [], "rest");
entry("run", 35, 38, "20 minutes continuous, easy. Counted breaths to stay calm in minutes 8 to 12 where I wanted to stop. The urge passes if I slow down by 10 seconds.", [["cont20", 3, "20 minutes continuous, easy"], ["pacing", 1, "The urge passes if I slow down by 10 seconds"]], "practice", {hour: 7, min: 0});
entry("run", 31, 30, "Easy 25 minutes plus four strides on the last stretch of road. Strides felt silly but the form cue (tall, quick, quiet feet) transferred to the end of the run.", [["strides", 1, "Strides felt silly but the form cue (tall, quick, quiet feet) transferred to the end of the run"], ["form", 2, "tall, quick, quiet feet"]], "practice", {hour: 7, min: 0});
entry("run", 28, 40, "Hill route. Shorter steps, lean from the ankles. The hill at the park took 90 seconds and I did it five times with walks down. Calves burning but breathing was controlled.", [["hills", 1, "Shorter steps, lean from the ankles"]], "practice", {hour: 7, min: 0});
entry("run", 24, 45, "30 minutes continuous. Even pacing for once: first km 6:50, last km 6:45. Used the watch only to check the first kilometre and then ignored it.", [["pacing", 2, "first km 6:50, last km 6:45"], ["cont20", 4, "30 minutes continuous"]], "practice", {hour: 7, min: 0, mood: "happy"});
entry("run", 21, 0, "Rest day. Shin tender on the right side, front inner edge. Iced and added a calf-strength session instead.", [["injury", 1, "Shin tender on the right side"]], "rest");
entry("run", 18, 30, "Easy 25 minutes on grass. Shin was fine. Dropped weekly volume 10 percent on purpose. Slept 8 hours and felt noticeably better on this one.", [["injury", 2, "Dropped weekly volume 10 percent on purpose"], ["recovery", 2, "Slept 8 hours and felt noticeably better on this one"]], "practice", {hour: 7, min: 20});
entry("run", 14, 50, "First long run, 45 minutes at 7:15 per km, about 6 km. Ate a banana beforehand and carried no water; felt thirsty at 35 minutes. Next time a small bottle and a sip at 25.", [["long", 2, "First long run, 45 minutes at 7:15 per km, about 6 km"], ["fuel", 2, "Ate a banana beforehand"]], "practice", {hour: 8, min: 0, mood: "tired but pleased"});
entry("run", 10, 32, "Easy 30 min. Form check: shoulders relaxed, no clenched fists, landing under the hips. Cadence averaged 168.", [["form", 3, "shoulders relaxed, no clenched fists, landing under the hips"], ["cadence", 3, "Cadence averaged 168"]], "practice", {hour: 7, min: 0});
entry("run", 7, 36, "Parkrun course recce: ran the 5K route at easy effort, 4.2 km before I walked because the path was muddy. Not far off. 5:31 per km pace was too fast for the first km, I will go out slower on the day.", [["fivek", 1, "ran the 5K route at easy effort, 4.2 km"], ["pacing", 3, "I will go out slower on the day"]], "practice", {hour: 9, min: 5});
entry("run", 4, 25, "Short easy run 20 min plus mobility and strength. Left knee was a bit grumpy so I stopped at 20. No pain the next day.", [["strength", 2, "Short easy run 20 min plus mobility and strength"]], "practice", {hour: 7, min: 0});
entry("run", 1, 40, "Ran 5K continuous, first time! 33:12 at an easy effort, felt like I could have kept going for another kilometre. Even splits, 6:38 average. Cried a bit at the end, which I did not expect.", [["fivek", 3, "Ran 5K continuous, first time! 33:12 at an easy effort"], ["easy", 3, "felt like I could have kept going for another kilometre"]], "practice", {hour: 7, min: 30, mood: "elated"});
entry("run", 0, 20, "Walked the dog and did 15 minutes of easy jogging to loosen the legs. Planning the pre-race breakfast: oats and a banana two hours before.", [["race", 1, "Planning the pre-race breakfast: oats and a banana two hours before"]], "practice", {hour: 7, min: 45});

/* ───────────────────────────── PIANO ───────────────────────────── */
journey("piano", "Piano: sing and play chords", "music", 215, 72, {
  goal: "Accompany myself on piano, singing three songs with correct chords, steady rhythm and a voice that stays in tune.",
  why: "I sing in the shower and I'd like to sing at my sister's wedding in the spring, accompanying myself instead of using a backing track.",
  done: "Perform 'Let It Be', one slower song in a minor key and one up-tempo song from memory for a friend, singing and playing at once without stopping.",
  deadline: "2027-04-17", constraints: "30 minutes on weekdays, a longer session on Sundays. Upright piano, headphones after 9 pm. Small hands: an octave is a stretch.",
  start: "Read the treble clef slowly, bass clef barely. Know a few chords from a guitar-playing flatmate. Sing in tune on easy songs but lose the pitch when my hands are busy."
}, "Can play and sing the verse of 'Let It Be' with chords in C, with the chorus still wobbly. Left-hand chord changes are the bottleneck: I lose my pitch when I look down.", [
  {k: "posture", name: "Posture and hand position", d: "Seat height, curved fingers, relaxed wrists. Foundation for pain-free practice."},
  {k: "reading", name: "Reading the grand staff", d: "Treble and bass clefs; fast enough to read a lead sheet."},
  {k: "maj", name: "Major triads (C, F, G)", d: "Root, third, fifth; the shapes and sound of major chords."},
  {k: "min", name: "Minor triads (Am, Dm, Em)", d: "Lowered third and its sound; how minors sit in a major key.", pre: ["maj"]},
  {k: "inv", name: "Chord inversions", d: "Root position, first and second inversions to keep the hand close.", pre: ["maj"]},
  {k: "trans", name: "Smooth chord changes", d: "Moving between chords with the least hand motion; common tones.", pre: ["maj", "min", "inv"]},
  {k: "seventh", name: "Seventh chords (G7, Cmaj7, Am7)", d: "Adding colour; dominant seventh pulling back to the tonic.", pre: ["min"]},
  {k: "prog", name: "I-V-vi-IV progression", d: "The four chords behind hundreds of songs, in any key.", pre: ["trans"]},
  {k: "pulse", name: "Steady pulse with a metronome", d: "Keeping time while changing chords; the base of comping.", pre: []},
  {k: "comp", name: "Comping patterns", d: "Block chords, broken chords, and an eighth-note pattern for ballads.", pre: ["pulse", "maj"]},
  {k: "pitch", name: "Matching pitch to the piano", d: "Singing the note you hear and staying on it when the harmony moves.", pre: []},
  {k: "breath", name: "Breath support for singing", d: "Low, quiet inhale; slow, even exhale; phrases that don't run out.", pre: []},
  {k: "range", name: "Vocal range and warm-ups", d: "Finding comfortable keys, lip trills, sirens, five-note scales.", pre: ["breath"]},
  {k: "sing", name: "Singing while playing chords", d: "The target skill: left and right hand on autopilot while the voice leads.", pre: ["prog", "pitch", "comp"]},
  {k: "ear", name: "Hearing chord quality by ear", d: "Telling major, minor and dominant seventh apart without looking.", pre: ["min"]},
  {k: "song1", name: "Song 1: 'Let It Be'", d: "Verse, chorus and bridge in C with a basic ballad pattern.", pre: ["prog", "sing"]},
  {k: "transpose", name: "Transposing a song to fit my voice", d: "Moving a song up or down a few semitones so the melody sits in range.", pre: ["inv", "range", "prog"]},
]);
entry("piano", 71, 30, "Sat properly for the first time: bench height so my forearms are level, wrists loose. Played C major scale one octave each hand slowly. Fingers collapse on the fourth and fifth finger.", [["posture", 1, "Sat properly for the first time: bench height so my forearms are level, wrists loose"]], "practice", {hour: 19, min: 0});
entry("piano", 69, 30, "C, F and G major chords, root position, both hands separately. Whole-tone shapes help. Sang the root note of each chord as I changed, mostly flat on F.", [["maj", 2, "C, F and G major chords, root position, both hands separately"], ["pitch", 1, "Sang the root note of each chord as I changed, mostly flat on F"]], "practice", {hour: 19, min: 0});
entry("piano", 66, 35, "Metronome at 60. Quarter-note C chord on each click for four minutes, then changing to F on beat one of every other bar. I came in late on the change nearly every time. This is the whole job really.", [["pulse", 1, "Metronome at 60"]], "practice", {hour: 19, min: 10});
entry("piano", 63, 30, "A minor, D minor and E minor. The sound of the lowered third is hard to describe but easy to hear. Ear game: my sister played major or minor at random and I got 7 of 10.", [["min", 2, "A minor, D minor and E minor"], ["ear", 1, "I got 7 of 10"]], "practice", {hour: 19, min: 0});
entry("piano", 60, 40, "Sunday: singing warm-ups, lip trills and sirens for 10 minutes before any piano. My range feels like A2 to E4 comfortably, with a break around D4. Breath: inhale low, hand on belly, hiss out for 12 seconds.", [["range", 1, "My range feels like A2 to E4 comfortably"], ["breath", 1, "inhale low, hand on belly, hiss out for 12 seconds"]], "practice", {hour: 10, min: 0, mood: "relaxed"});
entry("piano", 58, 0, "Rest. Sore throat.", [], "rest");
entry("piano", 55, 30, "C - G - Am - F, four beats each, metronome at 60. Got through the loop once without stopping on the 6th try. First time the chord changes felt like a pattern and not four separate things.", [["prog", 1, "C - G - Am - F, four beats each, metronome at 60"], ["trans", 1, "First time the chord changes felt like a pattern and not four separate things"]], "practice", {hour: 19, min: 5});
entry("piano", 52, 30, "Inversions of C: C/E and C/G. Using C/G on the way to F means the right hand barely moves. The hand moves less and the changes are smoother. This is the trick everyone tells you and it works.", [["inv", 2, "Using C/G on the way to F means the right hand barely moves"]], "practice", {hour: 19, min: 0});
entry("piano", 49, 35, "Added a basic ballad left hand: root on beat one, fifth on beat three, right hand held chord. Metronome 66. Counting aloud '1 and 2 and' to keep eighths even. It sounds like a real song for the first time.", [["comp", 2, "Added a basic ballad left hand: root on beat one, fifth on beat three"]], "practice", {hour: 19, min: 0, mood: "pleased"});
entry("piano", 46, 45, "Sunday. Tried singing 'Let It Be' while playing the first four bars. Voice and hands fight: if I think about the melody I lose the left hand; if I think about the left hand I forget the words. Recorded it on my phone to hear what is really happening.", [["sing", 1, "Tried singing 'Let It Be' while playing the first four bars"]], "practice", {hour: 10, min: 15});
entry("piano", 43, 30, "Listened to the recording. Pitch drifts flat on 'whisper words' every time I shift to the Am. I think I'm anticipating the chord change with my breath. Practised just the melody with the root only in the left hand, no chord changes.", [["pitch", 2, "Pitch drifts flat on 'whisper words' every time I shift to the Am"]], "practice", {hour: 19, min: 0});
entry("piano", 39, 30, "Seventh chords: G7 resolving to C. The pull of the seventh toward the tonic is really audible. Played G7 - C ten times and then tried Am7 and Cmaj7 which sound soft and jazzy compared with triads.", [["seventh", 1, "The pull of the seventh toward the tonic is really audible"]], "practice", {hour: 19, min: 0});
entry("piano", 36, 40, "Metronome at 72. Whole verse of 'Let It Be' hands only, no singing. Steady for the first time. I stop having to look at the keys on the C to G change, which frees the eyes for the lead sheet.", [["trans", 2, "I stop having to look at the keys on the C to G change"], ["pulse", 2, "Metronome at 72"]], "practice", {hour: 19, min: 0});
entry("piano", 32, 0, "Rest. Out of town.", [], "rest");
entry("piano", 30, 45, "Sunday. Hummed the melody on 'doo' over the left hand pattern and chords, then added the words one line at a time. Verse 1 now works start to finish at tempo 66 with only two stumbles. The trick was putting the melody on the voice and the rhythm on the left hand, not both on the right.", [["sing", 2, "Verse 1 now works start to finish at tempo 66 with only two stumbles"], ["song1", 1, "Hummed the melody on 'doo' over the left hand pattern"]], "practice", {hour: 10, min: 0, mood: "encouraged"});
entry("piano", 27, 30, "Learned the chorus chords: C G Am F, then C G F C. It is the same progression with a different ending, which I had not noticed. Got the I-V-vi-IV in C and G and tried it in D too.", [["prog", 3, "Got the I-V-vi-IV in C and G and tried it in D too"]], "practice", {hour: 19, min: 0});
entry("piano", 23, 30, "Transposing: 'Let It Be' is too high in C for me on the chorus. Tried A and B flat. In A I can hold the last note. Moving chords down 3 semitones means F# minor and D major, which I'm learning as I go. A lot of effort.", [["transpose", 1, "Tried A and B flat. In A I can hold the last note"]], "practice", {hour: 19, min: 10});
entry("piano", 20, 35, "Breath plan for 'Let It Be': breathe at the end of each two-bar phrase, never mid-line. Marked breaths on the lead sheet with a small tick. Held the long 'Let it be' with relaxed belly, no gasp. Breath support is what separates a held note from a shaky one.", [["breath", 2, "Breath plan for 'Let It Be': breathe at the end of each two-bar phrase"]], "practice", {hour: 19, min: 0});
entry("piano", 16, 40, "Sunday. Verse and chorus together with singing. Two clean passes out of five. The bridge uses Am7 and Em, which I have only done with no singing. Ear game with my sister: 8 of 10 on major vs minor, and 6 of 10 on telling a dominant seventh from a major.", [["sing", 3, "Verse and chorus together with singing"], ["ear", 2, "8 of 10 on major vs minor"]], "practice", {hour: 10, min: 0, mood: "proud"});
entry("piano", 12, 30, "Comping variation: broken chord pattern (1 5 3 5) in the left hand for the second verse, so the song builds. Metronome at 72. The pattern needs relaxed wrists or my left shoulder tightens up.", [["comp", 3, "broken chord pattern (1 5 3 5) in the left hand for the second verse"], ["posture", 3, "relaxed wrists"]], "practice", {hour: 19, min: 0});
entry("piano", 8, 40, "Warm-up routine now takes 8 minutes: five-note scales, sirens, lip trills. Voice settles faster and my range now reaches F4 without cracking, which makes the original key almost workable.", [["range", 2, "my range now reaches F4 without cracking"]], "practice", {hour: 8, min: 15});
entry("piano", 5, 45, "Sunday. Full run of 'Let It Be' in A: verse, chorus, verse, chorus, bridge. Made it through twice with only one breath-break mistake. I stayed in time with the metronome at 70 even when the chord changed. Recorded it: pitch is much steadier than the October take.", [["song1", 2, "Full run of 'Let It Be' in A: verse, chorus, verse, chorus, bridge"], ["pulse", 3, "I stayed in time with the metronome at 70 even when the chord changed"]], "practice", {hour: 10, min: 0, mood: "happy"});
entry("piano", 2, 30, "Started song 2, 'Skinny Love' in Am: the chords Am, C, G, D are simple but the strumming pattern needs a steady eighth feel. Slow at 60. Struggling with the leaps for the right hand on the D chord.", [["min", 3, "Started song 2, 'Skinny Love' in Am"], ["sing", 2, "the strumming pattern needs a steady eighth feel"]].slice(0, 1), "practice", {hour: 19, min: 0});
entry("piano", 0, 30, "Morning vocal warm-up and then the chorus of 'Let It Be' hands and voice, four times through. Fixed the flat pitch on 'whisper words' by landing the Am a half beat earlier in the left hand. Chord change timing was the bug, not the voice.", [["sing", 3, "Fixed the flat pitch on 'whisper words' by landing the Am a half beat earlier in the left hand"]], "practice", {hour: 8, min: 20});

/* ───────────────────────── supporting records ───────────────────────── */
db.prepare("DELETE FROM preference").run();
db.prepare("INSERT INTO preference (id,minutes,time_of_day,week_start,theme) VALUES (1,30,'Morning',1,'system')").run();
const facts = [
  ["You learn philosophy best by writing a one-page note in your own words after reading.", "learning", "marx-e17"],
  ["Running early in the morning works better for you than evenings.", "practice", "run-e1"],
  ["You use a metronome whenever timing matters, in running cadence and in piano.", "practice", "piano-e3"],
  ["Recording yourself and listening back reveals problems you cannot hear while playing.", "practice", "piano-e11"],
  ["You like to connect new ideas to earlier ones; most notes link to another journey.", "learning", "plato-e16"],
  ["Evening sessions run best when kept under 45 minutes.", "preference", "plato-e8"],
];
facts.forEach(([text, kind], i) => db.prepare("INSERT INTO profile_fact VALUES (?,?,?,?,'active',?,NULL)").run(`fact-${i}`, text, kind, null, now));

const plan = (id, j, title, why, minutes, blocks) => {
  db.prepare("INSERT INTO plan_item VALUES (?,?,?,?,?,?,?,?,?)").run(id, j, day(0), title, why, JSON.stringify(blocks), "planned", minutes, now);
};
plan("plan-piano", "piano", "Chorus with a steady left hand", "The chord change into Am is where your pitch slips, so rehearse the timing before adding the voice.", 30, [
  {title: "Voice and breath warm-up", minutes: 8, instructions: "Lip trills, sirens, then five-note scales up to F4.", why: "Settles the voice and extends the top of your range.", skill_ids: ["piano-range", "piano-breath"]},
  {title: "Left hand alone with metronome", minutes: 10, instructions: "Play C - G - Am - F with the ballad pattern at 66, counting eighths aloud.", why: "Make the Am change land on time before you add singing.", skill_ids: ["piano-prog", "piano-comp"]},
  {title: "Sing the chorus", minutes: 12, instructions: "Hum first, then words. Mark one breath per two bars.", why: "Combine voice and hands at the tempo you already trust.", skill_ids: ["piano-sing", "piano-song1"]},
]);
plan("plan-run", "run", "Easy 30 plus strides", "Race is in three weeks. Keep the run easy and add four relaxed strides to keep your legs quick.", 35, [
  {title: "Walk and mobility", minutes: 5, instructions: "Brisk walk, leg swings, ankle circles.", why: "Warm the calves and shins that complained last month.", skill_ids: ["run-injury"]},
  {title: "Easy run", minutes: 25, instructions: "Conversational pace, cadence about 170.", why: "Bank mileage without stress.", skill_ids: ["run-easy", "run-cadence"]},
  {title: "Four strides", minutes: 5, instructions: "20 seconds relaxed fast, 40 seconds walk, repeat.", why: "Practice race-day rhythm.", skill_ids: ["run-strides"]},
]);
plan("plan-marx", "marx", "Derive surplus value without notes", "You can follow the numbers when given; the next step is producing them from the definitions.", 45, [
  {title: "Re-read Chapters 6 to 7 headings", minutes: 10, instructions: "Only the headings and the first paragraph of each section.", why: "Refresh the structure, not the detail.", skill_ids: ["marx-surplus"]},
  {title: "Derive on a blank page", minutes: 20, instructions: "Define necessary labour, surplus labour, v and s; compute s/v for a 12-hour day.", why: "Test your own explanation.", skill_ids: ["marx-surplus", "marx-labourvalue"]},
  {title: "Write two sentences on why the wage is both fair and exploitative", minutes: 15, instructions: "Use the market vs workplace distinction.", why: "The idea you stumbled on in October.", skill_ids: ["marx-class"]},
]);
plan("plan-plato", "plato", "The Good beyond being", "Last piece of the Republic's central trio of images: Sun, Line, Cave.", 40, [
  {title: "Reread Book VI, 507b-509c", minutes: 20, instructions: "Read the Sun passage aloud and underline every claim about the Good.", why: "Isolate exactly what Plato says.", skill_ids: ["plato-good"]},
  {title: "Write the argument in five steps", minutes: 20, instructions: "Premises only, no commentary.", why: "Prepares the essay on justice and the Good.", skill_ids: ["plato-good", "plato-king"]},
]);
const review = (j, id, a, b, body) => db.prepare("INSERT INTO review VALUES (?,?,?,?,?,?)").run(id, j, day(a), day(b), JSON.stringify(body), now);
review("run", "review-run", 14, 8, {headline: "The first long run changed what 'easy' means.", planned: 105, actual: 110, insights: [{title: "Pace", text: "Your even-pace runs are the ones you describe as enjoyable."}, {title: "Body", text: "The shin warning in week 5 passed once you cut volume by 10 percent."}, {title: "Next", text: "Keep one slower long run before the race and rehearse the breakfast."}], suggestions: []});
review("piano", "review-piano", 14, 8, {headline: "Chord changes are no longer the bottleneck; breath timing is.", planned: 150, actual: 165, insights: [{title: "Voice", text: "Recording yourself found the flat pitch before you could hear it."}, {title: "Hands", text: "Using the inversion C/G removed most of the hand movement into F."}, {title: "Next", text: "Add the bridge chords (Am7, Em) before adding the voice."}], suggestions: []});

/* atlas: import skills, then add the concepts, questions and connections between them */
ensureAtlas(); ensureRoutes(); ensureGuide();
const concepts = [
  ["marx", "c-dialectic", "Dialectic", "concept", "A way of reasoning through contradiction: Socratic questioning in Plato, Hegel's logic, and Marx's materialist version."],
  ["marx", "c-capitalism", "Capitalism", "topic", "A system of generalised commodity production for profit, defined by wage labour and the pursuit of ever-more capital."],
  ["marx", "c-exploitation", "Exploitation", "concept", "Extraction of surplus value from workers: unpaid surplus labour appropriated by capital."],
  ["marx", "q-determinism", "Is historical materialism deterministic?", "question", "Do forces of production fix history's course, or do people and politics shape it? See the Eighteenth Brumaire."],
  ["marx", "q-fair-wage", "How can a fair wage be exploitative?", "question", "Resolved only by separating market exchange from production."],
  ["plato", "c-ideal-state", "Kallipolis (the ideal city)", "topic", "The just city built in speech in Republic II to VII, with three classes mirroring the soul."],
  ["plato", "c-participation", "Participation", "concept", "How particulars relate to Forms; the weak point the Third Man exploits."],
  ["plato", "q-forms-where", "Where do the Forms exist?", "question", "Separate realm or immanent structure? Plato's language shifts between the dialogues."],
  ["plato", "q-justice-pays", "Does justice pay?", "question", "The challenge of Glaucon and Adeimantus the whole Republic answers."],
  ["run", "c-aerobic", "Aerobic base", "concept", "Fitness built from lots of easy running; the physiological reason slow running works."],
  ["run", "c-zones", "Heart rate zones", "concept", "Training intensities defined relative to maximum heart rate; most runs should sit in zone 2."],
  ["run", "c-overload", "Progressive overload", "concept", "Increasing load gradually so the body adapts; weekly jumps of about 10 percent."],
  ["run", "q-morning", "Is morning running better for me?", "question", "So far yes: more consistent, but needs earlier breakfast and a longer warm-up."],
  ["piano", "c-harmony", "Harmony", "topic", "How notes sound together and how chords move in a key."],
  ["piano", "c-diatonic", "Diatonic chords in a key", "concept", "The seven chords built on each scale degree; why I-IV-V and vi cover most songs."],
  ["piano", "c-voice-leading", "Voice leading", "concept", "Moving each note of a chord the shortest distance to the next chord; explains inversions."],
  ["piano", "c-resonance", "Vocal resonance", "concept", "Where the voice feels placed (chest, mask); affects tone and pitch stability."],
  ["piano", "q-time", "How do I keep time with the left hand while singing?", "question", "Open: let the left hand run on autopilot with the metronome while the voice floats."],
];
for (const [j, id, label, kind, description] of concepts) {
  const nid = "n-" + id;
  db.prepare("INSERT INTO atlas_node VALUES (?,?,?,?,?,NULL)").run(nid, label, kind, description, "user");
  db.prepare("INSERT INTO atlas_membership VALUES (?,?)").run(nid, j);
  event("create", "node", nid, null, {id: nid, label, kind, description, origin: "user"});
}
const N = id => "n-" + id, S = (j, k) => `legacy-${j}-${k}`;
const link = (a, b, kind, why, origin = "user") => { try { insertRelation(a, b, kind, why, origin); } catch (e) { console.warn("skip link:", a, b, kind, String(e.message)); } };
// within journeys
link(S("marx", "alienation"), N("c-capitalism"), "applies_to", "Alienation is Marx's description of what work feels like under capitalism.");
link(S("marx", "surplus"), N("c-exploitation"), "helps_understand", "Surplus value is the mechanism behind the claim that workers are exploited.");
link(N("c-exploitation"), N("c-capitalism"), "part_of", "Exploitation is a defining feature of capitalism in Marx's account.");
link(S("marx", "circuit"), N("c-capitalism"), "part_of", "The circuit of capital describes the system's drive to expand.");
link(S("marx", "basesuper"), N("q-determinism"), "related_to", "The determinism question is mostly a question about how strongly the base determines the superstructure.");
link(S("marx", "labourvalue"), N("q-fair-wage"), "helps_understand", "The 'fair wage' puzzle only dissolves with the value of labour power.");
link(N("c-dialectic"), S("marx", "hegel"), "part_of", "Hegel's dialectic is the source of the concept.");
link(S("marx", "histmat"), N("c-dialectic"), "applies_to", "Marx applies the dialectic to material history instead of ideas.");
link(S("plato", "justice"), N("c-ideal-state"), "part_of", "The city is built to find justice in the soul.");
link(S("plato", "king"), N("c-ideal-state"), "part_of", "Rule by those who know the Good is the top of Plato's city.");
link(S("plato", "forms"), N("c-participation"), "requires", "Forms only explain anything if particulars participate in them.");
link(S("plato", "thirdman"), N("c-participation"), "helps_understand", "The Third Man targets exactly what participation means.");
link(N("q-forms-where"), S("plato", "forms"), "related_to", "An open question about the status of the Forms.");
link(N("q-justice-pays"), S("plato", "justice"), "related_to", "The Republic is the extended answer to this question.");
link(N("c-dialectic"), S("plato", "socratic"), "related_to", "Socratic questioning is the oldest form of dialectic in this atlas.");
link(S("run", "easy"), N("c-aerobic"), "helps_understand", "Easy running builds the aerobic base that makes harder efforts possible.");
link(N("c-zones"), S("run", "easy"), "helps_understand", "Zone 2 is what 'easy' means physiologically.");
link(N("c-overload"), S("run", "injury"), "helps_understand", "The 10 percent rule is how overload stays safe.");
link(N("q-morning"), S("run", "fuel"), "related_to", "Morning running changes what and when I eat.");
link(S("piano", "maj"), N("c-diatonic"), "part_of", "Major triads are the I, IV and V chords of a key.");
link(S("piano", "min"), N("c-diatonic"), "part_of", "Minor triads are the ii, iii and vi chords of a key.");
link(N("c-diatonic"), N("c-harmony"), "part_of", "Diatonic chords are the vocabulary of harmony.");
link(S("piano", "inv"), N("c-voice-leading"), "applies_to", "Inversions are voice leading in practice: the hand moves as little as possible.");
link(N("c-resonance"), S("piano", "pitch"), "helps_understand", "Placement affects pitch stability.");
link(N("q-time"), S("piano", "sing"), "related_to", "Tied to the central problem of singing while playing.");
// across journeys: only links with a specific, defensible reason
link(S("marx", "ideology"), S("plato", "cave"), "cross_domain_bridge", "The Cave's prisoners mistake shadows for the real world because of how their world is set up; Marx says ruling ideas feel natural because of how society is organised. Both explain false consciousness structurally, but Marx names the material interests behind it.", "curated");
link(S("marx", "class"), S("plato", "justice"), "cross_domain_bridge", "Plato assigns citizens to classes by function and calls the result just; Marx says class division is the root of injustice. The same structure is read as harmony and as exploitation.", "curated");
link(N("c-dialectic"), N("c-ideal-state"), "cross_domain_bridge", "The Republic's method (propose a definition, test it against counterexamples, revise) is the form of reasoning Hegel and Marx later turn into a method of history.", "curated");
link(S("marx", "fetish"), S("plato", "cave"), "cross_domain_bridge", "Commodity fetishism, like the Cave, is a case where people take a surface appearance (prices, shadows) for how things really are.", "curated");
link(N("c-harmony"), S("plato", "timaeus"), "cross_domain_bridge", "Plato's world soul in the Timaeus is built from the same simple frequency ratios (2:1, 3:2, 4:3) that make octaves, fifths and fourths sound consonant.", "curated");
link(S("run", "cadence"), S("piano", "pulse"), "cross_domain_bridge", "Running cadence in steps per minute and a metronome beat are both about locking movement to a steady, external pulse.", "curated");
link(S("run", "breath"), S("piano", "breath"), "cross_domain_bridge", "Both skills rely on low, relaxed diaphragmatic breathing and a controlled exhale; practice on one transfers to the other.", "curated");
link(S("run", "recovery"), S("piano", "posture"), "cross_domain_bridge", "In both, tension is the enemy: relaxed shoulders and wrists make for efficient movement and for pain-free long-term practice.", "curated");

// observations on the new concept nodes, anchored to real entries
const obs = (nodeId, kind, j, entryIdx, quote, j2 = j) => {
  const e = journeys[j].entries.find(x => x.text.includes(quote));
  if (!e) throw new Error("obs quote missing: " + quote);
  db.prepare("INSERT INTO knowledge_observation VALUES (?,?,?,?,?,?,?,?,?)").run(randomUUID(), nodeId, kind, "log_entry", e.id, quote, e.created.slice(0, 10), e.created, j2);
};
obs(N("c-dialectic"), "self_report", "marx", 3, "a concept contains a contradiction that pushes it into a richer concept");
obs(N("c-dialectic"), "encountered", "plato", 1, "question, definition, counterexample, retreat");
obs(N("c-exploitation"), "explanation_in_own_words", "marx", 14, "The worker sells labour power for a day at its value");
obs(N("c-capitalism"), "encountered", "marx", 10, "M-C-M' means you spend money to get more money");
obs(N("q-determinism"), "difficulty_report", "marx", 15, "doubt the crude determinist reading");
obs(N("c-participation"), "encountered", "plato", 14, "if large things are large by partaking in Largeness");
obs(N("c-ideal-state"), "explanation_in_own_words", "plato", 5, "producers, auxiliaries, guardians");
obs(N("c-aerobic"), "self_report", "run", 3, "That is what easy actually feels like");
obs(N("c-overload"), "worked_example", "run", 18, "Dropped weekly volume 10 percent on purpose");
obs(N("c-diatonic"), "encountered", "piano", 15, "Got the I-V-vi-IV in C and G and tried it in D too".includes("I-V-vi-IV") ? "I-V-vi-IV in C and G" : "");
obs(N("c-voice-leading"), "worked_example", "piano", 8, "The hand moves less and the changes are smoother");
obs(N("c-resonance"), "encountered", "piano", 5, "Breath: inhale low");

// routes: one active route per journey, steps point at the atlas nodes they concern
const route = (j, steps) => {
  const ch = db.prepare("SELECT id FROM charter WHERE journey_id=?").get(j).id, id = `route-${j}`;
  db.prepare("INSERT INTO learning_route VALUES (?,?,?,1,'active',NULL,?)").run(id, j, ch, now);
  steps.forEach((s, i) => db.prepare("INSERT INTO route_step VALUES (?,?,?,?,?)").run(`${id}-s${i}`, id, s.node, i, JSON.stringify({key: s.key, title: s.title, necessity: s.necessity, reason: s.reason, approach: s.approach, minutes: s.minutes, dependencies: s.dependencies ?? []})));
};
route("marx", [
  {key: "surplus", node: S("marx", "surplus"), title: "Surplus value", necessity: "core", reason: "Everything in your goal about exploitation depends on being able to derive it yourself.", approach: "Derive s/v from the definitions on a blank page, then read Capital Ch. 9.", minutes: 60, dependencies: []},
  {key: "circuit", node: S("marx", "circuit"), title: "The circuit of capital", necessity: "core", reason: "Explains why accumulation never stops, the second half of the critique.", approach: "Work through Harvey's lecture on Ch. 4, then Ch. 4 itself.", minutes: 60, dependencies: ["surplus"]},
  {key: "state", node: S("marx", "state"), title: "Marx on the state", necessity: "helpful_context", reason: "Needed to judge the political claims, not the economic ones.", approach: "Eighteenth Brumaire sections 1 and 7.", minutes: 80, dependencies: []},
  {key: "influence", node: S("marx", "influence"), title: "Later Marxism", necessity: "optional_tangent", reason: "Useful once you have the originals; skip if time is short.", approach: "One article each on Lenin, Gramsci and the Frankfurt School.", minutes: 90, dependencies: ["circuit"]},
]);
route("plato", [
  {key: "good", node: S("plato", "good"), title: "The Form of the Good", necessity: "core", reason: "The Cave and Line only make sense once the Good is clear.", approach: "Reread 507b-509c and write the argument in five steps.", minutes: 40, dependencies: []},
  {key: "king", node: S("plato", "king"), title: "Philosopher-kings", necessity: "core", reason: "Connects knowledge to rule and answers 'does justice pay?'.", approach: "Book VII, 519c-521b and the argument against rule by the ignorant.", minutes: 60, dependencies: ["good"]},
  {key: "third", node: S("plato", "thirdman"), title: "The Third Man", necessity: "helpful_context", reason: "Plato's own objection; you can't defend the Forms without it.", approach: "Parmenides 130e-135c, then a short secondary summary.", minutes: 60, dependencies: []},
  {key: "timaeus", node: S("plato", "timaeus"), title: "Timaeus and cosmology", necessity: "optional_tangent", reason: "Interesting link to harmony and your piano journey, but not necessary for the Republic.", approach: "Read the passage on the world soul's musical ratios only.", minutes: 45, dependencies: []},
]);
route("run", [
  {key: "long", node: S("run", "long"), title: "One more long slow run", necessity: "core", reason: "Builds the margin that makes 5K feel easy on race day.", approach: "45 to 50 minutes, easy pace, a small bottle.", minutes: 50, dependencies: []},
  {key: "fuel", node: S("run", "fuel"), title: "Fuelling and hydration", necessity: "core", reason: "A practice breakfast before the long run tests the race-day plan.", approach: "Oats and a banana two hours before; note how you feel at 20 minutes.", minutes: 15, dependencies: []},
  {key: "race", node: S("run", "race"), title: "Race-day routine", necessity: "core", reason: "Reduces nerves and avoids a too-fast first kilometre.", approach: "Write a one-page plan: arrival, warm-up, pace for km 1.", minutes: 30, dependencies: ["fuel"]},
  {key: "hills", node: S("run", "hills"), title: "Hill running", necessity: "optional_tangent", reason: "Only if the parkrun course has a climb.", approach: "Two short hill repeats after an easy run.", minutes: 30, dependencies: []},
]);
route("piano", [
  {key: "sing", node: S("piano", "sing"), title: "Singing while playing chords", necessity: "core", reason: "The core of your goal; everything else supports it.", approach: "Left hand on autopilot with the metronome; hum first, then words.", minutes: 30, dependencies: []},
  {key: "seventh", node: S("piano", "seventh"), title: "Seventh chords", necessity: "core", reason: "The bridge of 'Let It Be' uses Am7 and Em.", approach: "G7 and Am7 each ten times, then in the song.", minutes: 20, dependencies: []},
  {key: "transpose", node: S("piano", "transpose"), title: "Transposing to fit my voice", necessity: "helpful_context", reason: "The wedding song will need a key that suits your voice, not the record.", approach: "Try one song up and down three semitones and note where the chorus sits.", minutes: 30, dependencies: ["sing"]},
  {key: "ear", node: S("piano", "ear"), title: "Hearing chord quality by ear", necessity: "optional_tangent", reason: "Helpful for learning songs without sheet music.", approach: "Ear game with a friend, 10 rounds, twice a week.", minutes: 10, dependencies: []},
]);

// guide conversations: one per journey with the interview that created the goal
const convo = (j, title, turns) => {
  const cid = `convo-${j}`;
  db.prepare("INSERT INTO guide_conversation VALUES (?,?,?,?,?,?)").run(cid, j, title, "active", stamp(70), now);
  turns.forEach(([role, md], i) => db.prepare("INSERT INTO guide_turn VALUES (?,?,?,?,?,?,?)").run(`${cid}-t${i}`, cid, role, md, "{}", "[]", stamp(70 - i)));
};
convo("marx", "Understanding Marx", [
  ["user", "I want to understand Marx."],
  ["guide", "Which part pulls at you: the philosophy (alienation, history), the economics of Capital, or his political influence?"],
  ["user", "The critique of capitalism, but I keep running into Hegel and I don't know how much I need."],
  ["guide", "A short introduction to Hegel's dialectic is enough for this goal: Marx reworks it rather than adopting it, so you only need the idea that contradictions drive development. I'd treat Hegel's full system as optional. Want a route that starts with alienation and goes to Capital?"],
]);
convo("plato", "Reading Plato", [
  ["user", "I'd like to read Plato properly. I only know the Cave."],
  ["guide", "Do you want an overview of the main arguments, or a close reading of one text? The Republic is the centre of his thought and takes about two months at a few evenings a week."],
  ["user", "Close reading of the Republic with a few earlier dialogues for context."],
  ["guide", "Then Euthyphro and Meno first, to get used to how Socrates argues, then the Republic in order. I'd park the Timaeus and Parmenides until the Republic is done, with one exception: the Third Man is worth knowing early."],
]);
convo("run", "A first 5K", [
  ["user", "I want to run a 5K. I can jog about two minutes."],
  ["guide", "A good first target is the parkrun on 12 December. That gives about ten weeks. Do you want a fixed plan or something that adapts to how your runs go?"],
  ["user", "Adaptive, three mornings a week. My left knee complains."],
  ["guide", "Run/walk intervals, easy pace and a cadence near 170 are the three things that matter most for the knee. I'd add two short strength sessions and keep weekly jumps under 10 percent."],
]);
convo("piano", "Sing and play chords", [
  ["user", "I want to accompany myself on the piano while I sing."],
  ["guide", "What does success look like: a song for a friend, a performance, or just enjoying it? And what do you already know?"],
  ["user", "Three songs by April for my sister's wedding. I know a few chords and can sing in tune when I'm not playing."],
  ["guide", "Then the plan is chord vocabulary, smooth changes with a metronome, and singing the melody over a left hand that no longer needs attention. Recording yourself is the single most useful habit for this."],
]);

// notebook pages
const wikiLink = l => `[[${l}]]`;
const note = (id, title, kind, journey, body) => {
  const r = storeDocument({id, base: null, title, body, kind, journey});
  db.prepare("UPDATE document_revision SET extraction_status='done' WHERE id=?").run(r.revision);
  const t = stamp(Math.floor(Math.random() * 3), 20); db.prepare("UPDATE document SET updated_at=? WHERE id=?").run(t, id);
};
note("doc-surplus", "Surplus value, step by step", "note", "marx", `# Surplus value, step by step

Linked to ${wikiLink("Surplus value")}, ${wikiLink("Labour theory of value")} and ${wikiLink("Commodities, use value and exchange value")}.

A working day is $T$ hours. The worker sells **labour power**, and its value equals the labour time needed to reproduce the worker, $t_n$ (necessary labour time). The remainder is surplus labour time:

$$ t_s = T - t_n $$

The **rate of surplus value** is the ratio of surplus to necessary labour:

$$ \\frac{s}{v} = \\frac{t_s}{t_n} $$

Example: $T = 12$, $t_n = 6$, so $t_s = 6$ and $s/v = 100\\%$.

## Why the wage is "fair" and still exploitative
- In the market: labour power is bought and sold at its value. Equal exchange, nobody cheated.
- In production: the worker produces value for $T$ hours but is paid for $t_n$.

> The hidden abode of production: the sphere of exchange is "a very Eden of the innate rights of man." (Capital, Ch. 6)

## Still unclear
1. How does this change when productivity rises? (relative surplus value, Ch. 12)
2. Where is the line between surplus value and profit?
`);
note("doc-alienation-ideology", "Alienation, fetishism, ideology: one thread?", "reflection", "marx", `# Alienation, fetishism, ideology: one thread?

The early Marx says the worker is estranged from the product. In Capital the same idea shows up as ${wikiLink("Commodity fetishism")}: people relate to each other through things. Gramsci's ${wikiLink("Ideology")} adds that the arrangement stays in place because it feels like common sense.

| Concept | Where | What appears natural |
| --- | --- | --- |
| Alienated labour | 1844 Manuscripts | That my work belongs to someone else |
| Commodity fetishism | Capital Ch. 1 | That prices are properties of things |
| Ideology | German Ideology / Gramsci | That the ruling ideas are just ideas |

Compare with Plato's ${wikiLink("Allegory of the Cave")}, which I think is doing the same job.
`);
note("doc-cave-line", "Cave and Line side by side", "note", "plato", `# Cave and Line side by side

| Line (VI) | Cave (VII) |
| --- | --- |
| eikasia: images | shadows on the wall |
| pistis: belief | the objects carried past the fire |
| dianoia: thought | leaving the cave, seeing reflections |
| noesis: understanding | the sun itself, the ${wikiLink("The Form of the Good")} |

Education is the **turning around** of the soul, not the insertion of knowledge ("${wikiLink("Allegory of the Cave")}", 518c).

## Questions
- Why does Plato think the returning prisoner would be laughed at?
- Is there a modern equivalent of the fire?
`);
note("doc-justice", "Does justice pay? My notes so far", "exploration", "plato", `# Does justice pay?

The question in Republic II: is the just person happier than the unjust, *even if* they were to lose their reputation and be tortured?

1. ${wikiLink("Justice in the Republic")} is harmony of the parts of the soul (reason, spirit, appetite).
2. The unjust soul is at war with itself.
3. So a just person is, in a real sense, healthy.

I find (2) and (3) weak. A person can have a ruthless, disciplined soul. Plato needs reason to rule *because it knows the Good*, which is why the argument cannot be separated from the ${wikiLink("Theory of Forms")}.
`);
note("doc-week-6", "Weeks 1 to 8: what I learned", "reflection", "run", `# Weeks 1 to 8

| Week | Longest run | Notes |
| --- | --- | --- |
| 1 | 2 min jog | Breath was the limit |
| 3 | 5 min | Cadence of 170 helped |
| 5 | 20 min | First continuous run |
| 7 | 30 min | Even pacing |
| 8 | 45 min | First long run |

**Three things that worked**

1. ${wikiLink("Easy conversational pace")}: slower than I wanted.
2. ${wikiLink("Cadence around 170 steps/min")}: with a metronome app.
3. Cutting volume by 10 percent when my shin complained.

**For race day:** oats and a banana two hours before, easy first kilometre, no watch looking until kilometre 2.
`);
note("doc-chords", "Chord cheat sheet", "note", "piano", `# Chord cheat sheet

| Chord | Notes | Fingering |
| --- | --- | --- |
| C | C E G | 1 3 5 |
| F | F A C | 1 3 5 |
| G | G B D | 1 3 5 |
| Am | A C E | 1 3 5 |

Inversions keep the hand still: ${wikiLink("Chord inversions")} (C/E, C/G).

## "Let It Be" in C

\`\`\`
C   G   Am   F
C   G   F   C
\`\`\`

Breathe after each two-bar phrase. Practise the left hand alone first: ${wikiLink("Comping patterns")}.
`);
note("doc-bridge", "Plato, harmony and why 3:2 sounds good", "exploration", "piano", `# Plato, harmony and why 3:2 sounds good

The Timaeus builds the world soul from the ratios 2:1, 3:2 and 4:3. These are the octave, the fifth and the fourth.

On a string, halving the length raises the pitch an octave. A fifth is two-thirds of the length: $f_2 / f_1 = 3/2$.

That is why ${wikiLink("Harmony")} in a key is built on I, IV and V: the roots are related by fifths and fourths.

Connects to my Plato reading: ${wikiLink("Timaeus and cosmology")}.
`);

// materials: what each goal is actually learned from, with where the learner is up to
const mat = (goal, kind, title, creator, status, pointer, notes = "") => addMaterial(goal, {kind, title, creator, status, pointer, notes, origin: "user_added"});
mat("marx", "book", "Capital, Volume 1", "Karl Marx (trans. Ben Fowkes)", "using", "Part 8, ch. 26 (primitive accumulation)", "Penguin edition. Chapters 1 to 10 done; reading Part 8 now.");
mat("marx", "book", "A Companion to Marx's Capital", "David Harvey", "using", "Lecture on chapter 4", "Lecture-by-lecture guide, good for the commodity chapters.");
mat("marx", "book", "The Communist Manifesto", "Karl Marx and Friedrich Engels", "done", "Finished, annotated", "Read once at school, re-read with notes.");
mat("marx", "article", "Gramsci on hegemony: a summary article", "", "queued", "", "To read before touching Gramsci himself.");
mat("plato", "book", "Republic", "Plato (trans. Grube, rev. Reeve)", "using", "Book VII, 518c (the Cave)", "Main text. Keep Stephanus numbers in the margin.");
mat("plato", "book", "Five Dialogues", "Plato (trans. Grube)", "done", "Euthyphro, Meno, Phaedo read", "");
mat("plato", "book", "Plato: A Very Short Introduction", "Julia Annas", "queued", "", "Companion for context, not a substitute for the dialogues.");
mat("run", "course", "Couch to 5K nine-week plan", "NHS", "done", "Weeks 1 to 8 done, adapted", "Followed in spirit; adapted around knee.");
mat("run", "video", "Parkrun first-timer's guide", "parkrun", "using", "Course map watched", "Course map and what to expect on the day.");
mat("run", "exercise", "Strength routine: calves, glutes, core", "Own routine", "using", "Two 15-minute sessions a week", "Calf raises 3x15, bridges 3x12, plank 3x30s.");
mat("piano", "book", "Alfred's Adult All-in-One Piano Course", "Willard Palmer et al.", "using", "Level 1, p. 58 (seventh chords)", "For reading practice and basic chord work.");
mat("piano", "video", "Piano chords for singers: lesson series", "Playlist", "using", "Lesson 7 of 12 (ballad patterns)", "The comping patterns come from here.");
mat("piano", "book", "The Contemporary Singer", "Anne Peckham", "using", "Warm-up set B", "Warm-ups and breath exercises; the sirens are from here.");
mat("piano", "app", "Metronome app", "", "using", "", "Set to 66 to 72 for the ballad pattern.");

db.prepare("UPDATE journey SET last_seen_at=? WHERE id IN ('piano','run','marx','plato')").run(stamp(0, 8));
const counts = Object.fromEntries(["journey", "skill", "log_entry", "skill_event", "atlas_node", "atlas_relation", "knowledge_observation", "document", "learning_route", "guide_turn", "resource"].map(t => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]));
console.log("Seeded showcase data:", counts);
