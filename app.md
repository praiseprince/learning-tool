# Marginalia

Marginalia is a personal, AI-assisted learning notebook. A learner can keep Spanish conversation, physics, piano, or a work skill side by side. Each subject gets its own goal, practice plans, journal, and skill history. The home screen brings those subjects together and shows how much practice actually happened this week.

The app is designed for one learner running it on their own laptop. The laptop stores the notebook and serves the web interface. An iPad on the same Wi-Fi can use the same data. For live AI features, the server invokes the locally installed Codex CLI with its authenticated account. That distinction matters: the database lives on the laptop, while relevant learning material goes to Codex when a live AI task runs.

## The V2 workspace

Start with `npm run local`. The home dashboard opens with every journey and this week’s recorded practice. **New journey** starts a Guide conversation. The Guide saves each answer, asks about the desired outcome and starting point, and lets the learner request a draft or write a first step manually. Approving the draft saves a versioned charter and route. Each route step explains its relevance, suggested work and estimated time. A revised route keeps its predecessor available.

The **Atlas** groups concepts by journey. A learner can inspect a source quotation, record a self-assessment, follow related concepts, filter by evidence or goal, and view what had been accepted by a selected date. Alternative names can surface potential connections across subjects. The suggestion inbox records the learner’s decision about each connection.

The **Notebook** holds Markdown pages with equations, code, tables and links to Atlas concepts. Autosave records revisions, and each quoted observation links back to the particular revision it came from. A learner can add a book, article or other source, attach a source note, search past work, and export a page as Markdown. AI extraction runs after saving. A failed request leaves the page available for reading and editing.

The sections below also describe the original journey and practice tools, which remain reachable from the home dashboard.

## What learning with Marginalia feels like

Suppose you want to learn Spanish for a trip. You start with “I want to order lunch.” The interview might ask what would make the interaction feel successful. You decide that ordering a meal and answering one follow-up without help would count. That becomes an editable goal. Once you confirm it, the conversation turns to your starting point. Knowing a few greetings is a self-report. Responding to a specific Spanish prompt gives the app a sample it can discuss. A written response gives it evidence about your wording; pronunciation still needs a different kind of observation.

Later, you can request a 15-minute session, work through its blocks, and write “I could order, but froze when asked whether it was to go.” The original sentence stays in your journal. You decide whether the AI’s interpretation should affect a skill or your progress summary. When you come back, you can read what actually happened and choose what to practise next.

This is an illustrative journey. The live provider generates questions, plans and interpretations from the learner’s material. The app currently supports planning, independent practice and reflection. The richer teaching loop proposed in the product plan would also present a worked example, collect an exercise attempt, give targeted feedback and invite another attempt on the same notebook page.

## The dashboard and the notebook

**Your learning** is the landing page at `/`. It shows this week’s practice sessions, recorded minutes and distinct practice days across subjects, followed by unfinished interviews and the learner’s journeys. An active journey appears with its goal. Paused and archived journeys remain accessible separately. A new installation can start with an empty dashboard. Piano and Physics are examples installed by the optional demo seed.

The interface uses **journey** for the subject you are learning and **notebook** for the place where you develop and document it. In the original journey screens, a notebook refers to one journey. The V2 Notebook collects pages across subjects. Opening a journey takes you to its own Home page. There you can choose a session duration, see the current plan, check weekly activity, read “Where you are,” and inspect skills. The main navigation’s Home link returns to the cross-journey dashboard.

| Measure | How to read it |
| --- | --- |
| Sessions | Count of saved practice entries. Two sessions on one day count twice. |
| Minutes | Sum of recorded practice time, using the accepted time correction where one exists. An entry without a duration contributes zero minutes. |
| Practice days | Distinct dates containing practice. Two sessions on one date count as one practice day. |
| Rest days and notes | Remain part of the journal. A rest day can appear on the weekly activity view. Both are excluded from practice totals. |
| Skill level and evidence | Level describes the recorded ability. Evidence describes the amount and recency of logged support. Practice time alone does not establish mastery. |

Weekly totals use the learner’s chosen first day of the week. Backdated entries belong to their practice date. Journey Home also shows cumulative practice statistics for that subject.

## Starting a notebook

1. **Describe an outcome.** The opening question is “What would you like to be able to do?” The live interviewer asks one relevant follow-up at a time and drafts a title, goal and observable success criterion. The goal interview is bounded so the learner can move on to editing the summary.
2. **Confirm the goal.** The learner edits the notebook title, what they want to do and how they will recognize success. Confirmation opens the separate baseline interview.
3. **Establish a starting point.** The learner describes prior attempts. Codex can ask a small diagnostic question related to the confirmed goal. The app checks that a proposed evidence quotation appears in a baseline answer. A provider-assigned numerical level requires an observed answer. Self-report can still produce a useful written starting point.
4. **Review the baseline.** The learner can correct the summary, adjust an available skill level, choose a highlighter and open the notebook. Skipping the assessment records an unassessed starting point. It creates no speculative skill score.
5. **Resume when needed.** Submitted turns are saved to SQLite before a provider call. An unfinished interview appears on the dashboard. A failed call can be retried against the saved answer. An unsubmitted text draft is kept in that browser’s local storage. Completed interview notes are available from the notebook’s Goal page.

## Planning and practising

**Plan today** asks how much time is available, how the learner feels and whether the plan should account for anything specific. The generated plan contains a title, rationale and timed blocks with instructions. Block durations are normalized to sum to the requested session length. Home offers common durations and a custom value. A learner can request an easier, shorter or differently focused plan.

**Focus** presents one block at a time. The learner can pause, resume, hide the timer, skip a block or mark it done. Reaching zero leaves advancement under learner control. The current block and timing state are saved in the browser, so a refresh on the same device can resume the session. The app requests a screen wake lock where the browser permits it. After the last block, **Log it** opens an editable draft containing the planned duration and block titles. Actual minutes can differ from planned minutes.

**Log** accepts a dated free-text entry, optional minutes and energy. Dictation is available where the browser supports speech recognition, with keyboard dictation as a fallback. A learner can also record a rest day. Saving a practice entry writes the original text first, then starts extraction. A rest-day entry bypasses extraction.

## How AI suggestions become notebook changes

The review sheet is where the learner decides what the AI understood. It can offer a time correction, a proposed skill or level change with a quotation, and a sentence for “Where you are.” If a clarification would materially affect the interpretation, the sheet can offer tap answers and request a revised extraction.

The learner can edit values, uncheck individual rows, accept the selected changes, or keep only the entry. Accepted changes can create skill events, a new state snapshot, a time adjustment and a regenerated plan. The original entry stays intact. Undo uses the saved previous values and checks for intervening skill changes so that reversing an old suggestion cannot silently erase a later edit.

AI operations use structured results validated with Zod. The proposal table records model-produced changes and their resolution. The review interaction depends on the task: the learner explicitly resolves extraction and weekly goal suggestions, while a requested plan or background summary can be stored as an applied proposal. Provider failure after a log is saved leaves the entry available, with retry from the review flow and recovery of outstanding extractions on journey Home.

## Journal, skills, goals and reviews

- **Journal** groups entries by date, with practice duration, original wording and skill changes. Entry detail can lead back to its review. Adding a note creates a separate entry for the same date.
- **Skills** shows an ability on a 0–5 scale. Its stroke communicates the current level, and its evidence treatment reflects recent logged skill events. Evidence is computed using an exponential age weight with a 21-day decay scale; several recent observations carry more weight than one old observation. The drawer presents evidence excerpts, history, notes and manual controls. Learners can add, rename, archive or connect skills through prerequisites. The app checks for circular dependencies. Visiting Home updates the timestamp used for “moved since you last looked.”
- **Goal** holds the outcome, motivation, success criterion, deadline, constraints and starting point. Editing a field creates a new charter version. Restoring an earlier version also creates a version, preserving the history. The page includes pause and archive controls.
- **Weekly review** is generated on demand from the Journal’s Reviews tab. It records a headline, three insights and a planned-versus-actual time comparison for the period. Each proposed goal adjustment can be accepted, edited or dismissed independently. Accepted charter changes create new goal versions. A stored review is a snapshot of that period at generation time.
- **You** holds editable profile facts and preferences for typical duration, preferred time of day, week start and theme. A daily browser reminder can be enabled while the app is open. Data controls provide JSON and Markdown downloads and a typed-confirmation flow for deleting personal data.

## Visual and interaction design

Marginalia uses an editorial notebook layout. Bricolage Grotesque carries headings and controls, while Literata carries reading and writing passages. Paper-like surfaces, whitespace and hairlines separate entries. Ink-colored controls keep actions distinct from highlighter marks used for progress and evidence. Light, dark and system themes are available.

Mobile navigation puts Home, Journal, Log, Skills and You within reach. Desktop uses a left rail and can place dates and minutes in a journal margin. Sheets provide focused review and editing surfaces. Focus mode removes the regular navigation while practising. Progress changes use restrained motion, with reduced-motion support. The style guide exposes reusable controls and marks independently of personal data.

## Route map

| Address | Purpose |
| --- | --- |
| `/` | Cross-subject dashboard and interview resumption |
| `/new` and `/new?draft=<id>` | Start or resume the goal and baseline interviews |
| `/j/<id>` | Journey Home, weekly activity, current plan and stats |
| `/j/<id>/plan` and `/j/<id>/focus` | Generate or refine a plan and run its blocks |
| `/j/<id>/log` | Save practice or rest and review an extraction |
| `/j/<id>/journal` | Entries, entry detail and weekly reviews |
| `/j/<id>/skills` | Skill list, drawer and prerequisite view |
| `/j/<id>/review/<reviewId>` | Read a weekly review and resolve suggested changes |
| `/j/<id>/goal` | Goal, version history and completed interview notes |
| `/you` and `/styleguide` | Personal settings and the design reference |
| `/api/entries/<entry>/extract` | Start or retry extraction and poll its status |
| `/api/export` and `/api/export?format=markdown` | Download personal data |
| `/manifest.webmanifest` and `/sw.js` | Install metadata and production service worker |

## Architecture and data ownership

The app uses Next.js App Router, React and TypeScript. Server components read notebook data. Server actions handle form mutations. Route handlers serve extraction and export. Client components handle interactions that need the browser, such as timers, dictation, draft text, reminders and dialogs. Tailwind and CSS design tokens define the interface. Playwright exercises the rendered product.

SQLite runs on the host through better-sqlite3 in write-ahead logging mode. The project uses Drizzle for typed database access alongside prepared SQL statements and transactions. Runtime table creation is in [lib/db/client.ts](lib/db/client.ts). [lib/db/apply.ts](lib/db/apply.ts) contains extraction application and undo. The principal records are:

| Records | Responsibility |
| --- | --- |
| `journey`, `charter`, `interview` | Notebook identity and status, versioned goal, resumable interview state and transcript |
| `log_entry`, `log_extraction`, `extraction_answer`, `entry_time` | Original entries, interpretation status and results, clarifications, accepted time corrections |
| `skill`, `skill_event`, `state_snapshot` | Skill definitions and prerequisites, level history and evidence, successive progress summaries |
| `plan_item`, `review`, `rollup` | Timed sessions, weekly review snapshots and summaries of older periods |
| `proposal` | Source, proposed data, resolution and information needed to reverse supported changes |
| `profile_fact`, `preference` | Learner-wide observations and personal settings |

For planning and extraction, the context builder budgets space for profile facts and preferences, the current goal and state, skills, recent entries, completed-period summaries and keyword-matched older entries. Recent evidence and retrieved passages help the model work with a long notebook without sending the whole database on each request. Goal interviews use their own saved conversation. Different AI tasks receive different inputs. The live adapter starts an ephemeral Codex process in a temporary directory, requests structured output and validates it before use. [AI context](lib/ai/context.ts) · [Codex adapter](lib/ai/codex.ts)

The default database is `data/app.db`; `DATABASE_URL` overrides its location. Browser-local state includes unsubmitted writing, focus position and reminders. Submitted records become available to devices connected to the same server. A JSON or Markdown export is a portable reading and data artifact. Restoring a working installation from an export is a separate capability. For an operational copy, use SQLite’s backup facility or stop the server before copying the database and its associated files.

## Running and verifying the app

From the repository, install dependencies with `npm ci`. Use a Node version compatible with the installed Next.js and native better-sqlite3 packages. The seed and evaluation scripts also import TypeScript directly. The development environment used Node 25.9.0.

| Command | Result |
| --- | --- |
| `npm run dev:lan` | Start development mode on all network interfaces. Open the printed network address on the same Wi-Fi. |
| `npm run build` then `npm run start:lan` | Build and serve the production app on the LAN. |
| `AI_PROVIDER=stub npm run dev:lan` | Exercise supported learning flows with deterministic local responses. |
| `codex login status` | Check the Codex account used by the operating-system user running the server. Live calls use that account’s model allowance. `AI_MODEL` can override the CLI model. |
| `npm run tunnel` | Run an existing named Cloudflare Tunnel with an externally configured identity policy. Public access to the origin is unsupported. |
| `npm run seed:demo` | Reset the named Piano and Physics demo data in the selected database. Use a disposable database when experimenting with the examples. |
| `npm run lint` and `npm run build` | Check source conventions, TypeScript and the production build. |
| `npm run shots` | Build, seed a disposable database, exercise screens with the stub, and write mobile and desktop light/dark captures into `design/current/`. |
| `npm run evals` | Run 12 sample log extractions through live Codex and check structured results and expected fields. |
| `node evals/context.mjs` | Check context size limits and isolation between journeys with synthetic history. |

The production service worker supports an offline fallback page and the manifest supplies home-screen metadata. Notebook reads and writes still require a connection to the running laptop. Plain LAN HTTP supports normal journal use. Service workers and screen wake lock require a secure browser context such as localhost or HTTPS. A physical iPad installation and dictation session remain device checks.

## Product direction and release status

The goal-first interview is the first implemented milestone of the professional notebook plan. The app already supports the practice loop, reviewable suggestions, personal dashboards, exports and responsive layouts. The next product milestone is the guided first exercise with instruction, an attempt, feedback and retry. Later dashboard work calls for direct resumption of unfinished exercises and evidence-linked observations about comparable attempts.

The local beta has been tested from a clean install and an upgraded V1 fixture. Backup and restore preserve the original records and V2 history. Tablet verification used browser touch emulation. The deployment assumes one learner on a trusted network. The [beta verification notes](docs/v2/beta.md) list the checks, and the [README](README.md) covers startup, backup and remote-access boundaries.
