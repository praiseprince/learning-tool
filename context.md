> **Superseded in part:** the visual design (sections 7-8: paper, ink, highlighter, hairlines) is replaced by `DESIGN.md`. Product behaviour and data sections remain a reference for V1.

# Marginalia: product, design and build context

Working name: **Marginalia** (placeholder; keep the name in one constant, `APP_NAME`).

## Contents

0. How to use this file
1. What the app is
2. Vocabulary
3. Flows
4. Data model
5. AI layer
6. Design direction
7. Design tokens
8. Typography
9. Layout and navigation
10. Signature components
11. Screens
12. Motion
13. Copy and voice
14. Engineering conventions
15. Build phases
16. Demo data and visual verification
17. AGENTS.md stub

---

## 0. How to use this file

You are the coding agent building this app. This file is the single source of truth for what to build and how it should look.

- Where this file conflicts with your defaults (component-library looks, dashboard layouts, colors, fonts, copy), this file wins.
- Build in the phases of section 15, one at a time. At the start of each phase, restate its goal and list anything ambiguous. Do not guess on design.
- The UI is specified, not suggested. Values come from section 7 and 8 (tokens and type). Structure comes from the wireframes in section 11. If they disagree, tokens win for values and wireframes win for structure.
- Never call a UI task done until you have verified it visually (section 16).
- Ask before adding a dependency that is not listed in section 14.
- Keep `AGENTS.md` short and point it at this file (stub in section 17).

---

## 1. What the app is

Marginalia is a personal learning companion that works for any subject. The user has goals (play piano, learn physics, run a 10k). For each goal, the app keeps a **goal**, a **map of skills**, a running **journal**, and a **plan**.

The user logs freely in their own words ("worked on bar 12 left hand, still stumbling"). The AI reads it, works out what moved, keeps a short, current picture of where the user is, and sketches the next session. Every change the AI wants to make is shown to the user as a suggestion, and nothing is applied until the user approves it.

The first journey will be piano, but **nothing in the code, copy or assets may be subject-specific**. Piano appears only in demo data.

### Principles

1. **Logging takes under 30 seconds.** If it ever feels like work, the product fails.
2. **The AI proposes, the user approves.** No silent changes to skills, goal, state or profile.
3. **Save first, understand later.** An entry is stored the moment it is submitted. AI processing happens after and may fail without losing anything.
4. **The journal is the truth.** Entries are immutable. Everything else (state, skill levels, reviews) is derived and can be rebuilt.
5. **Improvised, not scheduled.** Only the next session is concrete. The user can always say "I only have 15 minutes" and get a different plan.
6. **Quiet.** No streak guilt, no badges, no confetti, no push for engagement. Rest is a first-class thing to log.

### Non-goals for the MVP

Social features, gamification, built-in courses or content, multi-user accounts, push notifications, native apps, a graph view of skill prerequisites (store the data, do not draw it yet).

---

## 2. Vocabulary

Use these exact words in the UI and keep the code names aligned.

| UI word | Code name | Meaning |
|---|---|---|
| Journey | `journey` | One goal being pursued (for example Piano). |
| Goal | `charter` | The refined goal: why, what done looks like, constraints, starting point. Versioned. |
| Entry | `log_entry` | One thing the user logged. Immutable. |
| Journal | (view) | All entries and reviews for a journey. |
| Skills | `skill` | The AI-generated, user-editable map of what to learn. |
| Where you are | `state_snapshot` | A short living summary (about 120 words) of the user's position, what works, what is stuck. |
| Session | `plan_item` | A planned practice made of timed blocks. |
| Review | `review` | A look back over a period, with suggested adjustments. |
| Suggested changes | `proposal` | Changes the AI wants to make, awaiting approval. |

**Levels** (0 to 5): 0 Not started, 1 Aware, 2 Attempting, 3 Getting there, 4 Reliable, 5 Second nature.

**Evidence** (how much logged proof backs a level): *penciled in* (thin), *building*, *inked* (solid). Computed in code, never by the AI (see 5.7).

---

## 3. Flows

### 3.1 New journey (`/new`)

Full-screen, one step at a time. A short three-part indicator sits at the top because this is a true sequence.

1. **Tell me.** One large textarea: "What do you want to learn, and why now? Rough is fine." An optional second field: "Where are you starting from?" [Continue]
2. **A few questions.** The AI returns 3 to 5 questions specific to what the user wrote (never generic). Each has 2 to 4 tap answers plus a free-text field. Every question can be skipped. At most 2 rounds. [Continue]
3. **Draft.** Shows the goal (fields editable inline), the skills (grouped list; each has a starting-level control and an on/off toggle), and "What I'll remember about you" (profile facts, each with a checkbox). The user also picks the journey's highlighter color from six swatches (default: the first unused). Primary action: [Start journey]. This creates the journey, goal v1, skills, accepted profile facts, and an empty state.

### 3.2 Daily loop

1. **Home** shows the proposed session for today. It is generated in the background on first open of the day and after each accepted entry. Show a skeleton for up to 3 seconds, then the plan.
2. **Adjust (optional).** The user taps the time chips on Home or opens **Plan today** to give time, energy and a note. The session regenerates.
3. **Focus mode.** The user starts the session and works through the blocks. Finishing opens **Log** with minutes and block titles pre-filled as draft text.
4. **Log.** The user writes or speaks. [Save entry] stores it immediately. AI extraction starts in the background.
5. **Understood panel.** When extraction is ready, a panel shows what the AI took from the entry (time, skills touched with proposed level changes, one line for "where you are"). Each row has a checkbox, all on by default. The AI may ask **at most one** clarifying question, only if the answer changes the result, shown as 2 to 3 tap answers.
6. **Looks right** applies the checked changes (skills, state, next session). Strokes draw in (section 12). A toast offers Undo for 8 seconds.
7. **Rest day.** A quick action on Home ("Took a rest day") creates a `rest` entry with no AI call. Rest never breaks anything.

### 3.3 Review

Created on demand (Journal, Reviews tab, "Write this week's review"). Home quietly offers one when the week has 3 or more entries and no review. A review includes a headline, three insights, planned-versus-actual time, and suggested changes (for example "You planned 5 hours a week and averaged 2. Adjust the timeline or the scope?"). The user can accept each suggestion separately.

### 3.4 Failure and edge cases

- **Offline or AI failure:** the entry is already saved. Mark extraction `failed`, show a small "Try again" row on that entry in the Journal, retry automatically on next app open. Never block the user.
- **Schema validation failure:** retry once, feeding the validation error back to the model. If it fails again, mark `failed`.
- **Back-dating:** the Log screen has a date control (default today). Multiple entries per day are allowed; minutes add up.
- **User edits win:** the user can edit skills (level, name), the goal, and "Where you are" directly. Direct edits are saved as `user_edited_at` and the AI must never overwrite them without a suggested change.
- **Empty states** are specified per screen in section 11.

---

## 4. Data model

SQLite via Drizzle for the MVP. IDs are text (ULID). Timestamps are ISO strings in UTC. `occurred_on` and `date` are local calendar dates (`YYYY-MM-DD`). Every table has `user_id text not null default 'local'` so multi-user can come later without a rewrite (omitted below for brevity).

```sql
profile(id, prefs_json, updated_at)
  -- prefs_json: { typical_minutes, preferred_time, week_starts_on, theme }

profile_fact(id, text, kind, source_entry_id, status, created_at, edited_at)
  -- kind: 'learning_style' | 'schedule' | 'motivation' | 'obstacle' | 'background' | 'other'
  -- status: 'active' | 'deleted'. One plain sentence each, e.g. 'Prefers short sessions in the morning.'

journey(id, name, domain, hue, start_date, status, last_seen_at, created_at)
  -- hue: one of 100 (yellow), 355 (pink), 150 (green), 215 (cyan), 55 (orange), 300 (violet)
  -- status: 'active' | 'paused' | 'archived'

charter(id, journey_id, version, goal, why, done_looks_like, deadline, constraints, starting_point, note, created_at)
  -- every edit creates a new row; the highest version is current

skill(id, journey_id, parent_id, name, description, level, prereq_ids_json, archived, user_edited_at, created_at, updated_at)
  -- level 0..5. Max tree depth 2 (category > skill). prereq_ids_json is stored but not drawn in the MVP.

skill_event(id, skill_id, entry_id, level_after, delta, evidence_quote, at)
  -- append-only history. Drives the sparkline, evidence, and the 'what moved' highlighting.

log_entry(id, journey_id, raw_text, minutes, energy, mood, kind, occurred_on, created_at)
  -- IMMUTABLE. kind: 'practice' | 'rest' | 'note'. energy: 'low' | 'medium' | 'high' | null.

log_extraction(id, entry_id, status, json, created_at)
  -- status: 'pending' | 'ready' | 'applied' | 'discarded' | 'failed'

state_snapshot(id, journey_id, summary, changed_phrases_json, source_entry_id, user_edited_at, created_at)
  -- the newest row is current

plan_item(id, journey_id, date, title, why, blocks_json, status, requested_minutes, created_at)
  -- status: 'proposed' | 'started' | 'done' | 'skipped'

review(id, journey_id, period_start, period_end, body_json, created_at)

proposal(id, journey_id, kind, diff_json, status, source_ref, created_at, resolved_at)
  -- kind: 'skill_level' | 'skill_new' | 'state' | 'charter' | 'profile_fact'
  -- status: 'pending' | 'accepted' | 'edited' | 'rejected' | 'undone'
  -- source_ref: entry id or review id that produced it

rollup(id, journey_id, period, period_start, summary, created_at)
  -- period: 'week' | 'month'
```

Derived values (computed in code, never stored, never produced by the AI):

- **Day number:** `differenceInCalendarDays(today, journey.start_date) + 1`.
- **Week minutes per day:** sum of `log_entry.minutes` grouped by `occurred_on`.
- **Evidence:** see 5.7.
- **What moved:** anything with `at` or `created_at` later than `journey.last_seen_at`. Update `last_seen_at` when the user has viewed Home for 3 seconds and then navigates away.

---

## 5. AI layer

### 5.1 Provider interface

All model calls happen on the server. Never call a provider from client code and never expose keys.

```ts
interface LLMProvider {
  generate<T>(args: {
    system: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    schema: ZodType<T>;          // every response is structured and validated
    tools?: Tool[];              // optional, for bounded agent runs
    maxSteps?: number;           // default 1; agent tasks use 4
  }): Promise<T>;
}
```

- Implement adapters for OpenAI and Anthropic. Choose with `AI_PROVIDER` (`openai` | `anthropic`). Read the model name from `AI_MODEL`. Do not hardcode model names; document sensible defaults in `.env.example` after checking the provider's current docs.
- Convert Zod schemas to the provider's structured-output format. Validate again with Zod on return.
- On validation failure, retry once with the error message appended. Then fail gracefully (3.4).
- Keep prompts in `/prompts/*.md` as versioned text files with a `{{placeholder}}` syntax. Never inline long prompts in code.

### 5.2 Context builder

One function, `buildContext(journeyId, task)`, assembles what each call sees, in this order, with a hard budget (approximate tokens as characters divided by 4):

| Layer | Budget |
|---|---|
| Profile facts (active) and prefs | 500 |
| Current goal (charter) | 600 |
| Current "where you are" | 400 |
| Skills (name, level, evidence label) | 600 |
| Entries from the last 7 days (raw text, newest first) | 1500 |
| Rollups (weekly, then monthly) | 800 |
| Retrieved older entries (keyword match for MVP) | 800 |

Truncate from the bottom of the list. Unit test it with a long synthetic history.

### 5.3 Tasks

| Task | Prompt file | Output schema | Trigger |
|---|---|---|---|
| Interview questions | `interview.md` | `InterviewQuestions` | After onboarding step 1 |
| Goal draft | `goal_draft.md` | `GoalDraft` (goal fields, skill tree, profile facts) | After onboarding step 2 |
| Log extraction | `log_extraction.md` | `LogExtraction` | After an entry is saved |
| State update | `state_update.md` | `StateUpdate { summary, changed_phrases[] }` | When the user accepts an extraction |
| Session plan | `session_plan.md` | `SessionPlan` | Home open, regenerate, after accept |
| Weekly review | `weekly_review.md` | `ReviewReport` | On demand |
| Rollup | `rollup.md` | `{ summary }` | On app open if a finished week has no rollup |

### 5.4 Core schemas

```ts
export const LogExtraction = z.object({
  minutes: z.number().int().min(0).max(600).nullable(),
  kind: z.enum(['practice', 'rest', 'note']),
  energy: z.enum(['low', 'medium', 'high']).nullable(),
  mood: z.string().max(40).nullable(),
  skills: z.array(z.object({
    skill_id: z.string().nullable(),          // null when proposing a new skill
    new_skill_name: z.string().max(60).nullable(),
    level_after: z.number().int().min(0).max(5),
    evidence_quote: z.string().max(160),      // the user's own words
    note: z.string().max(140),
  })).max(8),
  obstacles: z.array(z.string().max(120)).max(4),
  wins: z.array(z.string().max(120)).max(4),
  state_note: z.string().max(240),            // one line to fold into 'where you are'
  clarifying_question: z.object({
    question: z.string().max(140),
    options: z.array(z.string().max(40)).min(2).max(3),
  }).nullable(),
});

export const SessionPlan = z.object({
  title: z.string().max(60),                  // shown as the Home headline
  why: z.string().max(240),                   // 1 to 2 sentences, grounded in recent entries
  total_minutes: z.number().int().min(5),
  blocks: z.array(z.object({
    id: z.string(),
    title: z.string().max(60),
    minutes: z.number().int().min(1),
    instructions: z.string().max(300),
    why: z.string().max(160),
    skill_ids: z.array(z.string()),
  })).min(1).max(5),
  coming_up: z.array(z.string().max(100)).max(2),   // rough direction for the next 1 to 2 sessions
});
// Code must normalize block minutes so they sum exactly to total_minutes,
// and total_minutes must equal the requested minutes.

export const Proposal = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('skill_level'), skill_id: z.string(), from: z.number(), to: z.number(), evidence_quote: z.string(), reason: z.string() }),
  z.object({ kind: z.literal('skill_new'), name: z.string(), parent_id: z.string().nullable(), level: z.number(), reason: z.string() }),
  z.object({ kind: z.literal('state'), before: z.string(), after: z.string(), changed_phrases: z.array(z.string()), reason: z.string() }),
  z.object({ kind: z.literal('charter'), field: z.string(), before: z.string(), after: z.string(), reason: z.string() }),
  z.object({ kind: z.literal('profile_fact'), text: z.string(), reason: z.string() }),
]);
```

Define `InterviewQuestions`, `GoalDraft`, `StateUpdate` and `ReviewReport` in the same file with the same discipline: short bounded strings, no free-form blobs.

### 5.5 Agent tools

Used only by `session_plan` and `weekly_review`, with `maxSteps` of 4. Tools are read-only except `propose_change`.

- `read_state()`, `read_skills()`
- `search_entries(query, limit)`, returning entry ids, dates and excerpts
- `read_rollups(from, to)`
- `propose_change(Proposal)`, which writes a `proposal` row with status `pending`. It never changes real data.

### 5.6 Proposals

- Applying a proposal happens in one DB transaction in `lib/domain/apply.ts`, is idempotent, and stores before-values in `diff_json` so it can be reversed.
- **Undo** (8-second toast, and later from the Journal) applies the inverse and sets status `undone`.
- Accepting an extraction creates `skill_event` rows, updates `skill.level`, writes a new `state_snapshot`, and triggers a new `session_plan`.

### 5.7 Evidence (computed)

```ts
// per skill, from skill_event rows
const weight = (ageDays: number) => Math.exp(-ageDays / 21);
const evidence = Math.min(1, events.reduce((s, e) => s + weight(ageDays(e.at)), 0) / 3);
// label: evidence < 0.35 -> 'penciled in', < 0.7 -> 'building', else 'inked'
```

### 5.8 Voice rules for AI-written text

Put these in every prompt.

- Second person, plain words, at most 2 sentences per field.
- Be specific: quote or paraphrase the user's own entries. Never invent an entry, a number or a skill the user did not mention. If an entry does not say something, do not infer it.
- No praise filler ("Great job!"), no exclamation marks, no emojis, no hedging pile-ups.
- For physical domains (running, strength), suggest rest when the user reports pain or fatigue, and suggest a professional for injury. Do not diagnose.
- State uncertainty plainly ("I only have one entry on this, so I'm penciling it in").

Good: "Bar 12 left hand has come up in three entries. Today stays on it for 15 minutes, slowly."
Bad: "Awesome work! Keep crushing it!"

### 5.9 Evals

`/evals` contains at least 12 messy sample entries across piano, physics and running with loose expected fields. `npm run evals` checks schema validity and key extractions. It needs an API key and does not run in CI.

---

## 6. Design direction

**Subject and job.** A private journal that turns messy notes into visible progress. It is used in short moments, mostly on a phone, usually right after practicing. It must feel calm, trustworthy and quick.

**Concept: a notebook that gets highlighted.** Ink on cool paper. Apart from error red, the only color in the interface is highlighter ink, and highlighter ink is used for exactly one thing: marking the user's progress.

This is the one memorable element. Everything else stays quiet and disciplined.

### Rules that make it coherent

1. **Highlighter ink is data, never decoration.** It appears in week lines (minutes practiced), skill strokes (levels), inline marks (what changed). It never colors a button, tab, link, border or background.
2. **Actions are ink.** Primary buttons are near-black ink on paper (paper on ink in dark mode). Selection states use ink.
3. **Double pass means "this moved."** Anything that changed since the user last looked is marked a second time in the deeper highlighter shade.
4. **Pencil means uncertain or intended.** Thin evidence and planned-but-not-done things are drawn in dashed pencil. Established and done things are drawn in solid highlighter.
5. **Margin layout.** Journal-like pages put dates and minutes in a left margin column and prose in a narrow main column, like notes beside a page.
6. **One color per journey.** Each journey is one of six highlighter colors, set as `--hue` on the app wrapper. The rest of the UI is identical across journeys.

### Defaults we deliberately avoid

If you catch yourself producing any of these, stop and re-read this file.

- A warm cream background with a display serif and a terracotta accent.
- A near-black background with one neon accent.
- Content chopped into identical rounded cards with the same soft shadow. Use whitespace and hairlines. Surfaces with elevation are only sheets and popovers.
- A tracked-out ALL-CAPS label above every heading.
- Meta strings joined with middle dots ("A · B · C"), monospace for small labels, arrows appended to button text.
- Numbered markers where the content is not a sequence.
- Gradients as decoration, glassmorphism, emoji as icons.
- Fade-and-slide-up entrances on sections, hover lifts on rows.
- Component-library defaults (shadcn or Radix look) left unrestyled.

### If an earlier design file exists

If the repo already contains a `DESIGN.md` or tokens that use a cream background, Fraunces, or an ember accent, delete them. This file replaces them.

---

## 7. Design tokens

Put these in `app/globals.css` and map them into the Tailwind theme. Components use tokens only. No raw hex values and no arbitrary pixel values in components.

```css
:root {
  color-scheme: light;

  /* paper and ink */
  --paper: #F2F4F7;
  --paper-sunk: #E8ECF1;      /* input wells, skeletons */
  --surface: #FFFFFF;         /* sheets and popovers only */
  --ink: #0F1B33;
  --ink-2: #35405A;
  --muted: #5C6680;           /* AA on paper; use for secondary text */
  --faint: #8D96AB;           /* decoration only, never text */
  --rule: #D9DEE7;            /* hairlines */
  --rule-strong: #C3CAD7;
  --focus: #0F1B33;

  /* highlighter: set --hue on a wrapper per journey */
  --hue: 100;
  --mark: oklch(0.90 0.15 var(--hue));
  --mark-deep: oklch(0.80 0.17 var(--hue));   /* second pass: what moved */
  --mark-ink: #0F1B33;                        /* text on a mark is always this */

  --danger: oklch(0.52 0.17 25);
  --danger-soft: oklch(0.95 0.03 25);

  /* spacing (4px base). Use only these. */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 72px;
  --gutter: 20px;             /* page side padding on mobile */

  /* radii by role. Not one radius for everything. */
  --r-input: 12px;
  --r-pop: 14px;
  --r-sheet: 28px;
  --r-pill: 999px;

  /* elevation: sheets and popovers only */
  --shadow-sheet: 0 -8px 40px rgb(15 27 51 / 0.12);
  --shadow-pop: 0 8px 28px rgb(15 27 51 / 0.14);

  /* motion */
  --ease-out: cubic-bezier(0.2, 0.7, 0.2, 1);
  --dur-1: 120ms; --dur-2: 200ms; --dur-3: 320ms; --dur-draw: 420ms;
}

/* Dark: a deep ink-blue desk, not near-black. Same hues, deeper marks. */
:root[data-theme='dark'] {
  color-scheme: dark;
  --paper: #0D1424;
  --paper-sunk: #091020;
  --surface: #141C30;
  --ink: #E7ECF5;
  --ink-2: #C0C8D8;
  --muted: #94A0B8;
  --faint: #5E6A84;
  --rule: #222C44;
  --rule-strong: #303C58;
  --focus: #E7ECF5;
  --mark: oklch(0.82 0.14 var(--hue));
  --mark-deep: oklch(0.72 0.16 var(--hue));
  --mark-ink: #0F1B33;        /* still dark ink: text on a mark stays dark */
  --danger: oklch(0.72 0.15 25);
  --danger-soft: oklch(0.28 0.06 25);
  --shadow-sheet: 0 -1px 0 var(--rule-strong);
  --shadow-pop: 0 0 0 1px var(--rule-strong);
}
```

Theme handling: the user's choice (Light, Dark, System) is stored in `profile.prefs_json.theme`. A tiny inline script in `<head>` resolves it (using `matchMedia('(prefers-color-scheme: dark)')` for System) and sets `data-theme` on `<html>` to `light` or `dark` before first paint, so there is no flash. Listen for system changes while the choice is System. The CSS therefore needs only the `:root` block (light) and the `:root[data-theme='dark']` block.

**Journey hues** (store the number in `journey.hue`): yellow 100, pink 355, green 150, cyan 215, orange 55, violet 300. Set `style={{'--hue': journey.hue}}` on the app shell.

**Mark (inline highlight)**

```css
.mark {
  background: var(--mark);
  color: var(--mark-ink);
  padding: 0 0.2em;
  margin: 0 -0.2em;
  border-radius: 3px 8px 4px 7px;        /* irregular, like a real stroke */
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.mark--deep { background: var(--mark-deep); }   /* what moved since last look */
```

**Focus ring** (all interactive elements): `box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--focus); outline: none;` shown on `:focus-visible`.

**Touch targets:** 44px minimum, including icon buttons.

---

## 8. Typography

Two families, clearly different.

- **Interface and headings: Bricolage Grotesque** (variable; weights 400 to 700, width axis 80 to 100, optical size auto). Load with `next/font/google`. If an axis is not supported by `next/font`, drop that axis.
- **Reading text: Literata** (variable; weights 400 to 600, optical size auto). Everything the user wrote or the AI wrote as prose is set in Literata. Writing in a serif signals "journal".

Fallbacks: UI `'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif`. Reading `'Literata', Georgia, 'Times New Roman', serif`.

| Role | Family | Size / line | Weight | Notes |
|---|---|---|---|---|
| display-1 | Bricolage | `clamp(36px, 10.5vw, 52px)` / 1.05 | 600 | tracking -0.02em, width 90. Home headline, onboarding prompts. |
| display-2 | Bricolage | 30 / 1.1 | 600 | tracking -0.015em. Screen titles. |
| display-3 | Bricolage | 22 / 1.2 | 600 | tracking -0.01em. Section titles ("This week", "Where you are"). |
| ui | Bricolage | 15 / 1.4 | 500 | Buttons, chips, rows. |
| ui-small | Bricolage | 13 / 1.4 | 500 | Muted meta text. |
| reading | Literata | 17 / 1.65 | 400 | Entries, where you are, goal, review prose. Max width 66ch. |
| reading-small | Literata | 15 / 1.6 | 400 | Secondary prose, evidence quotes. |
| timer | Bricolage | 88 / 1 | 600 | Each digit in a fixed-width span so it never jitters. |

Rules:

- Sentence case everywhere. No all caps. No letter-spaced small labels.
- Section titles are display-3 headings, not tiny eyebrow labels above other headings.
- Emphasis uses weight (600), not italics or color.
- Run-in heads in prose (a bold first phrase) are allowed in Reviews.
- Use `font-variant-numeric: tabular-nums` where the font supports it; otherwise use fixed-width spans for changing numbers.
- Line length under 66 characters for reading text.

---

## 9. Layout and navigation

**Mobile (under 900px)** is the primary target (design at 390 wide).

- Side padding is `--gutter` (20px). Content max width 560px, centered on tablets.
- Top bar 56px: journey pill on the left, day number on the right.
- Bottom nav 64px plus `env(safe-area-inset-bottom)`: Home, Journal, **Log** (center), Skills, You.
- Log is a 56px circle, ink fill, paper-colored pen icon, sitting 12px above the bar with a 4px paper ring. It is navigation chrome and does not count as the screen's primary action.

**Desktop (900px and up)**

- Left rail 232px: journey pill at the top, a primary [Log an entry] button, then Home, Journal, Skills, You.
- Content area uses a margin column (144px, muted, holds dates, minutes and small meta) and a main column (max 680px). On Skills, main widens to 880px and the skill drawer is a right-hand panel (400px) instead of a bottom sheet.
- Journal-like pages (Journal, Review, Goal, Home's "Where you are") use the margin column. On mobile the margin content moves above the main text as muted ui-small.

**Nav item style:** icon (lucide, 1.5 stroke, 22px) plus a 12px sentence-case label. Active is ink with weight 600. Inactive is `--muted`. No highlighter on nav.

**Routes**

```
/                         redirects to /j/[activeId] or /new
/new                      onboarding
/j/[id]                   Home
/j/[id]/plan              Plan today
/j/[id]/focus             Focus mode (no bottom nav)
/j/[id]/log               Log and Understood panel
/j/[id]/journal           Entries and Reviews tabs
/j/[id]/journal/[entryId] Entry detail
/j/[id]/skills            Skills (drawer is a query param ?skill=)
/j/[id]/review/[reviewId] Review
/j/[id]/goal              Goal (charter)
/you                      Profile and settings
/styleguide               Every component and state (dev only)
```

---

## 10. Signature components

Build these once, in `components/ui` or `components/marks`, and reuse everywhere.

### 10.1 WeekLines

Seven rows, one per day, in the user's week order. Each row is 28px tall:
`[day label 40px] [ruled line with highlighter stroke] [minutes, right-aligned]`.

- The line is a 1px `--rule` hairline. The stroke sits on it: 12px tall, `--mark`, radius `2px 6px 3px 5px`.
- Stroke length is proportional to minutes, with 90 minutes filling the full line width. Cap at full.
- Today's label is ink and weight 600. Future days show only the label and hairline.
- A `rest` entry draws no stroke and shows the word "rest" in muted text.
- Minutes text is always present ("25 min"). Color is never the only carrier of meaning.
- Tapping a row opens that day's entries in the Journal.
- Planned time for today (the current session) is drawn as a dashed pencil outline stroke ahead of the actual stroke.

### 10.2 SkillRow and SkillStroke

Row height 60px. Left: skill name (ui) and the level name (ui-small, muted). Right: a stroke on a hairline track, 120px wide on mobile and 200px on desktop. Track has 5 faint tick marks.

- Stroke length is `level / 5` of the track.
- **Evidence styling:** inked (evidence 0.7 and up) is solid `--mark`. Building (0.35 to 0.7) is solid `--mark` at 70% opacity. Penciled in (under 0.35) is hatched `repeating-linear-gradient(135deg, var(--mark) 0 3px, transparent 3px 6px)` with a 1px dashed `--muted` outline.
- **Moved since last look:** the gained part of the stroke is drawn a second time in `--mark-deep`.
- Level 0 draws no stroke, only an empty track.
- The row also exposes level and evidence to screen readers: "Getting there, level 3 of 5, building evidence."

### 10.3 Mark

An inline component that wraps text with the `.mark` styles. In "Where you are", wrap each string in `changed_phrases` (exact substring match against the summary; ignore any that do not match) with `<Mark deep>` when it changed since `last_seen_at`.

### 10.4 SessionBlocks

A list of rows: start offset in the margin (`0:00`, `0:05`, `0:20`, tabular, muted), title (ui), minutes at the right ("15 min", muted). Hairline between rows. Tapping a row expands the instructions (reading-small) and the "why" line. Offsets are a real sequence, so they replace numbering.

### 10.5 Composer

The text area for entries. Borderless, on paper, set in Literata 17px, caret in ink, auto-growing, min 8 lines on the Log screen. Placeholder rotates through domain-spread examples (see section 13). A sticky row beneath holds: mic button, a minutes chip, an energy chip, a [Rest day] ghost action. All chips are optional; the AI infers what is blank. `Cmd/Ctrl+Enter` saves.

Voice: use the browser speech-recognition API where available and hide the mic where it is not.

### 10.6 UnderstoodPanel

A sheet that shows what the AI took from an entry (wireframe in 11.5). Rows:

- **Time:** a minutes stepper.
- **Each skill:** checkbox, skill name, level change drawn as a small SkillStroke before and after, and the user's own words as a short quote in reading-small.
- **Where you are:** the proposed new sentence, with the changed phrase marked.
- **One optional question** with 2 to 3 tap answers.
- Footer: primary [Looks right], ghost [Edit], and a ghost [Keep entry only] that discards the suggested changes.

### 10.7 SuggestedChanges

Used in Reviews and the goal draft. Each item: a one-line description, a before and after (before in `--muted`, after in ink with a `.mark` on what changed), a "why" line, and [Accept] [Edit] [Dismiss]. Items resolve independently.

### 10.8 Base primitives

- **Button.** Primary: ink fill, paper text, pill, 48px tall on mobile, weight 600, 24px horizontal padding. Secondary: transparent, 1.5px ink border, pill. Ghost: no border, ink text. Danger: ghost with `--danger` text. Disabled: 40% opacity. Pressed: `scale(0.98)` over 80ms.
- **Chip.** 36px pill, 1px `--rule-strong` border, ui text. Selected: ink fill, paper text.
- **Input and Textarea.** `--paper-sunk` fill, 1px transparent border, radius `--r-input`. On focus, 1.5px ink border.
- **Sheet.** `--surface`, top radius `--r-sheet`, `--shadow-sheet`, drag handle 36x4 in `--rule-strong`. Draggable to dismiss. Becomes a popover (`--r-pop`) on desktop where specified.
- **Toast.** Ink fill, paper text, pill, bottom-center above the nav, with an inline Undo action. Auto-dismiss after 8 seconds when it has Undo, 4 otherwise.
- **Skeleton.** `--paper-sunk` bars with a slow opacity pulse (1.4s, 0.5 to 1). No shimmer gradients.
- **EmptyState.** One line of direction in ui weight 600, one sentence of help in reading-small, at most one action. No illustrations.
- **Sparkline.** 1.5px ink SVG path with a 4px dot at each event. No axes and no fill.

---

## 11. Screens

All wireframes are mobile (390 wide). `▓` is highlighter, `░` is pencil, `─` is a hairline. Desktop follows section 9.

### 11.1 Home (`/j/[id]`)

```
┌──────────────────────────────────┐
│ ● Piano ▾                 Day 23 │
│                                  │
│ Left hand, slowly.               │  display-1
│ Bar 12 has come up in three      │  reading-small
│ entries, so today stays small.   │
│                                  │
│ 0:00  Warm-up scales       5 min │
│ ──────────────────────────────── │
│ 0:05  Bar 12, left hand   15 min │
│ ──────────────────────────────── │
│ 0:20  Play-through        10 min │
│                                  │
│ (15)  (30)  (60)  (Other)        │
│ [         Start session        ] │
│                                  │
│ This week                        │  display-3
│ Mon  ▓▓▓▓▓▓▓────────────  25 min │
│ Tue  ▓▓▓▓▓▓▓▓▓▓▓▓────────  40 min│
│ Wed  rest                        │
│ Thu  ░░░░░░──────────────  today │
│ Fri                              │
│ Sat                              │
│ Sun                              │
│ Took a rest day                  │  ghost
│                                  │
│ Where you are                  ✎ │  display-3
│ Sight-reading is improving, and  │  reading, marks on
│ ▓bar 12 is still the snag▓.      │  changed phrases
│ Updated Tuesday                  │  ui-small muted
│                                  │
│ Coming up                        │  display-3
│ Hands together, bars 9 to 16     │
├──────────────────────────────────┤
│ Home  Journal  (Log)  Skills  You│
└──────────────────────────────────┘
```

- Headline is `SessionPlan.title` and the line below it is `SessionPlan.why`. Do not highlight any word in the headline.
- Time chips set `requested_minutes` and regenerate the session after a 600ms debounce. The selected chip defaults to the plan's minutes.
- [Start session] goes to Focus mode. It is the only primary button on the screen.
- If a review is available, show one muted row above "This week": "Your week is ready to look back on" with a ghost [Open review].
- "Where you are" is editable inline (pencil). Direct edits set `user_edited_at`.
- **Brand-new journey:** the session is generated from the goal and skills. "This week" shows empty lines with the note "Entries you log fill these in." "Where you are" shows the starting point from the goal.
- **Loading:** skeleton for the headline and three block rows.
- **Error generating a session:** keep the last session if one exists; otherwise show "Couldn't plan a session. You can still log an entry." with ghost [Try again].

### 11.2 Plan today (`/j/[id]/plan`)

```
┌──────────────────────────────────┐
│ ✕                                │
│ Plan today                       │  display-2
│                                  │
│ How long?                        │  display-3
│ (10) (20) (30) (45) (60) (Other) │
│                                  │
│ How's your energy?               │  display-3
│ ( Low )( Medium )( High )        │
│                                  │
│ Anything the plan should know?   │  textarea
│ ┌──────────────────────────────┐ │
│ └──────────────────────────────┘ │
│ [       Plan my session        ] │
└──────────────────────────────────┘
```

After generating, the same screen shows the session (SessionBlocks) with refinement chips (Make it easier, Shorter, Different focus) and a primary [Start session]. Each chip calls `session_plan` with a `refinement` value and replaces the plan. A new plan is a new `plan_item`.

### 11.3 Focus mode (`/j/[id]/focus`)

No bottom nav. Keep the screen awake while open (Screen Wake Lock API, ignore if unsupported).

```
┌──────────────────────────────────┐
│ ✕                  Block 2 of 3  │
│                                  │
│ Bar 12, left hand                │  display-2
│ Slow, hands separate. Stop at    │  reading
│ the first stumble and repeat     │
│ that beat five times.            │
│                                  │
│            14:20                 │  timer
│                                  │
│ Skip          Pause    [  Done ] │
└──────────────────────────────────┘
```

- The timer counts down the block's minutes. It is optional (a ghost "Hide timer" toggle). At zero, do not auto-advance; show a subtle pulse on [Done] only if reduced motion is off.
- Progress is saved (`plan_item.status = 'started'`, current block index in `localStorage`) so a refresh does not lose it.
- After the last block: heading "Session finished", primary [Log it] (opens Log with minutes and block titles as draft text), ghost [Skip logging].

### 11.4 Log (`/j/[id]/log`)

```
┌──────────────────────────────────┐
│ ✕                      Today ▾   │
│                                  │
│ Worked on bar 12 with the left   │  Literata 17
│ hand. Still stumbling, but I got │
│ through the page once.|          │
│                                  │
│                                  │
│ ──────────────────────────────── │
│ (mic)  30 min   Energy   Rest day│
│ [          Save entry          ] │
└──────────────────────────────────┘
```

- [Save entry] stores the entry at once and closes the keyboard. The screen then transitions to the Understood panel. If the AI is slow, show the panel in a skeleton state and stay interactive.
- The date control defaults to Today and allows back-dating.
- Empty submit is disabled. A single word is a valid entry.

### 11.5 Understood panel (sheet over Log)

```
┌──────────────────────────────────┐
│ Here's what I took from that     │  display-3
│                                  │
│ Time              ( − ) 30 min (+)│
│ ──────────────────────────────── │
│ ☑ Left hand, bar 12              │
│   Attempting, stays at 2  ▓▓░░░  │
│   'still stumbling'              │  reading-small
│ ──────────────────────────────── │
│ ☑ Sight-reading                  │
│   Attempting to Getting there    │
│   ▓▓░░░  to  ▓▓▓░░               │
│   'got through the whole page'   │
│ ──────────────────────────────── │
│ ☑ Where you are                  │
│   Bar 12 is still the snag, but  │
│   reading has ▓got steadier▓.    │
│ ──────────────────────────────── │
│ Was the 30 minutes all piano?    │
│ (Yes) (About 20) (Mostly theory) │
│                                  │
│ [ Looks right ]   Edit   Keep    │
│                         entry only│
└──────────────────────────────────┘
```

- Unchecked rows are not applied. [Looks right] applies the checked rows, then runs the marking animation (section 12) and shows a toast: "Entry saved. Plan updated."
- If nothing changed (a note-only entry), show "Nothing to update. Entry saved." with a single [Done].
- If extraction fails, show: "Couldn't read this yet. Your entry is saved." with [Try again] and [Close].

### 11.6 Journal (`/j/[id]/journal`)

Segmented control at the top: Entries, Reviews. Desktop wireframe showing the margin layout:

```
┌─────────────┬────────────────────────────────────────────┐
│ ● Piano ▾   │ Journal                  ( Entries | Reviews )│
│             │                                            │
│ Home        │ Tue 18 Nov   Worked on bar 12 with the left│
│ Journal     │ 30 min       hand. Still stumbling, but I  │
│ Skills      │              got through the page once.    │
│ You         │              ▓Sight-reading 2 to 3▓        │
│             │ ────────────────────────────────────────── │
│ [Log an     │ Mon 17 Nov   Read chapter 3. Lost the      │
│  entry]     │ 25 min       thread at the second step.    │
└─────────────┴────────────────────────────────────────────┘
```

- Entries are grouped by day, newest first. On mobile, date and minutes sit above the text in muted ui-small.
- Skills moved by an entry appear as small marks under its text.
- An entry with failed extraction shows "Couldn't read this one yet." and a ghost [Try again].
- Entry detail shows the raw text, the applied changes, and an [Undo] for the most recent applied extraction. Entry text is not editable (immutable). A "Add a note" action creates a new `note` entry linked by date.
- Reviews tab lists reviews: period in the margin, the review headline in display-3.
- Empty: "Nothing here yet." and "Your entries will appear here." with [Write an entry].

### 11.7 Skills (`/j/[id]/skills`)

```
┌──────────────────────────────────┐
│ Skills                           │  display-2
│ 14 skills, 3 moved since you     │  reading-small
│ last looked.                     │
│                                  │
│ Technique                        │  display-3 (category)
│ Left hand, bar 12                │
│ Attempting         ▓▓▓▓▓░░░░░░░  │
│ ──────────────────────────────── │
│ Scales                           │
│ Getting there      ▓▓▓▓▓▓▓▓▓▒░░  │  ▒ = second pass
│ ──────────────────────────────── │
│ + Add a skill                    │
│                                  │
│ Reading                          │
│ Sight-reading                    │
│ Getting there      ░░░░░░░░░░░░  │  penciled in
└──────────────────────────────────┘
```

Tapping a row opens the skill drawer (`?skill=id`).

### 11.8 Skill drawer

```
┌──────────────────────────────────┐
│ ─                                │
│ Sight-reading                    │  display-2
│                                  │
│ Level  0   1   2  [3]  4   5     │  segmented, 44px targets
│ Getting there                    │
│                                  │
│ Penciled in. One entry in the    │  reading-small
│ last 30 days.                    │
│                                  │
│  ·──·───·──────●                 │  sparkline
│                                  │
│ From your entries                │  display-3
│ Nov 16  'got through the whole   │
│         page without stopping'   │
│                                  │
│ Notes                            │
│ ┌──────────────────────────────┐ │
│ └──────────────────────────────┘ │
│ Rename            Archive skill  │
└──────────────────────────────────┘
```

Changing the level by hand writes a `skill_event` and sets `user_edited_at`. The evidence sentence reads "Penciled in", "Building", or "Inked", followed by the count of entries in the last 30 days.

### 11.9 Review (`/j/[id]/review/[reviewId]`)

```
┌──────────────────────────────────┐
│ ‹ Journal                        │
│ Nov 9 to 15                      │  display-2
│ Steady hands, thin hours.        │  display-3 (headline)
│                                  │
│ Planned  ░░░░░░░░░░░░░░░░   5 h  │
│ Actual   ▓▓▓▓▓▓░░░░░░░░░░ 2 h 10 │
│                                  │
│ Sight-reading is moving. Three   │  reading, bold run-in head
│ entries mention it, and...       │
│                                  │
│ Bar 12 is the snag. ...          │
│                                  │
│ Time is short of the plan. ...   │
│                                  │
│ Suggested changes                │  display-3
│ Timeline: move the goal date     │
│ from Mar 1 to Apr 15.            │
│ [Accept]  Edit  Dismiss          │
└──────────────────────────────────┘
```

Insights are three short paragraphs with a bold run-in head each. "Planned" is a dashed pencil stroke and "Actual" is a solid highlighter stroke on the same scale.

### 11.10 Goal (`/j/[id]/goal`)

A document page. Sections in this order, each with a display-3 heading and reading text that edits inline on tap: What you want, Why it matters, What done looks like, By when, Limits, Where you started. Saving an edit creates a new `charter` version. Footer: "Version 3, edited Nov 12" with a ghost [Version history] sheet (list, view, restore). Bottom: ghost [Pause journey] and danger ghost [Archive journey] with a confirm sheet.

### 11.11 You (`/you`)

- **What I've noticed about you:** the active `profile_fact` list. Each fact is a sentence with a muted source ("from your entry on Nov 3"), editable, deletable. Empty: "Nothing yet. I'll note things as you log."
- **Preferences:** typical session minutes, preferred time of day, week starts on, theme (Light, Dark, System).
- **Your data:** [Export everything] (JSON and Markdown), danger [Delete all data] with a typed-confirm sheet.

### 11.12 Journey sheet

Opened from the journey pill. A sheet on mobile, a popover on desktop. Lists journeys: hue dot, name, "Day 23", a check on the active one. Below: link "Goal for Piano", ghost [New journey]. Paused and archived journeys sit under a "Paused" heading.

### 11.13 New journey (`/new`)

```
┌──────────────────────────────────┐
│ ▬▬ ▬▬ ▭▭                  Skip   │  three-step indicator
│                                  │
│ How many days a week can you     │  display-2
│ realistically practice?          │
│                                  │
│ (1 to 2)  (3 to 4)  (5 or more)  │
│ (It varies)                      │
│                                  │
│ Or say it your way               │
│ ┌──────────────────────────────┐ │
│ └──────────────────────────────┘ │
│ [          Continue            ] │
└──────────────────────────────────┘
```

Step 1 is a large writing surface in the Composer style. Step 3 is the draft described in 3.1, with a hue swatch row (six 44px swatches, selected one with an ink ring).

---

## 12. Motion

The aim is calm. Motion answers an action and shows what changed. It never decorates.

- **No entrance animation on page load.** No scroll reveals. No hover lifts. On pointer devices, rows may gain a `--paper-sunk` background at 40% on hover.
- **Press feedback:** `scale(0.98)` over 80ms.
- **Sheets:** slide up 320ms with `--ease-out`, backdrop fades in 200ms, drag to dismiss.
- **The one orchestrated moment: marking.** When the user taps [Looks right]:
  1. Changed skill strokes grow from their old length to the new length over 420ms, staggered 90ms apart, with the gained part drawn in `--mark-deep`.
  2. Today's week line stroke draws left to right over 420ms.
  3. In "Where you are", changed phrases get their `.mark` background wiped in left to right (`background-size` from 0 to 100%, 420ms).
  4. Then the toast appears.
- **Skeletons:** slow opacity pulse, 1.4s.
- **Timer digits** update without animation.
- **Reduced motion:** when `prefers-reduced-motion` is set, all transitions are instant and strokes appear at final size. Nothing is lost, only the movement.

---

## 13. Copy and voice

Plain verbs, sentence case, no filler, no exclamation marks, no emoji. An action keeps its name through the whole flow ("Save entry" produces "Entry saved"). Errors say what happened and what to do, and they do not apologize. Empty states give direction.

**Buttons:** Start session, Plan today, Plan my session, Make it easier, Shorter, Different focus, Skip, Pause, Done, Log it, Save entry, Looks right, Edit, Keep entry only, Accept, Dismiss, Try again, New journey, Start journey, Export everything.

**Composer placeholders (rotate, spread across subjects):**

- "Worked on bar 12 with the left hand. Still stumbling."
- "Read chapter 3. Lost the thread at the second derivation."
- "Easy 5k, legs felt heavy."
- "Wrote for twenty minutes. Nothing good, but it's out."

**Toasts:** "Entry saved." "Entry saved. Plan updated." "Plan updated." "Change undone."

**Errors:**

- Extraction failed: "Couldn't read this yet. Your entry is saved."
- Offline: "You're offline. Your entry is saved and will be read when you're back."
- Session failed: "Couldn't plan a session. You can still log an entry."

**Empty states:** see each screen in section 11. Never write "Oops", "Uh oh" or "Nothing to see here".

**Accessibility labels:** every icon button has an `aria-label`. AI-generated results announce through an `aria-live="polite"` region.

---

## 14. Engineering conventions

### Stack

- Next.js (App Router), TypeScript in strict mode, React Server Components for reads, client components only where there is interaction.
- Tailwind CSS, with the section 7 tokens exposed as CSS variables and mapped into the theme.
- Radix UI primitives (dialog, popover, tabs, toggle-group, checkbox), fully restyled with the tokens. Do not ship shadcn or Radix default styling.
- `motion` only for sheet dragging and gestures. Everything else is CSS transitions.
- `lucide-react` icons (1.5 stroke, 22px). No other icon sets and no emoji.
- Drizzle ORM with SQLite (`better-sqlite3` or libSQL) and `drizzle-kit` migrations.
- Zod for every schema, `date-fns` for dates, `next/font/google` for fonts.
- Vitest for unit tests, Playwright for end-to-end tests and screenshots.
- No chart library. WeekLines, SkillStroke and Sparkline are small custom components.
- Ask before adding anything else.

### Folder structure

```
app/
  (app)/layout.tsx                 shell: top bar, bottom nav or rail, --hue wrapper
  (app)/j/[id]/...                 routes from section 9
  (app)/you/page.tsx
  new/page.tsx
  api/ai/...                       route handlers that call lib/ai
  globals.css                      tokens (section 7)
components/
  ui/                              Button, Chip, Input, Sheet, Toast, Skeleton, EmptyState
  marks/                           Mark, WeekLines, SkillStroke, Sparkline
  features/                        Composer, UnderstoodPanel, SuggestedChanges, SessionBlocks, ...
lib/
  ai/                              provider.ts, openai.ts, anthropic.ts, stub.ts, context.ts, tasks/, schemas.ts
  db/                              schema.ts, client.ts, queries.ts
  domain/                          evidence.ts, week.ts, apply.ts, session.ts
prompts/                           *.md (section 5.3)
evals/                             sample entries and checks
design/reference/                  optional reference images (take priority for visual detail)
design/current/                    screenshots from npm run shots
tests/
```

### Environment

`.env.example` lists: `AI_PROVIDER` (`openai` | `anthropic` | `stub`), `AI_MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`.

**`AI_PROVIDER=stub` is required.** It returns realistic fixtures for every task so the whole UI can be built and screenshotted without a key. Make it the default in development until Phase 3.

### Data and background work

- Reads happen in server components. Writes use server actions or route handlers. Every write goes through `lib/db/queries.ts` and `lib/domain/apply.ts`.
- AI work is started by a route handler right after the entry is saved. The client polls `log_extraction.status` every 1.5 seconds for up to 30 seconds. No queue infrastructure for the MVP.
- Keep all database access behind `lib/db` so the SQLite file (`./data/app.db`) can later be replaced by a hosted database. Serverless hosts do not keep local SQLite files.

### PWA and mobile

- Web app manifest with `display: standalone`, theme color that follows the theme, placeholder icons.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Respect `env(safe-area-inset-*)` on the top bar, bottom nav and sheets.
- Inputs use at least 16px text so iOS does not zoom.
- A minimal service worker (cache the app shell) belongs in Phase 6, not earlier.

### Accessibility baseline

Visible focus ring on every interactive element, full keyboard operation, semantic headings (one `h1` per screen), 44px targets, WCAG AA contrast for all text, `aria-live` for AI results, `prefers-reduced-motion` respected, never rely on color alone (minutes and level names are always written out).

### Code rules

No `any`. Small components. No inline styles except the `--hue` variable. No magic numbers outside the tokens. Prompts live in `/prompts`. All AI output is validated with Zod before it touches the database.

### Tests

Unit tests (Vitest): evidence calculation, `buildContext` budget truncation, applying and undoing each proposal kind, session minute normalization, week-line minute totals, day number, back-dated entries across a week boundary.
End-to-end (Playwright, `AI_PROVIDER=stub`): create a journey; log an entry, review the Understood panel and apply it; plan, focus, and land in Log with the draft text pre-filled.

---

## 15. Build phases

Do one phase at a time. At the end of each, run the visual verification in section 16, then summarize what was built and what differs from this file.

**Decisions to confirm with the user before Phase 3:** which AI provider and model to use, where the app will be hosted, and the app name.

### Phase 1: Foundation and styleguide

Build: project setup, fonts, tokens (light and dark with the pre-paint theme script), app shell (top bar, bottom nav, desktop rail, `--hue` wrapper), the base primitives and the signature components (Mark, WeekLines, SkillStroke, Sparkline, SessionBlocks), and the `/styleguide` route.

Acceptance:
- `/styleguide` shows every component in every state in light and dark: default, pressed, focus, disabled, loading, empty, error.
- WeekLines and SkillStroke render all evidence styles (penciled in, building, inked) and the second pass.
- No horizontal scroll at 390px. Screenshots exist for the styleguide at 390 and 1280, light and dark.
- `npm run seed:demo` and `npm run shots` both work (they can be minimal at this point).

### Phase 2: Data layer, journeys, new-journey flow

Build: Drizzle schema and migrations, queries, journey creation, journey sheet and switcher, the three-step `/new` flow using the stub provider, Home skeleton with real data for week lines, goal and skills.

Acceptance:
- A journey can be created end to end with stub AI and appears on Home with its own highlighter color.
- Switching journeys changes `--hue` and nothing else about the UI.
- The seeded Piano and Physics journeys both render correctly.

### Phase 3: Log and understanding (the core)

Build: Composer, Log screen, saving entries, extraction route handler, polling, UnderstoodPanel, proposals, `apply.ts` with undo, the state update, the marking animation, toasts. Wire the real provider here.

Acceptance:
- A messy one-sentence entry is saved instantly, then produces an editable extraction within the polling window.
- Unchecking a row prevents that change from being applied. Undo restores the previous values exactly.
- Killing the network or the provider leaves the entry saved and shows the specified error copy and a working [Try again].
- Entering a rest day creates no AI call.
- `npm run evals` runs against the 12 sample entries with valid schemas.

### Phase 4: Plan and focus

Build: session generation (`session_plan`), Home hero, time chips with debounce, Plan today, refinement chips, Focus mode with timer and wake lock, hand-off to Log with prefilled text, progress persistence.

Acceptance:
- Changing the time chip yields a session whose block minutes sum exactly to the requested minutes.
- A full loop works: Plan, Focus, Log, Understood, Home with the updated session.
- Refreshing during Focus mode keeps the current block.

### Phase 5: Journal, skills, reviews

Build: Journal (entries and reviews tabs, entry detail), Skills list and drawer with manual level edits, weekly review generation and view, suggested changes, `last_seen_at` handling for "what moved".

Acceptance:
- Skills moved since the last look show the second pass, and it clears after the user has viewed Home.
- Manual edits set `user_edited_at` and are never overwritten without a suggestion.
- A review produces a headline, three insights, planned versus actual, and independently resolvable suggested changes.

### Phase 6: Goal, You, polish

Build: Goal page with versions, You page (facts, preferences, theme, export, delete), PWA manifest and service worker, a full polish pass against section 16's checklist on every route.

Acceptance:
- Every screen has designed empty, loading and error states.
- Export produces valid JSON and Markdown containing every entry.
- The app installs to a phone home screen and respects safe areas.

### Phase 7: Later

Rollups and keyword retrieval for older entries, better voice input, reminders, a graph view for skill prerequisites, a second AI provider hardening pass.

### Definition of done for any UI task

A UI task is done only when all of these are true:

1. It follows the wireframe structure and uses only tokens (no raw hex, no off-scale spacing).
2. Highlighter color appears only as progress data. Buttons, tabs and links are ink.
3. Two typefaces only, sentence case, no all-caps labels, reading text in Literata.
4. No card-in-card and no uniform rounded cards. Hairlines and whitespace separate things.
5. Empty, loading and error states exist and use the section 13 copy.
6. Works in light and dark, at 390px and 1280px, with long names and long entries, with no horizontal scroll.
7. Focus ring, 44px targets, AA contrast, reduced motion.
8. Screenshots were taken and compared (section 16), and every difference was fixed or reported.

---

## 16. Demo data and visual verification

### Demo data (`npm run seed:demo`)

Create realistic content so screens look real. Idempotent: running it again resets demo data.

**Journey 1: Piano** (hue 100), started 23 days ago, with a goal, "Where you are" with changed phrases, 16 entries across the last 23 days (mix of 15 to 45 minutes and one rest day), one finished weekly review, six profile facts, and 14 skills:

- Technique: Left hand at bar 12, Scales, Finger independence, Pedaling, Dynamics
- Reading: Sight-reading, Rhythm counting, Key signatures
- Repertoire: First piece, bars 1 to 16; First piece, bars 17 to 32; Memorizing
- Ear and theory: Chord shapes, Intervals by ear, Cadences

Mix evidence on purpose: some penciled in, some building, some inked, and two skills that moved since `last_seen_at`.

**Journey 2: Physics** (hue 215), 3 entries, 6 skills, proving nothing is piano-specific.

Sample entries (keep them messy and lowercase like real notes):

- "30 min. scales then bar 12 left hand, still stumbling on the jump. got through the page once tho"
- "tired, only 15. just hands separate bars 9-16"
- "rest day, wrist sore"
- "did chord shapes for 20 min, boring but C and G are automatic now"
- "sight reading from the grade book, went slow, 25 min, lost the count in 3/4 twice"
- Physics: "read ch 3 on momentum, lost the thread at the derivation, maybe 40 min"

### Screenshots (`npm run shots`)

A Playwright script, run with `AI_PROVIDER=stub` against the seeded database:

- Viewports: 390x844 and 1280x800. Themes: light and dark.
- Routes: Home, Plan, Focus, Log (empty and with the Understood panel open), Journal (entries and reviews), Skills (list and drawer), Review, Goal, You, New journey (each step), journey sheet, `/styleguide`.
- Disable animations and transitions, and wait for fonts, so captures are deterministic.
- Output to `design/current/{route}-{viewport}-{theme}.png`.

### Comparing

The wireframes in section 11 are the structural reference. If images exist in `design/reference/`, they take priority for visual details. After every UI task:

1. Run `npm run shots`.
2. Look at the screenshots for the routes you touched, light and dark, 390 and 1280.
3. List every difference from the wireframe, the tokens and the Definition of done. Fix them.
4. Re-run and look again. Do not stop at "it builds."
5. Report anything you could not match and why.

---

## 17. AGENTS.md stub

Paste this into `AGENTS.md` at the repo root. Keep it short; this file holds the detail.

```
# Project instructions

Read context.md before starting any task. It is the source of truth for product, design and build order.

- Follow the phases in section 15, one at a time.
- Design values come from sections 7 and 8, structure from section 11. Do not use raw hex or off-scale spacing.
- Highlighter color is data only. Buttons and links are ink. Two typefaces. No all caps, no card-in-card.
- Develop with AI_PROVIDER=stub until Phase 3.
- Every AI write goes through the proposal table. Entries are immutable.
- A UI task is not done until you have run npm run shots, compared the screenshots, and fixed the differences.
- Ask before adding dependencies.
```
