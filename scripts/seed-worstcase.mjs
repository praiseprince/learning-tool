// Dev-only worst-case data for UI checks (break-ui). Run on a SCRATCH database that already has the showcase data. Never on real data.
// Every value is plausible (something a learner or the Guide could really produce) or sits at the schema limit
// (goal title 80, skill 80, phase 60, material title 200, url 400, pointer 140, plan step title 60, instructions 300).
// Goals added: a long-titled philosophy goal with everything maxed out, a Japanese goal, an Arabic (RTL) goal,
// a brand-new goal with nothing in it, a goal with exactly one of everything, and enough extra goals to fill the switcher.
import {randomUUID} from "node:crypto";
import {format, subDays} from "date-fns";
import {sqlite as db} from "../lib/db/client.ts";
import {createGoal} from "../lib/v2/brief.ts";
import {addMaterial} from "../lib/v2/materials.ts";
import {storeDocument} from "../lib/v2/notebook.ts";
import {addEvent} from "../lib/chat/events.ts";

if (!process.env.DATABASE_URL || /data\/app\.db$/.test(process.env.DATABASE_URL)) throw new Error("Point DATABASE_URL at a scratch database, never data/app.db.");
const now = new Date().toISOString(), day = n => format(subDays(new Date(), n), "yyyy-MM-dd");
const cut = (s, n) => s.slice(0, n);
const brief = b => { const d = {why: "", doneLooksLike: "", constraints: "", roadmap: [], materials: [], ...b};
  d.skills = d.skills.map(k => ({...k, name: cut(k.name, 80), requires: k.requires.map(r => cut(r, 80))})); d.roadmap = d.roadmap.map(r => ({...r, phase: cut(r.phase, 60)})); return d; };
const log = (goal, text, minutes, ago) => { const id = randomUUID(); db.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,kind,occurred_on,created_at) VALUES (?,?,?,?,'practice',?,?)").run(id, goal, text, minutes, day(ago), now); return id; };
// Same rows as storePlan in lib/db/plans.ts (not importable from plain Node).
const storePlan = (journey, plan) => { const id = randomUUID(), minutes = plan.blocks.reduce((s, b) => s + b.minutes, 0);
  db.prepare("INSERT INTO proposal VALUES (?,?,'session_plan',?,'applied',?,?,?)").run(id, journey, JSON.stringify(plan), "chat", now, now);
  db.prepare("INSERT INTO plan_item VALUES (?,?,?,?,?,?,'planned',?,?)").run(id, journey, day(0), plan.title, plan.why, JSON.stringify(plan.blocks), minutes, now); return id; };
const proposal = (goal, kind, payload) => { const id = randomUUID(); db.prepare("INSERT INTO proposal VALUES (?,?,?,?,'pending','agent',?,NULL)").run(id, goal, kind, JSON.stringify(payload), now); return id; };

// 1. Everything at the limit.
const HEGEL = "Read Hegel’s Phenomenology of Spirit: Preface, Introduction, Consciousness, Self"; // 80
createGoal("w-hegel", brief({
  title: cut(HEGEL, 80),
  goal: "Read the Phenomenology of Spirit closely enough to explain, in my own words and without notes, how sense-certainty collapses into perception, why the master–slave dialectic is about recognition rather than domination, and what Hegel means when he says that the true is the whole.",
  why: "I keep meeting Hegel second-hand (Marx, Kojève, Žižek, Butler, Pippin) and I want to stop relying on summaries.",
  doneLooksLike: "I can lead a 90-minute reading group on §§166–230 without a secondary source open.",
  currentPosition: "You have read the Preface twice with Pinkard’s translation and Houlgate’s commentary, but §§1–72 still blur together: you can paraphrase ‘the true is the whole’ and ‘substance is also subject’ but cannot yet reconstruct the argument against picture-thinking. Sense-certainty (§§90–110) is clear; perception is shaky; force and the understanding (§§132–165) is where you stall every time, usually around the ‘inverted world’. You read in 25-minute blocks at night and annotate in the margins of a paper copy, then copy the best marginalia into notes on Sundays.",
  constraints: "Evenings only, 25–40 minutes, Sundays longer. Paper copy plus Kindle; no reading group nearby.",
  skills: [
    {name: "Sense-certainty and the ‘This’ (§§90–110)", description: "", status: "have", level: 4, evidence: "", requires: []},
    {name: "Perception: the thing and its properties, the ‘Also’ and the ‘One’ (§§111–131)", description: "", status: "have", level: 2, evidence: "", requires: ["Sense-certainty and the ‘This’ (§§90–110)"]},
    {name: "Force and the Understanding, including the supersensible ‘inverted world’ (§§132–65)", description: "", status: "target", level: 1, evidence: "", requires: []},
    {name: "Selbstbewusstsein: die Wahrheit der Gewissheit seiner selbst", description: "", status: "target", level: 0, evidence: "", requires: []},
    {name: "Master and slave (Herrschaft und Knechtschaft)", description: "", status: "target", level: 0, evidence: "", requires: []},
    {name: "Stoicism", description: "", status: "target", level: 0, evidence: "", requires: []},
    {name: "Skepticism", description: "", status: "target", level: 0, evidence: "", requires: []},
    {name: "The unhappy consciousness", description: "", status: "target", level: 0, evidence: "", requires: []},
    {name: "Aufhebung", description: "", status: "have", level: 3, evidence: "", requires: []},
    {name: "Picture-thinking (Vorstellung) vs. the concept (Begriff)", description: "", status: "have", level: 1, evidence: "", requires: []},
    {name: "Why ‘substance is also subject’", description: "", status: "have", level: 2, evidence: "", requires: []},
    {name: "Recognition (Anerkennung) in Fichte and Hegel", description: "", status: "target", level: 0, evidence: "", requires: []},
  ],
  roadmap: [
    {phase: "Preface: the true is the whole, and why method can’t come first", focus: "", outcomes: [], skills: []},
    {phase: "Introduction: the examination of knowing", focus: "", outcomes: [], skills: []},
    {phase: "Sense-certainty", focus: "", outcomes: [], skills: []},
    {phase: "Perception", focus: "", outcomes: [], skills: []},
    {phase: "Force and the Understanding: appearance and the inverted world", focus: "", outcomes: [], skills: []},
    {phase: "Self-consciousness and desire", focus: "", outcomes: [], skills: []},
    {phase: "Lordship and bondage", focus: "", outcomes: [], skills: []},
    {phase: "Stoicism, skepticism, unhappy consciousness", focus: "", outcomes: [], skills: []},
    {phase: "Reason: observing nature", focus: "", outcomes: [], skills: []},
    {phase: "Lead a reading group on §§166–230", focus: "", outcomes: [], skills: []},
  ],
}));
const M = [
  addMaterial("w-hegel", {title: "The Phenomenology of Spirit (Cambridge Hegel Translations), translated and edited by Terry Pinkard, with a facing-page German text and a glossary of key terms (Cambridge University Press, 2018)", kind: "book", creator: "G. W. F. Hegel, trans. Terry Pinkard", url: "https://www.cambridge.org/core/books/georg-wilhelm-friedrich-hegel-the-phenomenology-of-spirit/2E1C5C8B5C9D4A0C8B9A1F7E3D6C4B2A?utm_source=newsletter&utm_medium=email&utm_campaign=hegel-translations-2018-spring-catalogue&utm_content=phenomenology-of-spirit-pinkard-baur", pointer: "§143, the paragraph that starts ‘This true essence of things has now the character…’ (p. 87, second half of the inverted-world section)", status: "using"}),
  addMaterial("w-hegel", {title: "Hegel’s Phenomenology of Spirit: A Reader’s Guide", kind: "book", creator: "Stephen Houlgate", url: "", pointer: "", status: "using"}),
  addMaterial("w-hegel", {title: "Lecture 7", kind: "video", creator: "", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL8dPuuaLjXtNgK6MZucdYldNkMybYIHKR&index=7&t=1834s", pointer: "34:12", status: "using"}),
  addMaterial("w-hegel", {title: "Stanford Encyclopedia of Philosophy: Hegel’s Dialectics", kind: "article", creator: "Julie E. Maybee", url: "https://plato.stanford.edu/entries/hegel-dialectics/", pointer: "Section 3", status: "next"}),
  addMaterial("w-hegel", {title: "Pippin, Hegel on Self-Consciousness: Desire and Death in the Phenomenology of Spirit", kind: "book", creator: "Robert B. Pippin", url: "", pointer: "", status: "next"}),
];
const mid = M.map(m => typeof m === "string" ? m : m?.id).filter(Boolean);
for (let d = 0; d < 9; d++) log("w-hegel", "Read §§" + (132 + d * 3) + "–" + (134 + d * 3) + " twice, out loud the second time.", 25 + d * 5, d);

const plan = storePlan("w-hegel", {
  title: cut("Force and the Understanding: the inverted world, slowly, out loud", 60),
  why: "You stall at §157 every time. Tonight is about getting through it once, in order, and writing what you think the ‘inverted world’ is before you check Houlgate.",
  coming_up: [],
  blocks: [
    {title: "Re-read the end of perception (§§128–131) as a run-up", minutes: 6, instructions: "Read it aloud. Underline every ‘Also’ and ‘One’.", why: "", skill_ids: [], material_id: mid[0] ?? null, where: "§128 to §131"},
    {title: cut("Force as the unity of its expression and its being-driven-back-into-itself", 60), minutes: 12, instructions: cut("Paragraph by paragraph: after each one, write a single sentence in the margin that starts ‘So…’. If you cannot write it, mark the paragraph with a question mark and keep going; do not stop to look anything up, the point is to see the whole movement once before you take it apart again on Sunday with Houlgate open beside you. Then compare.", 300), why: "", skill_ids: [], material_id: mid[0] ?? null, where: cut("§136–§143, and stop at the paragraph that starts ‘This true essence of things has now the character…’ even if it feels unfinished", 160)},
    {title: "Inverted world", minutes: 8, instructions: "Write half a page: what is inverted, and relative to what?", why: "", skill_ids: [], material_id: mid[2] ?? null, where: "34:12"},
    {title: "Check against Houlgate", minutes: 4, instructions: "", why: "", skill_ids: [], material_id: null, where: ""},
  ],
});

// A plan stored before the limits were tightened (too long for today's schema): must not break the thread.
const legacy = storePlan("w-hegel", {title: "Old plan", why: "", coming_up: [], blocks: [{title: "Read", minutes: 20, instructions: "Read slowly. ".repeat(40), why: "", skill_ids: [], material_id: null, where: ""}]});

// The thread, oldest first.
const G = "w-hegel";
addEvent(G, "plan", {plan: legacy});
addEvent(G, "user", {text: "https://plato.stanford.edu/entries/hegel-dialectics/#ThreSideLogi+https://www.cambridge.org/core/books/georg-wilhelm-friedrich-hegel-the-phenomenology-of-spirit/introduction/2E1C5C8B5C9D4A0C8B9A1F7E3D6C4B2A is this the same dialectic as in the Preface?"});
addEvent(G, "guide", {markdown: "Mostly, but not quite. The SEP entry describes the **three-sided** form from the *Encyclopaedia Logic* (§§79–82): the understanding, the dialectical (negatively rational) moment and the speculative (positively rational) moment. The Preface is more polemical: it attacks method as something you could state *before* doing the work.\n\n| Text | Where | What ‘dialectic’ names | How it’s usually misread |\n|---|---|---|---|\n| Preface | §§1–72 | the movement of the subject matter itself | as a three-step recipe: thesis–antithesis–synthesis |\n| *Encyclopaedia Logic* | §§79–82 | three moments of every logical concept | as a timeline |\n\nSo when you read §57 again, watch for this sentence:\n\n> “The true is the whole. But the whole is nothing other than the essence consummating itself through its development.”\n\nA useful exercise is to try writing it as code and seeing why it fails:\n\n```\nfor moment in [understanding, dialectical, speculative]:\n    concept = moment(concept)  # wrong: the moments are not steps\n```\n\nSee also https://plato.stanford.edu/entries/hegel-dialectics/#HegeDescHisDialMeth for the citation.", sources: [{kind: "note", ref: "Note: Preface, second pass (marginalia from p. 12–31, copied on Sunday 16 November)", quote: "the true is the whole — but whole of WHAT? the process or the result? Hegel says both and I don’t see how that isn’t a contradiction"}, {kind: "session", ref: "Session 18 Nov", quote: ""}, {kind: "web", ref: "https://plato.stanford.edu/entries/hegel-dialectics/", quote: ""}]});
addEvent(G, "user", {text: "photos of my marginalia from tonight", files: ["IMG_20261118_214533_HDR_Phenomenology_marginalia_p112-115.jpg", "IMG_20261118_214602.jpg", "scan-0001.pdf", "notes (1) (2) final FINAL.md"]});
addEvent(G, "guide", {markdown: "I couldn’t finish that review: the agent stopped after 5 minutes without a result. Your files are saved; try again, or send fewer pages at once.", tone: "error"});
addEvent(G, "suggestions", {ids: [
  proposal(G, "agent_material", {suggestion: {kind: "course", cost: "either", title: "Hegel’s Phenomenology of Spirit: a complete paragraph-by-paragraph lecture course (Gregory B. Sadler, 2014–2022), with timestamps for every section and a reading list for each lecture", creator: "Gregory B. Sadler", why: "Covers force and the understanding paragraph by paragraph, which is exactly where you stall.", url: "https://www.youtube.com/playlist?list=PL4gvlOxpKKIgR4OyOt31isknkVH2Kweq2&si=6Hk2dn2l9tQ0aYw2"}, check: {ok: true}}),
  proposal(G, "agent_material", {suggestion: {kind: "article", cost: "free", title: "A", creator: "", why: "", url: ""}, check: {ok: false}}),
  proposal(G, "agent_action", {type: "add_note", title: "Note: the inverted world, in your own words, with the three readings (Hyppolite, Pinkard, Houlgate) side by side so you can see where they disagree", body: "## The inverted world\n\n" + "Hegel’s ‘inverted world’ (§§157–160) is the point where the understanding, having posited a supersensible world of laws behind appearances, finds that this second world is simply the first one turned upside down. ".repeat(6), why: "", url: ""}),
  proposal(G, "agent_evidence", {skill: "", skillName: "Force and the Understanding, including the supersensible ‘inverted world’ (§§132–65)", quote: "The law is supposed to be calm, but the calm only exists because the understanding keeps producing the difference and then cancelling it, so the ‘calm kingdom of laws’ is itself a movement", hint: 2, entry: null, doc: null}),
]});
addEvent(G, "user", {text: "I have 25 min"});
addEvent(G, "plan", {plan});
addEvent(G, "note", {title: "Practice sheet: twenty one-sentence glosses on §§132–165, with the answer key on a separate page so you can test yourself on Sunday", doc: null, files: [{title: "glosses-132-165.pdf", href: "#"}, {title: "answer-key-do-not-open-until-sunday.pdf", href: "#"}]});
addEvent(G, "user", {text: "Ich habe heute §§157–160 gelesen und verstehe immer noch nicht, warum die verkehrte Welt nicht einfach nur eine Spiegelung ist. Also: if the supersensible world is just the sensible one inverted, then what exactly did the understanding gain by positing it? It seems like a wasted step. I re-read Houlgate’s chapter 4 and he says the point is that the understanding learns that difference is internal, not that there are two worlds, but I don’t see where Hegel actually says that rather than Houlgate saying it on his behalf. Is this a case where the commentary is doing the philosophy? I’m also not sure whether I should keep going to self-consciousness or stay here another week.".repeat(1)});
addEvent(G, "minutes", {note: ""});

// 2. Non-Latin scripts.
createGoal("w-jlpt", brief({title: "日本語能力試験 N3 に合格する 🇯🇵", goal: "JLPT N3 に合格したい。", currentPosition: "ひらがなとカタカナは読めます。漢字は約300字。聴解が一番弱い。", skills: [{name: "漢字 (N3, 約650字)", description: "", status: "target", level: 1, evidence: "", requires: []}, {name: "聴解", description: "", status: "target", level: 0, evidence: "", requires: []}], roadmap: [{phase: "文法 N4 の復習", focus: "", outcomes: [], skills: []}, {phase: "聴解: 毎日 15 分", focus: "", outcomes: [], skills: []}]}));
createGoal("w-arabic", brief({title: "تعلم الخط العربي: النسخ والثلث", goal: "أريد أن أكتب آية قصيرة بخط الثلث بشكل جميل.", currentPosition: "أعرف الحروف المنفصلة بخط النسخ، والوصل ما زال صعباً.", skills: [{name: "حروف النسخ المنفصلة", description: "", status: "have", level: 3, evidence: "", requires: []}, {name: "الوصل في خط الثلث", description: "", status: "target", level: 0, evidence: "", requires: []}], roadmap: [{phase: "النسخ: الحروف والوصل", focus: "", outcomes: [], skills: []}]}));

// 3. Brand new: nothing at all yet.
createGoal("w-new", brief({title: "Swim", goal: "Swim.", currentPosition: "", skills: [{name: "Floating", description: "", status: "target", level: 0, evidence: "", requires: []}]}));

// 4. Exactly one of everything (pluralisation).
createGoal("w-one", brief({title: "Juggle three balls", goal: "Juggle a three-ball cascade for one minute.", currentPosition: "You can do the two-ball exchange.", skills: [{name: "Cascade", description: "", status: "target", level: 1, evidence: "", requires: []}], roadmap: [{phase: "Three-ball cascade", focus: "", outcomes: [], skills: []}], materials: [{title: "Juggling for the Complete Klutz", kind: "book", creator: "John Cassidy", url: "", notes: ""}]}));
log("w-one", "Two-ball exchange, 10 minutes.", 1, 0);

// 5. A full switcher: a realistic number of goals for an enthusiastic learner.
for (const [id, t] of [["w-a", "Bake sourdough"], ["w-b", "Learn to touch type at 80 wpm"], ["w-c", "Statistics for the A/B tests at work"], ["w-d", "Sketch people in cafés"], ["w-e", "Conversational Portuguese (Brazil) before the trip in March"], ["w-f", "Rust"]])
  createGoal(id, brief({title: t, goal: t + ".", currentPosition: "", skills: [{name: t, description: "", status: "target", level: 0, evidence: "", requires: []}]}));

// Notes at the limits.
storeDocument({id: "w-note-long", base: null, title: cut("Why the inverted world is not just a mirror image: three readings (Hyppolite, Pinkard, Houlgate) compared paragraph by paragraph, with my own attempt at the end and a list of the places where I still think Houlgate is putting words in Hegel’s mouth", 240), body: "See [[Force and the Understanding, including the supersensible ‘inverted world’ (§§132–65)]].\n\n$$\\text{Law} = \\text{difference that is no difference}$$", kind: "note", journey: "w-hegel"});
storeDocument({id: "w-note-empty", base: null, title: "", body: "", kind: "note", journey: "w-new"});
console.log("worst-case data added");
