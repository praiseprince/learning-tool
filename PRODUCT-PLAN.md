# Marginalia · Product plan for the first packaged release

**Product promise.** Open a notebook for anything you want to learn. Marginalia helps you describe what success looks like, find a starting point, practise something specific today, and see evidence of what you can now do.

**Release assumption.** Package a single-learner, local-first web app that runs on a laptop and works from an iPad. Keep SQLite, the existing editorial design system, and the learner’s configured Codex provider. Public multi-user hosting would require a separate product and security decision. This is a proposed revision to the onboarding and daily experience in context.md.

## From the current app to the proposed experience

The current app has useful foundations: a cross-journey home, session planning, a focus timer, immutable practice entries, reviewable AI suggestions, skill history and exports. Its onboarding asks for intent and a starting point, asks a fixed scheduling question, then generates a draft that already contains skill levels. That is the first flow to replace. Internally, an existing journey can back a notebook, preserving its ID, links, history and data.

## 1. Understand the goal before assessing ability

The first page asks “What would you like to be able to do?” The interview asks one follow-up at a time. Each question must resolve something that could change the plan: the intended outcome, the setting where it will be used, what would count as success, or a relevant constraint. Information already volunteered counts. Someone exploring a subject can choose a short discovery goal and revisit it later.

Show a live, editable goal page alongside the interview on desktop and directly below the question on mobile. When there is a concrete outcome and an observable success criterion, summarize them in the learner’s words and ask “Does this capture it?” Only the learner’s confirmation advances the interview. A date and a weekly schedule are optional. Save every answer so closing the browser never restarts the conversation.

## 2. Establish a baseline against that goal

After confirmation, identify the few abilities that matter for the first milestone. Ask what the learner has tried and request the smallest useful demonstration: explain a concept, solve a short problem, describe a recent attempt, or share a work sample when supported. Adapt the next prompt to the answer. Allow “I don’t know” and “skip for now.”

For each assessed skill, show what the evidence supports and where it came from. Distinguish self-report, an observed answer and a learner correction. Leave unassessed skills unknown. For physical or perceptual skills the app cannot observe, use a self-check and record that limitation. Stop once the first practice task can be chosen intelligently. The learner confirms or corrects the baseline before the app proposes a plan.

**Example.** “Learn Spanish” might become “Order lunch and handle one follow-up question on my trip.” After the learner confirms that goal, ask them to order a meal and respond to “¿Para aquí o para llevar?” If they can order but miss the follow-up, the first session rehearses that exchange. Save the response as evidence about this task; a text exchange gives no basis for judging pronunciation.

## 3. Make the notebook the place where learning happens

Each notebook opens to a dated working page with the goal in the margin and one next action. A session includes a short explanation or worked example, a task to attempt, space for the learner’s answer, specific feedback and a chance to try again. A practical task can happen away from the screen. The learner returns to record what happened. A timer is available when useful.

Entries, exercises and emerging questions form a readable chronology. The learner’s writing stays intact. AI comments sit beside the relevant passage or underneath it on iPad. Selecting a comment reveals its source and an action such as “Practise this,” “Accept change” or “Dismiss.” Accepted changes use the existing proposal and undo mechanism. Keep the two typefaces, paper surfaces and restrained progress marks from context.md. Prototype the dashboard, interview, notebook page and evidence detail in light and dark before extending the rest of the UI.

## 4. Give the dashboard two jobs

| Area | What it shows | What the learner can do |
| --- | --- | --- |
| Continue learning | One unfinished interview, exercise or practice session, with the notebook name and exact stopping point | Resume in one tap |
| My notebooks | Every active subject, its confirmed goal or draft status, and the next task | Open a notebook or start one |
| This week | Sessions, minutes and practice days, calculated from saved entries | Open the entries behind the totals |
| What changed | At most a few specific observations with dated evidence | Inspect the evidence, correct the interpretation or practise again |

A new installation opens to “Start your first notebook.” Keep example subjects behind an explicit sample option. With sparse history, show the next useful action and the evidence available so far. Time spent is an activity measure. A claim of improvement requires comparable attempts. For example, “You answered three follow-up questions unaided today; last Thursday you used a hint for two” links to both exercises. With one attempt, show a baseline and offer a later check.

## 5. Build and verify in order

| Milestone | Deliverable | Exit test |
| --- | --- | --- |
| 1. Interview and assessment | Persist draft conversations, confirmed goal versions, assessment prompts and evidence references. Use distinct states for goal interview, goal confirmation, baseline, baseline confirmation and ready. | Test a complete beginner, a returning learner and someone changing goals across language, mathematics and a practical skill. Refresh mid-answer, correct a summary, skip a diagnostic and simulate a provider timeout. No invented level, duplicate notebook or lost answer. |
| 2. One complete learning session | Connect the confirmed baseline to a teachable first task, feedback, retry and saved notebook page. | A learner can explain why the task was chosen, attempt it, act on feedback and reopen the original work. Logging and reading remain available during provider failure. |
| 3. Dashboard and insights | Resume work across subjects, drill into metrics, link every learning claim to evidence. | Use two notebooks with different goals and overlapping dates. Verify totals, scope, corrections, empty states and evidence links. An accepted or undone change updates the dashboard consistently. |
| 4. Packaged beta | Versioned migrations, backup and restore, one-command production startup, provider setup check, private local defaults, accessibility and device verification. | Install on a clean supported laptop, upgrade a copy of an existing database, restore a backup, reconnect from an actual iPad, and complete the full loop using the packaged build. |

Use the stub to exercise deterministic interview branches and failure cases. Run separate live Codex evaluations for question relevance, justified stopping, evidence-grounded baselines and actionable feedback. Generate responsive screenshots and inspect keyboard, touch, focus and long-text behavior at each UI milestone. Keep the local provider boundary behind the server and explain during setup which notebook material is sent to Codex. Define and test access controls before enabling remote access in a distributable build.

**Release decision.** Invite a small beta when a new learner can reach a useful first exercise without help, return the next day to the right page, and understand the evidence behind a suggested change. Validate this with people learning different subjects as well as automated tests. Record where they abandon the interview or need assistance, and shorten or revise those steps before expanding features.
