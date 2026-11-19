# Marginalia 2.0: product, architecture and Codex build specification

**Status:** V2 implementation brief, revision 2 (19 November 2026)
**Audience:** Codex (implementation agent) and the product owner
**Working name:** Marginalia. Keep the product name in one constant, `APP_NAME`.
**Predecessors:** `app.md` (what V1 does today), `context.md` (V1 spec and design tokens)

> **Central idea.** Marginalia is a personal, AI-guided environment for self-directed learning. A living **Knowledge Atlas** shows what the learner knows and how it connects. An **AI Guide** interviews the learner about goals and suggests flexible, goal-conditioned routes through the atlas. A **Notebook** captures notes, sources and conversations naturally, so the atlas and the guide improve over time.
>
> Not a tutor. Not a course platform. Not a habit tracker. The Guide may briefly define or explain a concept to help the learner decide what to explore, but it does not default to lectures, tests, rigid curricula or mandatory logs.

### What changed in revision 2

1. **Graphs come first.** V1 already stores skills, prerequisites and skill events with quotes, which is enough to draw a real local graph immediately. The build order is now: safety, local Atlas, Notebook, global Atlas with bridges, goals and Guide, consolidation (section 13).
2. **Extend, don't duplicate.** `goal_v2`, `goal_charter_v2` and `ai_suggestion` are removed. Extend `charter` and `proposal` instead (section 9).
3. **Deferred:** time-travel scrubbing (ship a dated event list), verified web resources, `model_job`, `graph_view_state` and the full facet model. Start with three facets.
4. **Phase 0 is smaller.** Audit, backup/restore test, feature flag and ADRs. No four static prototypes; build the real local graph and iterate on screenshots of it.
5. **Graph library spike happens early**, against a 1,000-node fixture, before any commitment.
6. Open questions from the planning discussion now have stated defaults (section 15).
7. **Design tooling:** the Impeccable design skill is installed in Step A and used for every UI task, subordinate to this file's design rules (section 8.11).

---

## 0. How to use this specification

This file lives in the existing repository as `MARGINALIA-V2.md`. It is not a prompt to scaffold a new project.

1. **Inspect the real repository first.** Read `README.md`, `app.md`, `context.md`, `PRODUCT-PLAN.md` (if present), `AGENTS.md`, `package.json`, DB initialization and migrations, `lib/ai/codex.ts`, `lib/ai/context.ts`, `lib/db/apply.ts`, existing routes, tests and screenshots. The documents describe the app but do not guarantee the code matches. Report discrepancies before changing related code.
2. **Precedence.** This file decides V2 behavior. Real code and migration history decide how existing data actually works. `context.md` supplies reusable design tokens and conventions where not superseded here. Never destroy V1 data or silently swap conventions.
3. **One vertical slice at a time.** Each step in section 13 is shippable behind a feature flag or a reversible route change. Run its tests, inspect screenshots, and report acceptance results before starting the next.
4. **Proposals are not facts.** AI text, candidates and speculative connections never become accepted knowledge without the review path in section 10.6.
5. **Keep `AI_PROVIDER=stub` working.** Every AI-dependent V2 flow must run end to end on deterministic fixtures.
6. **Build agent is not in-app AI.** Codex writes the code. The running app calls the Codex CLI through a server-side adapter. Keep that adapter behind an interface and verify its real capabilities (structured output, schema size) instead of assuming them.
7. **No big-bang rewrite.** Keep legacy URLs and data until a tested replacement and migration exist.

### Explicit non-goals

Tutoring curriculum, automatic quizzes or grading, mandatory spaced repetition, streaks or gamification, social features, public SaaS hosting, autonomous browsing, any claim that finishing an activity proves mastery, and an unlabeled "magical" graph with thousands of links.

---

## 1. Product philosophy

### 1.1 The learner and the Guide

The learner pursues several unrelated interests (piano, running, physics, philosophy). Sometimes there is a clear outcome, sometimes just curiosity. The system supports both without forcing a formal goal for every passing question.

The Guide's job is to **guide the learning process**: clarify intent, find prerequisites that matter for *this* goal, say why a topic matters, suggest what to investigate, point to trustworthy resources, and revise when the learner changes direction.

### 1.2 Principles

1. **The goal determines the route.** Different goals in one subject give different paths. There is no universal roadmap.
2. **The atlas determines the starting point.** Never assume beginner or expert.
3. **The learner controls pace and method.** Read, practise, ask, write, or do nothing.
4. **Guidance is provisional.** Routes can branch, pause, be ignored or replaced. No overdue state.
5. **Capture naturally.** Notes, conversations and reflections are the memory. No second "log what you did" step.
6. **The graph has provenance.** Any assertion leads to an original record.
7. **Encountering is not knowing.** Exposure, self-report and observed evidence stay distinct.
8. **Minimal interruption.** Low-stakes bookkeeping is automatic. Semantic changes go to a quiet inbox, not a modal.
9. **Cross-topic links must earn their place.** A shared word is not a connection. Every bridge carries a specific rationale.
10. **Private and portable.** Material goes to a model or search provider only when a relevant operation runs.
11. **No habit shame.** No streaks, overdue warnings or praise filler.
12. **Useful without AI.** Atlas and notes stay editable, navigable and exportable if the model is unavailable.

### 1.3 Three pillars

| Pillar | Purpose | Canonical question |
|---|---|---|
| **Atlas** | Persistent global and local map of concepts, skills, evidence and relations | What do I know, and how does it connect? |
| **Guide** | Goal interviews, routes, relevance, search directions, replanning | Given my goal and what I know, where could I go next? |
| **Notebook** | Notes, Markdown/LaTeX, sources, conversations, reflections | What have I explored, and where did that understanding come from? |

Learning Memory is a service under these pillars, not a fourth tab.

### 1.4 Illustrative experiences

**Marx's philosophy.** The Guide asks whether the interest is foundations, economic critique or political influence, then drafts a charter. It may suggest brief study of Hegelian dialectics, explaining in a sentence that Marx reworks Hegel's dialectic in a materialist account of history. It does not insist on a full Hegel course. A different goal (Marx's analysis of capitalism) yields a different route.

**A piece on piano.** The Guide asks about the piece, current ability and what "play" means. The learner later writes "left hand still difficult at bar 12". The note is saved, linked to relevant concepts, and the next suggestion adapts. No mandatory timer or worksheet.

**Fourier transforms (curiosity).** The learner types a question. A temporary exploration card shows links to their calculus and linear algebra nodes, with "Investigate independently", "Why relevant?" and "Make this a goal". Only the last starts an interview.

---

## 2. Vocabulary

| Term | Definition | Distinction |
|---|---|---|
| **Atlas** | The user's persistent knowledge graph and its views | Not a checklist; not per-journey copies |
| **Concept** | An idea or body of understanding | Not automatically a skill |
| **Skill** | A capability that can be practised or demonstrated | Evidence must fit the capability |
| **Topic** | A grouping for navigation, possibly overlapping | Not a strict parent |
| **Question** | An open inquiry | Linking it implies no comprehension |
| **Relation** | Typed link between nodes | Needs claim, rationale, provenance, status |
| **Journey** | A named area of interest (V1 record, kept) | One journey may hold several goals |
| **Goal** | Versioned, interview-derived intended outcome | May be open-ended; deadline optional |
| **Charter** | User-approved interpretation of a goal | A draft is not a confirmed goal |
| **Route** | Versioned, goal-conditioned recommendation through nodes and external actions | Not the atlas; not proof of achievement |
| **Route step** | A proposed investigation, reading, practice or reflection | May be skipped or replaced |
| **Document** | Editable note with revisions | Distinct from immutable raw records |
| **Source** | Book, article, video, file or URL | Recommending is not the same as using |
| **Learning event** | Observed activity, conversation, edit or statement | History, not mastery |
| **Evidence** | Traceable observation supporting a limited claim | Records its observation type |
| **Proposal** | AI-suggested change awaiting review | Never rendered as accepted fact |
| **Guide conversation** | Resumable dialogue about navigating learning | Not a teaching chat |

### 2.1 Layers that must not be conflated

- **Knowledge structure:** concepts and the relations between them in the subject matter.
- **Personal state:** how this learner relates to those concepts, with evidence and uncertainty.
- **Intent:** journeys, charters, questions, constraints.
- **Route:** what the AI proposes for one goal, and why.
- **History:** what the learner actually did or wrote.
- **Visualization:** rearrangeable views. A layout change never mutates semantic truth.

A valid link between calculus and Fourier analysis exists even if the learner knows neither. A route recommending Fourier analysis does not make it explored.

---

## 3. Information architecture

Three primary destinations: **Atlas**, **Guide**, **Notebook**. Goals are reachable from each. You/Settings is secondary. No separate Today, Log, Skills or Reviews pages in the V2 shell.

### 3.1 Routes (introduced step by step, see section 13)

| Route | Function | Step |
|---|---|---|
| `/atlas` | Global Atlas, search, filters, graph/outline toggle | D (local view from B) |
| `/atlas/n/[nodeId]` | Deep-linkable concept workspace | B |
| `/j/[journeyId]/atlas` | Local Atlas for a journey | B |
| `/notebook`, `/notebook/d/[id]`, `/notebook/s/[id]` | Documents, sources, history | C |
| `/guide`, `/guide/c/[id]` | Guide home and conversations | E |
| `/goals/new`, `/goals/[id]`, `/goals/[id]/route` | Interview, charter, route | E |
| `/you`, `/styleguide` | Settings, design reference | existing |

Keep `/j/[id]`, `/journal`, `/skills`, `/log`, `/plan`, `/focus`, `/new` working until their content is reachable in V2. Redirect only after tested parity.

### 3.2 Desktop

- Left rail (about 224px): wordmark, Atlas / Guide / Notebook, current goals, recent explorations. Collapsible.
- One generous main canvas: graph, route, document or conversation. Avoid identical cards around everything.
- Optional right inspector (340 to 400px, resizable) whose purpose follows the selection (concept, evidence, source, Guide context) without replacing the main view.
- `Cmd/Ctrl+K` for navigation and one restrained "Ask the Guide / Capture an idea" entry point. No floating chat overlay.
- Preserve selection across views where possible (concept to note to concept).

### 3.3 Mobile

- Bottom nav: Atlas / Guide / Notebook. Goal entry is contextual.
- Graph is a full-screen pan/zoom surface. Tapping a node opens a full-height sheet. Outline fallback is one tap away.
- Guide and notes get full writing surfaces, not cramped splits.
- Safe-area spacing, readable math, 44px targets.

### 3.4 Deep links

Every goal, route version, node, relation (where practical), document, source, learning event and evidence reference has a stable ID and navigable view. Legacy entry references resolve to the real original record, never a paraphrase.

---

## 4. Core interactions

### 4.1 New goal: interview, charter, route

1. Learner writes freeform intent. Save the original text first.
2. The Guide checks the atlas, confirmed goals and approved profile facts. It does not re-ask what is known.
3. It asks **one relevant question at a time**, focused on ambiguity that changes the route: motive, scope, depth, starting point, approach, constraints, success.
4. The learner can answer naturally, accept a suggestion, say "not sure", skip, or end the interview ("Draft goal now").
5. The Guide offers an **editable charter**, listing one or two explicit assumptions if confidence is low.
6. **Confirmation** creates the versioned charter. Only then is a route drafted.
7. The route has relevant nodes, branches, rationales, search directions and one suggested next exploration.
8. The learner approves, edits or discards it. Confirming creates no "completed" knowledge.

Stopping: stop when route-critical intent is clear, when the learner asks, or when more questions add little. Target 2 to 5 questions, not a requirement; zero follow-ups is fine for an explicit goal. Resume saved drafts later. Open-ended goals ("be conversant with the major debates") are valid; do not force tests, dates or numbers.

### 4.2 Continue a goal

The goal page shows intended outcome, current route with plausible next steps, new insights affecting it, and "What's worth doing next?". No daily timer or practice chart in the hero.

### 4.3 Improvisation and replanning

| Learner says | Behavior |
|---|---|
| "I only have 20 minutes." | One lightweight suggestion (read, search, or optional practice block). |
| "I'm more interested in Feuerbach now." | Suggest a branch; explain how it serves or departs from the goal. |
| "I already know linear algebra." | Record as **self-reported**; optionally shorten the route. Never mark mastery. |
| "This book is too hard." | Suggest a gentler on-ramp or narrower prerequisite. |
| "I don't want to follow this plan." | Offer alternatives. No reprimand. |
| "Change my goal to political economy." | Short revision interview, charter vN+1, new route version. Prior versions preserved. |

Replan only on explicit request, accepted relevant knowledge change, goal edit, reported constraint change, or a quiet "route may need review" hint. Never silently replace the visible route.

### 4.4 Explore without a goal

A question or saved note creates a provisional exploration thread linked to concepts. After repeat visits the Guide may offer "Make this a goal". Until then: browse, note, add sources, no interview, no route.

### 4.5 Natural capture

- Saving a note or asking the Guide about a node is already a learning event.
- Content is indexed silently. Low-impact metadata saves immediately. Interpretation, understanding changes, new relations and inferred profile facts go to the **suggestion inbox** (quiet count, never a modal), grouped by session or document, with Accept, Edit, Dismiss, Defer. Nothing unreviewed is default-on.
- A one-line reflection, pasted excerpt (respect rights), source link or long note all feed the same evidence system.
- V1 `log_entry` stays immutable. V2 documents get append-only revisions. Raw conversation turns and imported text stay immutable.

### 4.6 Concept inspector

In order:

1. **What is it?** One line, expandable. Not a lecture.
2. **Why is it here?** Goal relevance and relations; says whether manual, V1 import, or accepted AI.
3. **Your relationship to it:** facets with text labels, never a score.
4. **Evidence and timeline:** dated quotes linking to the original note, conversation, entry or annotation, with observation type.
5. **Connections:** typed and explained; cross-domain bridges called out; provisional links distinguished.
6. **Actions:** Explore, Ask why it matters, Find sources, Add note, Add to route, Edit link.

---

## 5. Knowledge Atlas

The graph is the signature feature. The aim is a legible, evidence-linked account of what the learner knows and where they could go, not maximum node count.

### 5.1 One graph, several projections

One canonical set of node and relation records supports:

- **Global Atlas:** neighborhoods by topic and journey, with justified bridges.
- **Local Atlas:** filtered view around a journey, goal, topic or node. May look hierarchical without forcing a hierarchy into the database.
- **Route overlay:** a goal's route drawn over atlas nodes. Steps may be external tasks.
- **History view (first ship):** a dated list of graph and evidence events plus "show accepted state at date". Animated scrubbing is later.
- **Outline view:** fully functional list alternative for accessibility, dense data and small screens.

Position, zoom, expansion and selection are presentation state. Never store coordinates as semantics.

### 5.2 Node kinds

`topic`, `concept`, `skill`, `question`. Goals, sources, documents and events relate to nodes but are not drawn as equal nodes by default; they appear as overlays, annotations and inspector evidence. New node kinds need a registry entry, validation and a defined visual treatment.

### 5.3 Relation kinds

| Relation | Direction | Meaning | Constraint |
|---|---|---|---|
| `requires` | A to B | Applying A genuinely depends on B within a scope | No cycles in this subset |
| `helps_understand` | A to B | Useful context, not essential | Goal-dependent; cycles allowed |
| `part_of` | A to B | A is a component of B | No cycles |
| `contrasts_with` | A and B | Comparison illuminates a distinction | Symmetric |
| `applies_to` | A to B | A has an application in B | State scope |
| `related_to` | A and B | Defensible link not captured above | Rationale required |
| `cross_domain_bridge` | A and B | Useful link between distant neighborhoods | Specific, non-trivial rationale required |

Each relation stores claim, rationale, source refs, origin (`user`, `ai_proposal`, `import`, `curated`), status (`proposed`, `accepted`, `rejected`, `archived`), optional confidence hint, and validity dates. Symmetric relations use a canonical ordered pair. Never label every link a "prerequisite".

### 5.4 Personal state: three facets to start

V1 collapsed everything into a 0 to 5 level. V2 starts with three independent facets and adds more only when a screen needs them.

| Facet | Values | Meaning |
|---|---|---|
| `exposure` | not-recorded, encountered, revisited | Has met it. Says nothing about mastery. |
| `self_assessment` | unknown, uncertain, developing, comfortable | The learner's own report |
| `evidence` | none, thin, building, solid, with observation types | Derived from traceable observations, with what was observed |

Later candidates (not in scope now): intent, engagement, freshness, open questions.

Keep V1 `skill.level` and the 21-day evidence decay as a clearly labeled **legacy metric**. Never reinterpret it as universal concept mastery. The decay measures recent supporting observations, not forgetting.

**Evidence kinds:** `encountered`, `self_report`, `explanation_in_own_words`, `worked_example`, `successful_application`, `difficulty_report`, `source_annotation`, `manual_assertion`, `legacy_skill_event`. "I read about dialectics" supports `encountered`, not application. A model's reading of a written explanation is a tentative interpretation, never a definitive test.

### 5.5 Evidence anchoring

Each personal-state change references original material:

- `source_kind`: `log_entry | document_revision | conversation_turn | source_annotation | manual_observation | skill_event`
- `source_id`: an existing ID
- `anchor`: quoted span or structured location (offsets, paragraph, page)
- `observed_at` and `recorded_at`, kept distinct for backdated activity
- `scope` (for example "understands the definition" vs "applies independently")
- `evidence_kind`, origin, optional confidence

The system verifies the quote exists in the source. If it cannot validate support, it creates no evidence-backed claim and shows an unsupported proposal instead.

### 5.6 Bridges between distant fields

Piano and physics should eventually connect through concepts like harmonics. Implement in layers:

1. **Candidates (labels first):** shared labels or aliases, shared concepts, source co-reference. Embeddings are a later optional generator and never accept a link on their own.
2. **Semantic validation:** the AI names a precise relation and why. It must separate "same concept", "similar wording", "analogy" and "dependency or application".
3. **Rationale and evidence:** an explicit explanation plus relevant notes or grounded domain reasoning. Candidate-only links are never silently accepted.
4. **Review:** inbox item with before and after; accept, relabel, dismiss or defer. A dismissed bridge stays dismissed and is not re-proposed without new evidence.
5. **Presentation:** emphasize accepted cross-neighborhood bridges. Weak ones are dashed and off by default.

Do not claim piano and running connect because both involve "practice". Learner-pattern observations (how this person learns) live in a separate, labeled layer from conceptual edges.

**Deduplication:** aliases and an explicit merge workflow. Never merge on string similarity alone. Merges need confirmation, keep old IDs as redirects, preserve evidence, and are undoable when no conflicting later edits exist.

### 5.7 Canvas interaction

**Required:** pan, zoom, fit, search-to-focus, select, focus neighborhood, expand/collapse clusters, show relation rationale, filter by goal, journey, type, evidence and date, toggle route overlay, manual node and edge creation, switch to outline. Touch, pointer and keyboard all work.

**Progressive disclosure:**

- Far zoom: topic regions, labels, a few important bridges.
- Middle: main concepts and connections with simple evidence markers.
- Near: individual concepts, relation labels on demand, selection halo, nearby questions.
- Selection opens the inspector, never a tiny scrolling essay on the node.

**Visual rules:**

- Node kind by shape or icon and typography, not color alone.
- Exposure and evidence via ring or stroke, with a text label in the inspector: dashed outline for want-to-explore, thin solid for encountered, ink or mark treatment for evidence-supported, penciled texture for uncertain.
- Relation class by line pattern and weight; labels on focus. Route overlay in a distinct, legended stroke.
- Proposed edges never look like accepted edges.
- Shared concepts do not get one exclusive journey color.

**Clutter budget:** limit labels and edges per zoom level; aggregate neighborhoods. Never draw all edges of a large graph. Avoid unstable force-directed spaghetti. Use deterministic cluster layout for the global view and directed layout for route and prerequisite neighborhoods. Positions stay stable across revisits and unrelated writes; users can pin nodes.

**Accessibility:** keyboard navigation, an adjacent text list with the same actions, screen-reader descriptions of states and relations, reduced-motion behavior.

### 5.8 History (first ship)

Treat accepted graph changes and personal-state changes as append-only events. Provide a dated event timeline and "show accepted state at date", generated from real records. Never ask a model to invent a retrospective graph. Keep transaction time and observation time separate so a backdated import is not presented as known on that date. Animated scrubbing comes later.

### 5.9 Performance targets

- 1,000 nodes and 3,000 accepted edges stay usable via clustering, neighborhood focus and selective labels.
- Selection and inspector open immediately on a normal desktop, benchmarked in e2e against the chosen library.
- No crash or lost selection when data changes during selection. No layout jitter on unrelated writes.
- Search and outline keep working if the visualization library fails.

### 5.10 Graph library spike (Step A, required)

Build the same 1,000-node fixture in two candidates and compare on selection latency, label control, touch, keyboard access and layout stability:

- **`@xyflow/react`:** strong for custom nodes, route and prerequisite views. Does not provide global clustering or auto-layout by itself; pair with ELK or a D3 layout.
- **A canvas or WebGL viewer** (for example Sigma.js or Cytoscape.js): better for large global graphs, weaker for rich custom nodes and accessibility.

A split is acceptable (React Flow for local and route, canvas for global). Keep graph queries and view models renderer-agnostic. Record the decision in an ADR.

---

## 6. AI Guide

### 6.1 Personality

A quiet, capable navigator. Concise, specific to the actual goal, willing to say "I'm not sure", and explicit about why. It can explain a term or connection in a sentence or short paragraph when that helps choose what to learn.

Good: "A short introduction to Hegelian dialectics may help, because Marx's method grows partly out of a critique of Hegel. You probably don't need Hegel's full system for this goal."
Bad: "Lesson 1: The dialectic. Complete the following ten questions."

### 6.2 Charter (extend the existing `charter` table)

```ts
interface GoalCharter {
  id: string;
  version: number;
  journeyId: string | null;
  title: string;
  desiredOutcome: string;
  whyThisMatters: string | null;
  scope: { include: string[]; exclude: string[] };
  desiredDepth: 'orientation' | 'working_knowledge' | 'deep_study' | 'unspecified';
  backgroundSummary: string;      // learner-reported; label provenance
  successSignals: string[];       // qualitative allowed
  constraints: string[];
  approachPreferences: string[];
  uncertaintyNotes: string[];     // unresolved assumptions
  confirmedAt: string | null;
  supersedesCharterId: string | null;
}
```

Map new fields onto existing `charter` columns where they exist; add columns or a `content_json` column only for the rest. Each interviewer turn returns `next_question | draft_ready | clarification_needed` with a rationale and optional assumptions. Distinguish confirmed learner statements from AI interpretations. The learner can always finish manually.

### 6.3 Route model

```ts
type StepKind = 'explore_concept' | 'read_source' | 'search_independently'
  | 'practice_externally' | 'write_note' | 'compare_ideas' | 'other';
type Necessity = 'core' | 'helpful_context' | 'optional_tangent';

interface RouteStep {
  id: string; kind: StepKind; title: string;
  nodeIds: string[];
  necessity: Necessity;            // goal-relative
  relevanceToGoal: string;
  approach: string;                // what to do, not a rigid script
  estimatedEffort?: { low?: number; high?: number; unit: 'minutes' | 'sessions' };
  searchQueries?: string[];
  resourceIds?: string[];
  dependencies: string[];          // DAG over step IDs
  branchId?: string;
  status: 'suggested' | 'chosen' | 'visited' | 'skipped' | 'replaced';
}

interface LearningRoute {
  id: string; goalId: string; charterVersion: number; revision: number;
  rationale: string;
  alternatives: { label: string; tradeoff: string; entryStepIds: string[] }[];
  steps: RouteStep[];
  nextOptions: string[];
  basedOnGraphRevision: number;
  status: 'draft' | 'active' | 'superseded' | 'archived';
}
```

A route includes only concepts relevant to the specific goal and may deliberately omit valid prerequisites, saying why. No percentage-complete display. A visited step is not a mastered node.

### 6.4 Planning horizons

- **Goal:** broad route, branches, no assumed calendar.
- **Near:** one to three possible next investigations with rationale.
- **Moment:** "20 minutes, low energy" gets one feasible exploration.

Legacy timed `plan_item` and Focus mode survive as an **optional practice tool** (default decision, section 15), useful for motor practice like piano. They are never required for a route to progress.

### 6.5 Intent router

One natural-language composer handles these intents without exposing modes:

| Intent | Example | Behavior |
|---|---|---|
| `goal_discovery` | "I want to understand Marx" | Start or resume interview |
| `next_direction` | "What should I read next?" | 1 to 3 justified possibilities |
| `replan` | "This path isn't working" | Clarify, propose route diff |
| `relevance` | "Why dialectics?" | Brief goal-tied explanation |
| `search_guidance` | "What should I search?" | Terms, subquestions, include/exclude advice |
| `resource_search` | "Find me an introduction" | Source-aware recommendations (see 6.6) |
| `atlas_explore` | "How is sound connected to physics?" | Focus graph, explain links |
| `capture` | "I read about X and think Y" | Save text, optionally queue proposals |
| `goal_revision` | "I now care about Marx's economics" | Revision interview, charter diff, route proposal |

If intent is unclear, ask a short natural question. The UI always shows the Guide's **context target** (goal, route, node or document).

### 6.6 Research guidance (staged)

1. **Search guidance (ships first, always available):** what to look for, why, useful phrases, how introductory differs from advanced material, questions to carry into a book.
2. **Learner-supplied sources (ships with Notebook):** the learner adds a book, link or file and the route adapts around it.
3. **Verified resources (deferred, opt-in):** concrete titles, chapters and URLs only when retrieved and verified, with origin and retrieval time.

When retrieval is unavailable, give search guidance only and label it. Never invent references, chapter titles or links. Resources are a menu, not a syllabus, and nothing implies the learner must buy anything.

### 6.7 When to interrupt

- No interruption: saving raw text, navigation, relevance questions, recording a source, reading.
- Deferred inbox review: new nodes, inferred understanding, new relations, profile facts, route suggestions.
- Explicit approval: charter changes, changing established knowledge states, merges, removing relations, destructive data operations.

### 6.8 Explainability

Each recommendation carries a short structured basis: the goal and charter version served, relevant nodes and dated evidence, whether it is core, context or tangent, material uncertainty, and what would change it. The UI reveals this progressively ("Why this?"). Show a user-facing rationale, not internal reasoning or hidden prompts.

---

## 7. Notebook

A place to think and record, not an intake form.

### 7.1 Documents

Freeform notes, exploration notes (from a question or conversation), source notes, practice reflections, and read-only imported V1 entries. Documents are editable with autosave and revisions. Conversation turns, external snippets and V1 logs are immutable. Author metadata distinguishes the user's words from AI-derived text.

### 7.2 Markdown

Headings, emphasis, links, lists, task lists (formatting only), tables, blockquotes, code fences with language and copy button, horizontal rules, images after safety controls. Provide raw Markdown and rendered views with safe round-tripping of supported features.

- **Wiki links:** `[[Fourier transform]]` autocompletes and stores a stable node ID. Renaming the node keeps the link. Export degrades to readable Markdown with ID metadata.
- Links can also target goals, documents and evidence citations; backlinks appear in context panels.
- Export each document as Markdown with frontmatter or manifest mapping IDs, wiki links and attachments. Never make editor-specific JSON the only portable format.

### 7.3 LaTeX

Inline `$...$` and display `$$...$$`, responsive rendering, copyable source, and graceful error handling. Math can appear in notes, Guide messages, route rationale and annotations. Malformed math shows the original source with an inline error, never a blank view or crash. Long equations scroll or wrap without breaking mobile layout.

### 7.4 Safety and consistency

- One content pipeline for notes and Guide Markdown.
- Sanitize HTML and URLs. No raw HTML or script execution; block `javascript:` URLs and event handlers.
- Imported content, model output and source text are **data**, never instructions to the AI or the host.
- Quarantine unsafe attachments. No remote scripts or iframes.

**Candidates:** `react-markdown` with `remark-math`, `rehype-katex` and `rehype-sanitize` for rendering; Tiptap with Markdown and mathematics extensions for editing, only if real round-trip tests pass. If the editor cannot round-trip wiki links and math, ship a documented safe subset or a plain Markdown editor with live preview first.

### 7.5 Linking to the atlas

Selected text offers Link concept, Create concept proposal, Ask relevance, Add to goal. After save, AI may suggest links without altering the raw text; each suggestion shows the source quote and target. A concept inspector lists related notes with dates and source spans, not a fabricated summary. A note can be pinned to a route step without claiming understanding.

### 7.6 Conversations

Guide conversations are saved (user and model turns, context target, task and prompt version, citations), searchable, and linkable to the atlas. A model explanation is not a claim about the learner's knowledge. A requested summary is stored as a derived document citing the original.

### 7.7 Sources

A source has type, title, creator, URL or identifier, edition, notes, added date, access notes and origin (`user_added`, `web_verified`, `suggested`). Recommendations may stay unsaved. "I'm using this" and "not for me" inform guidance. PDF annotation and citation export come later.

---

## 8. Visual and interaction design

### 8.1 Keep from V1

The editorial notebook identity: cool paper, ink-first controls, Bricolage Grotesque for interface, Literata for reading and writing, hairlines, restrained highlighter marks, light and dark themes, reduced-motion support. Reuse `context.md` tokens where they still work. Journey hues remain navigation metadata.

**V2 shift:** from "a notebook where progress gets highlighted" to "an atlas on which the learner leaves marks". More spatial exploration and persistent reading context, but no neon nodes, glass panels, gamification or KPI cards.

### 8.2 Language

- **Paper and ink** as in V1; no cream and terracotta. Primary buttons stay ink, never journey colors.
- **Marks** are colored only for knowledge provenance, selection and evidence-related facts.
- **Graph:** fine lines, negative space, modest nodes, kinds distinguished by shape and text. An annotated map, not a network-monitoring console.
- **Surfaces:** margin annotations, columns and hairlines. No repeated rounded cards or card-in-card. Elevation only for sheets and popovers.
- **Motion** carries meaning (focus a neighborhood, show a newly accepted link, reveal a branch). No entrance choreography.
- **Copy:** "Why this?", "Explore", "Save note", "Suggest route", "Show evidence". No praise filler or productivity metaphors.

### 8.3 Global Atlas (desktop reference)

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Marginalia           Search anything...                         [You] [Theme]     │
├─────────────────┬───────────────────────────────────────────┬──────────────────────┤
│ Atlas  ●        │ Your atlas                                │ Selected concept     │
│ Guide           │ [All] [Piano] [Physics] [Marx] [Goals]    │ Wave interference    │
│ Notebook        │                                           │                      │
│                 │      piano          ~~~~~ physics         │ Why it's connected   │
│ Your goals      │     ○──○──○─────────○──○──○               │ ...                  │
│ Understand Marx │      \      harmonics   /                 │ Your encounters      │
│ Play a piece    │       ○              ○                    │ Nov 15  source note  │
│                 │             philosophy                    │ Nov 10  question     │
│ Recent          │              ○──○──○                      │                      │
│ Fourier series  │   [-] [fit] [+]  [Outline] [History]      │ [Explore] [Add note] │
└─────────────────┴───────────────────────────────────────────┴──────────────────────┘
```

- First view shows neighborhoods, not thousands of labeled nodes.
- Zoom or selection reveals a topic's interior. Selection persists in the inspector.
- Search lists results, centers the graph and highlights nearby relations.
- Clicking a bridge shows its explanation and evidence, not just an animated line.
- A goal route overlays without taking over; route-only nodes look different from known nodes.
- "2 connections to review" is acceptable; no scores or streaks.

### 8.4 Local Atlas

```text
Understand Marx   /   Atlas                              [Edit goal] [Ask Guide]

    Hegel ────────  ┌─────────────────────────┐ ─── Political economy
    helpful context │ Material conditions     │       core branch
                    │ and social relations    │
                    └─────────────────────────┘
    Philosophy branch                Economic branch

[Current route]  [Other possibilities]  [All related ideas]
Why these concepts? A short explanation grounded in your charter.
```

Tidy hierarchy is allowed, but not every topic is strictly parent and child. Steps are labeled core, context or optional. One tap switches to outline.

### 8.5 Guide screen

A calm conversation with a visible context header and an optional route or atlas preview. Response blocks: short answer and why, a specific next direction, optional "How to investigate", sources only when relevant. Route changes appear as before and after with Accept, Edit, Decline. No unsolicited lessons.

### 8.6 Goal interview and route

Single writing surface with conversation above, generous reading width, header "Understanding your goal", and **Draft goal now**. The charter is an editable document with collapsible Why, Scope, Background, Success, Approach, Constraints, Uncertainties; primary action "Use this goal", secondary "Discuss a change". The route page shows the charter paragraph, one highlighted suggested exploration (not a Today card), a navigable route canvas or outline (core, context, optional), alternatives with trade-offs, a quiet history of revisions and chosen branches, and controls Change goal, Rethink route, I have 20 minutes, Explore another branch. No progress ring or completion boxes.

### 8.7 Notebook screen

Document-first with a wide reading column, backlinks and source panel in a collapsible right margin, editable title, math blocks, wiki-link autocomplete and citations. A small status line shows autosave and history. "Ask Guide about selection" is contextual. No sticky toolbar over the prose.

### 8.8 Concept inspector

```text
Wave interference                                     [Open page]
Concept: encountered, understanding uncertain

Why it matters
Useful for harmonics in your piano journey and wave superposition in physics.

Related
  Superposition   helps understand
  Harmonics       applies to

In your learning history
  Nov 18  "read about phase cancellation..."   [Open note]
  Nov 12  "confused by interference..."        [Open question]

[Explore] [Find sources] [Connect] [Edit]
```

One short orientation paragraph visible by default. Quote source language exactly. Every state shows what kind of evidence it rests on.

### 8.9 Empty, loading and error states

- New atlas: "Your atlas grows from what you explore." Actions: Ask a question, Create a goal, Add a concept.
- No goal: free exploration works fully; interviewing is optional.
- No evidence: "You've saved this concept, but there isn't evidence of your understanding yet." Never "Level 0".
- AI unavailable: saved atlas and notes work; "The Guide is unavailable. Your work is saved." with Try again.
- Retrieval unavailable: search suggestions only, stated plainly.
- No bridge: never invent one to make the graph look better.
- Renderer error: outline view with the same data.
- Interview turn failed: the answer is saved; retry is idempotent.

### 8.10 Verification

Check 390x844, 768x1024, 1280x800 and 1440x900, light and dark. WCAG AA contrast, 44px targets, visible focus, text alternative for the graph. No horizontal overflow on mobile (including math, code and long titles; the graph viewport itself may pan). Test with 3, 30, 200 and 1,000 nodes, not only a pretty seven-node sample. Save screenshots to `design/current/v2/` and build against them.

### 8.11 Design tooling: Impeccable

Use the **Impeccable** design skill (works with Codex CLI) as the craft and anti-pattern layer for all UI work. It supplies deterministic checks across typography, color, layout and motion and treats product UI differently from marketing pages, which suits Marginalia.

**Install and vet (Step A):**
- Locate the official Impeccable repository by name. Do not install from a link in this file. Confirm the repo, its license and recent activity, and read its `SKILL.md` and any bundled scripts before installing, since a skill runs with the agent's permissions.
- Install into the repo scope (for example `.codex/skills/`) so the version is pinned with the project. Record the source URL, version or commit, and install date in the design ADR.
- Start a fresh Codex session afterward and confirm the skill is listed as loaded.

**How it is used:**
- For every UI task, invoke the skill for its product-UI guidance, then run its anti-pattern checks on the changed screens before screenshots are reviewed.
- Report any rule violations it finds and either fix them or explain why a project rule overrides.
- Its checks complement, and never replace, the screenshot comparison in 8.10 and the definition of done in 12.3.

**Precedence (important):** this file and the `context.md` tokens win over any design skill. Impeccable and similar skills may push bolder choices (decorative texture, heavy shadows, gradients, expressive color) than Marginalia allows. Where they conflict with sections 8.1 to 8.9, follow this file: ink actions, restrained marks, hairlines instead of cards, no decoration without meaning. Use the skill for spacing, hierarchy, type craft, motion timing and accessibility inside this design system. If a rule from the skill cannot be satisfied without breaking a project rule, note it in the step report instead of silently choosing.

---

## 9. Data architecture

### 9.1 Stack

Keep Next.js App Router, React, TypeScript, Tailwind, SQLite (better-sqlite3), Drizzle, Zod, the Codex CLI adapter and Playwright unless the audit finds a concrete reason to change. Keep database and provider access on the server. Do not adopt a graph database; SQLite adjacency queries, indexes and FTS5 are enough at personal scale.

### 9.2 Reuse-first rule

Before adding any table, check whether an existing one can be extended. Do not create a second source of approval truth or a second goal record.

| Need | Decision |
|---|---|
| Goals and charters | **Extend `charter`** (and `journey`). No `goal_v2` or `goal_charter_v2`. Add a `goal` grouping table only if one journey must hold several goals, and justify it in an ADR. |
| AI suggestions | **Extend `proposal`** with new kinds (`node_create`, `relation_create`, `facet_update`, `route_revision`, `bridge`). No `ai_suggestion`. |
| Conversations | New `guide_conversation`, `guide_turn` (Step E) |
| Documents | New `document`, `document_revision` (Step C) |
| Sources | New `resource` (minimal) (Step C) |
| Graph | New `atlas_node`, `atlas_relation`, `knowledge_observation`, `graph_event` (Step B) |
| Routes | New `learning_route`, `route_step` (Step E) |

### 9.3 New records (logical schema, verify against real tables and naming)

```text
atlas_node(id, kind, canonical_label, description_md, aliases_json,
  origin, status, created_at, updated_at, archived_at, legacy_skill_id nullable)

atlas_relation(id, source_node_id, target_node_id, kind, scope,
  claim, rationale, origin, status, confidence_hint,
  valid_from, valid_to nullable, created_at)

atlas_membership(id, node_id, journey_id nullable, goal_ref nullable, role, created_at)

knowledge_observation(id, node_id, facet, value_json, evidence_kind, scope,
  source_kind, source_id, anchor_json, observed_at, recorded_at,
  origin, status, supersedes_id nullable)

graph_event(id, event_kind, entity_kind, entity_id, before_json nullable,
  after_json, actor, proposal_id nullable, occurred_at, transaction_id, recorded_at)

document(id, title, kind, current_revision_id nullable, goal_ref nullable,
  journey_id nullable, status, created_at, updated_at)

document_revision(id, document_id, content_md, author_kind,
  based_on_revision_id nullable, created_at)

resource(id, kind, title, creator, url nullable, canonical_identifier nullable,
  origin, verification_status, verified_at nullable, access_notes, created_at)

entity_link(id, from_kind, from_id, to_kind, to_id, relation_kind,
  anchor_json nullable, created_at)

guide_conversation(id, context_kind nullable, context_id nullable, status, created_at, updated_at)
guide_turn(id, conversation_id, role, raw_markdown, model_info_json nullable,
  source_refs_json, created_at)

learning_route(id, goal_ref, charter_version, revision, rationale,
  based_on_graph_revision, status, created_at, supersedes_id nullable)
route_step(id, route_id, kind, title, description_md, necessity, rationale,
  node_refs_json, resource_refs_json, dependencies_json, branch_id nullable,
  status, position)
```

Use join tables where frequent joins need integrity and indexes (route-node, relation-evidence). JSON columns do not replace indexes. Every table follows existing conventions for IDs, timestamps (UTC), `user_id` and local dates.

**Deferred (do not build yet):** `model_job` (retry state can live on the extraction and proposal records for now), `graph_view_state` (store pinned positions in one small table only when pinning ships), `resource_annotation`, full facet set, animated history.

### 9.4 Invariants

1. Accepted relations reference existing nodes; enforce foreign keys and relation enums.
2. Symmetric relations use a canonical ordered pair.
3. `part_of` and strict `requires` reject cycles, checked in the applying transaction.
4. Proposed and accepted edges are stored and queried separately.
5. Every observation points to a real source, or is explicitly `manual` with no invented anchor.
6. Applying a proposal is atomic and idempotent and stores reversible before-values.
7. Stale model output cannot overwrite user edits; check graph and charter revision preconditions.
8. Document autosave never overwrites another revision; old revisions stay readable.
9. Renaming a node changes the label, not the ID.
10. A new route revision never rewrites older routes or the charter it came from.
11. No model task can mutate tables outside its approved domain operation.
12. Exports include manifests and ID maps for logical restoration of V2 data.

### 9.5 V1 migration

**Preflight:** back up with the SQLite backup API (or stop the server and copy DB, WAL and SHM). Restore onto a disposable DB and verify. Record each migration in `schema_migration` and write `MIGRATION-NOTES.md`.

| V1 artifact | V2 treatment | Caveat |
|---|---|---|
| `journey` | Keep; acts as topic area and membership scope | Not one journey = one goal |
| `charter` | Extend in place; keep versions and wording | Never invent missing interview detail |
| `interview` | Keep transcript; link when relevant | Offer explicit handoff for unfinished ones |
| `skill` | `atlas_node(kind=skill)` with `legacy_skill_id` | Keep hierarchy, level and notes |
| `skill.prereq_ids_json` | Accepted `requires` edges only if valid and unambiguous | Flag circular or dangling links for review |
| `skill_event` | `legacy_skill_event` observations | Preserve quote, date, 0 to 5 semantics |
| `log_entry` | Read-only events in Notebook | Raw text and IDs unchanged |
| `state_snapshot` | Legacy history | Never presented as verified truth |
| `plan_item` | Optional practice history | Not auto-converted to route steps |
| `review`, `rollup` | Searchable history | Remain snapshots |
| `proposal` | Extend; keep resolution and undo history | Never re-propose rejected items |
| `profile_fact`, preferences | Reuse | No speculative inferences |

Migrate in place behind flags; do not drop or rename tables in one pass. After backfill, reconcile counts (entries, skills, events, charter versions), verify ID links, test backdated dates, run a full export, and restore a backup. The migration must be repeatable on a snapshot and safe to retry (unique mapping IDs, checkpoints). Keep a read-only legacy view for a release cycle.

### 9.6 Search and retrieval

- **Primary:** SQLite FTS5 over documents, original events, concept labels and aliases, source metadata and conversations; indexes on goal, journey, timestamps and adjacency.
- **Graph:** bounded neighborhood expansion with edge-kind and status filters, memberships and route overlays.
- **Semantic similarity:** later, as a candidate generator only.
- **Provenance:** results carry `source_kind`, `source_id`, quote, offsets, timestamp and match reason. The context builder never strips source IDs.

---

## 10. AI architecture

### 10.1 Provider abstraction

Keep the server-side Codex CLI adapter if it works; verify behavior against the installed CLI and its authentication. Build V2 on a shared `AIProvider` / `GuideService` interface so the stub (and other providers) can be swapped in. Validate every result with Zod. A provider failure must never corrupt documents, routes, interviews or graph data.

Never expose credentials or run shell commands from model-generated text. Pasted instructions, command-looking strings and source excerpts are content. The model may only call vetted application tools with schema-validated parameters.

**Step A must test** whether the Codex CLI reliably returns the larger V2 schemas (interview turn, route, proposal batch). The result decides how much of the Guide runs live versus stubbed, and may require splitting big outputs into smaller calls.

### 10.2 Tasks

| Task | Inputs | Output | Apply policy |
|---|---|---|---|
| `interview_next` | Intent, turns, approved profile, relevant atlas | Next question or draft readiness, assumptions | Save conversation; no goal change |
| `charter_draft` | Interview, corrections | Charter draft | Explicit confirmation |
| `route_propose` | Confirmed charter, atlas subgraph, source preferences | Route, alternatives, rationale | Preview, accept or edit |
| `route_revise` | Goal, route, trigger, recent evidence | Route diff, reason | Preview; keep prior route |
| `guide_reply` | Context target, bounded evidence bundle | Short guidance with citations | Saved; no silent graph claims |
| `knowledge_extract` | New or updated document | Candidate nodes, links, facets, anchors | Review inbox |
| `bridge_propose` | Candidate pairs, goal context, evidence | Relation candidates with rationale | Review inbox |
| `node_explain` | Accepted node, evidence | Short orientation, uncertainty | Never auto-change state |
| `resource_suggest` | Goal, topic, depth (+ verified results later) | Search queries; sources when verified | Suggestions only |
| `history_summary` | Dated event windows | Grounded synthesis with source IDs | Read-only |

Background work (extraction, bridge proposals) is asynchronous and retryable and never blocks saving a note.

### 10.3 Guide tools

Read tools (bounded): `read_active_goal`, `read_charter_history`, `get_atlas_neighborhood(node, depth, edge_kinds, status)`, `get_goal_relevant_nodes`, `search_notes`, `search_learning_events`, `read_source_record`, `read_route`, and optionally `search_verified_resources`.

Write tools (narrow): `save_conversation_turn`, `create_proposal(kind, validated_payload, source_refs)`, `request_charter_draft`, `request_route_revision`.

**Never exposed to the model:** raw SQL, shell, arbitrary file access, `accept_proposal`, or any uncontrolled mutation. Acceptance and graph writes are application actions guarded by transactions and revision checks.

### 10.4 Context assembly

Task-specific, never the whole notebook. Priority order:

1. The request and explicit context target.
2. Confirmed charter, version and constraints.
3. Relevant accepted atlas neighborhood with personal-state facets.
4. Evidence excerpts with exact IDs and dates.
5. Current route and recent revisions.
6. Recent notes and turns plus retrieved older ones.
7. Approved global preferences.
8. Verified resource metadata when requested.

Use a hard token budget suited to the actual model with deterministic truncation from the bottom, and a test that unrelated journeys are excluded unless a cross-domain link is relevant. Retrieval weighs recency, user edits, provenance and relevance, not keyword overlap alone. Graph algorithms choose the neighborhood; the model explains and proposes inside it.

### 10.5 Schemas

```ts
const EvidenceAnchor = z.object({
  sourceKind: z.enum(['log_entry','document_revision','conversation_turn',
    'source_annotation','manual_observation','skill_event']),
  sourceId: z.string().min(1),
  quote: z.string().max(400).nullable(),
  location: z.object({ start: z.number().int(), end: z.number().int() }).optional(),
});

const ProposedKnowledgeChange = z.object({
  action: z.enum(['create_node','link_nodes','update_facet','create_question']),
  subjectNodeId: z.string().nullable(),
  relationKind: z.string().nullable(),
  objectNodeId: z.string().nullable(),
  rationale: z.string().min(10).max(400),
  evidence: z.array(EvidenceAnchor).max(8),
  uncertainty: z.string().max(240).nullable(),
});
```

The real schema is a discriminated union enforcing task-specific fields, known node IDs, existing anchors, relation direction constraints, length limits and a maximum batch size. Validate quotes against the source record, not just JSON shape. Retry malformed output once with a bounded error description, then mark the job failed and offer retry.

### 10.6 Proposal lifecycle

```text
note saved / request made
        |
AI proposes (nothing committed)
        |
schema + source + graph-revision validation
        |
inbox: Accept / Edit / Dismiss / Defer
        |
transactional apply + graph event
        |
Undo (with conflict check); evidence preserved
```

Aggregate suggestions per session or document. Show counts by type (new concept, new connection, understanding update) with reason, text and preview. Dismissals reduce repeats; accepted user corrections beat later AI guesses.

### 10.7 Replanning (first version)

Deterministic orchestration with the model proposing candidates:

1. Resolve confirmed goal, constraints and depth.
2. Fetch goal-attached nodes, neighbors, gaps and open questions.
3. Fetch the existing route and the learner's chosen branches.
4. Rank candidates internally by goal relevance, prerequisite necessity, uncertainty, interest, resource availability, time budget and redundancy.
5. Ask the model for up to three next directions with rationale, evidence references and search phrases.
6. Validate node IDs, cycles, unsupported success claims and staleness.
7. Show one primary suggestion and alternatives. Never overwrite the active route silently.
8. Save accepted routes as new versions.

Scores are internal. Never show "learning efficiency 92%". Learner choice always beats the ranking.

### 10.8 Evals (versioned fixtures)

- Same subject, different goals (Marx philosophy vs Marx economics) give visibly different routes.
- Claimed familiarity with Hegel shortens context but sets no observed mastery.
- "I read one paragraph about Fourier" becomes `encountered`, nothing more.
- A quote not present in the note is rejected by the validator.
- Piano and physics yield a harmonics bridge with a specific rationale.
- Piano and running yield no bridge from the word "practice".
- Search unavailable gives search terms and no invented URLs or chapters.
- Scope revision creates new charter and route versions, old history intact.
- A malicious instruction in a cited document causes no host operation or data disclosure.
- Malformed IDs in extraction trigger validation, retry, then failure with the original saved.
- A rejected bridge mentioned again is not re-proposed spammily.
- Philosophy, running and piano all fit the schemas and UI.

### 10.9 Prompts

Store in `prompts/v2/*.md` (`interview`, `charter`, `route`, `replan`, `guide`, `extract`, `bridge`, `resource`, `summary`) with the Guide philosophy, limits, output contract and a concise example. Record prompt and schema versions on the records they produce so past decisions can be audited.

---

## 11. Local-first operations, privacy, resilience

### 11.1 Deployment

Keep V1's model: one-user Next.js server on a laptop, iPad on the same Wi-Fi, local Codex CLI for live AI. Local SQLite does not mean notes stay local when a model or search call runs.

### 11.2 Privacy and permissions

- Show what will be sent to the AI when live mode is enabled; allow disabling remote model calls.
- Send bounded, task-relevant excerpts only. Never the whole atlas or notebook by default.
- Keep web resource lookup clearly separate from local search; don't send personal notes as search queries unless requested and necessary.
- Let the user opt out of stored model-derived learning-style facts and delete them.
- **Do not expose the unauthenticated LAN app through a public tunnel by default.** Before any external access add authentication, CSRF and origin protection, secure transport and access control.
- Sanitize Markdown, URLs and attachment metadata; defend against prompt injection in sources.
- Use parameterized queries, foreign keys, safe transactions and strict input limits.

### 11.3 Reliability

- Save original content before any AI call.
- Persist pending and failed work; retry idempotently with no duplicate events or route versions.
- Notes, goals, nodes and links remain manually editable with AI offline.
- JSON and Markdown exports cover graph, charters, routes, documents, sources, evidence, conversations and legacy data. Ship a tested **restore/import path**, not just export.
- Service workers may cache the shell, but do not claim cross-device offline writes until a tested queue exists. Show connection state and unsaved drafts.

### 11.4 Deletion

Deleting a goal never silently deletes shared nodes, sources or history. Offer archive, detach or permanent delete with an impact preview. Merges, unlinks and document deletion keep audit semantics until an explicit permanent deletion. Honor deletions in derived caches.

---

## 12. Quality bar

### 12.1 Tests

**Unit:** strict prerequisite cycle detection; shared-node membership; evidence quote matching; route DAG validation; graph event replay; alias and merge handling; deterministic graph projections; Markdown and LaTeX round trip; sanitizer behavior.

**Integration:** V1 migration on a copied database; save then extraction failure; accept and undo with intervening edits; interview resume after restart; route replacement preserving old versions; background job idempotency; export and import references all resolve.

**End to end (stub):** create a goal via interview, confirm charter, see a route; open a node and its exact source; write a Markdown and LaTeX note and link a concept; accept and reject a connection; browse global and local atlas; ask the Guide for search directions; work with AI unavailable.

**Accessibility:** outline alternatives, keyboard reach, screen-reader relations, dialog focus, hit targets, contrast, reduced motion; test on a real touch device before beta.

**Visual:** Playwright screenshots in light and dark at 390, tablet and 1280 for graph overview, zoom, focus, route branch, long-equation note, empty atlas, inbox, Guide conversation and an interrupted interview, using more than seven-node demo data.

### 12.2 Demo dataset (`seed:v2:demo`, isolated and non-destructive)

- **Piano:** technique, left-hand coordination, rhythm, intervals, harmonics, an unresolved issue at a specific bar, reflections, V1-style entries.
- **Physics:** wave superposition, sound, resonance, harmonics, calculus, with a real bridge to musical harmonics.
- **Philosophy:** a Marx-philosophy goal with Hegelian dialectics as helpful context, plus an alternate political-economy goal with a different route.
- **Running:** endurance, form, recovery, independent graph, **no contrived edge to piano**.
- **Notebook:** a note with headings, table, code fence, inline and display math and `[[concept]]` links; a source note; a short reflection.
- **Inbox:** one useful bridge, one weak bridge, one disputed prerequisite, one unsupported mastery claim that must fail validation.
- Reproducible 3, 30, 200 and 1,000-node fixtures, and an interview stopped mid-way.

### 12.3 Definition of done for a V2 feature

- Honors the principles (no tutoring push, completion meters or mandatory logging).
- Works with the live adapter and the stub, or documents the live limitation.
- Validates schemas and preserves user content through errors.
- Has keyboard and touch support and a text fallback for complex graph interaction.
- Looks intentionally designed in light, dark, mobile and desktop; screenshots inspected against this file.
- Has tests for behavior, failure, undo, privacy and old-data compatibility.
- Adds no new source-of-truth table where existing provenance or approval records can be extended.
- Has docs, migration notes and a manual acceptance scenario.

### 12.4 Release acceptance (ten scenarios, no tutorial needed)

1. Start "Understand Marx's philosophy" as a rough sentence, answer adaptive questions, edit and approve a charter.
2. See a goal-specific route, including why Hegelian dialectics may matter, distinct from an economics-oriented route.
3. In the Atlas, inspect Hegelian dialectics, see why it is in the route, and find the linked goal.
4. Ask for research directions and, where available, concrete sources; see which are verified and which are search suggestions.
5. Write a Markdown and LaTeX note, link it to a concept, and open the exact note as evidence.
6. Switch branches after a change of interest and see a route revision with no missed-task warning.
7. Inspect a global graph with piano, physics and running: a meaningful harmonics bridge, and no invented running bridge.
8. Open a dated event history or accepted state at an earlier date, with nothing retrospectively fabricated.
9. Disconnect AI and keep reading, writing and searching notes and the graph without data loss.
10. Open historical V1 entries and confirm they are byte-for-byte intact with all old IDs reachable.

---

## 13. Build roadmap for Codex

**Order:** protect data, prove a usable local Atlas, add natural capture, add global connections, add goals and the Guide, then consolidate. Do not build a speculative recommendation engine early.

Every step requires: implementation notes, a limited diff, automated tests, screenshot evidence, migration and rollback implications, known limitations, and a short report saying what the next step may assume. At the start of each step report: relevant repo state, files and migrations to touch with compatibility risks, the single first vertical slice, and any product ambiguity (default to this file).

### Step A: Safety and audit (small)

**Build:** repo inventory; tested backup and restore on a disposable copy; V2 feature flag; ADRs for graph renderer (with the 5.10 spike on a 1,000-node fixture), Markdown/LaTeX editor, schema strategy and provider boundary; a Codex structured-output test using the V2 schema sizes (10.1); the Impeccable design skill vetted, installed in repo scope and recorded in a design ADR (8.11). No product rewrite and no static prototype set.

**Done when:** a backup restores on a fresh copy; production data is untouched; inventory is accurate; library choices are documented with measurements; the structured-output test results are reported; Impeccable is confirmed loaded in a fresh Codex session, with its source and version recorded.

### Step B: Local Atlas from V1 data

**Build:** `atlas_node`, `atlas_relation`, `knowledge_observation`, `graph_event`; backfill from V1 skills, prerequisites and skill events; V2 shell (Atlas / Guide / Notebook nav behind the flag, legacy routes intact); local Atlas graph with outline fallback; inspector showing dated entries and quotes, each opening the original entry; manual node and edge creation through proposals.

**Done when:** every V1 skill is reachable; counts reconcile on a copy; cycles in strict edges are rejected; a node opens a real source citation; the 1,000-node fixture does not crash; moving layout changes no semantic link.

### Step C: Notebook and natural capture

**Build:** `document`, `document_revision`, `resource`, `entity_link`; Markdown rendering and editing with LaTeX, code, tables and `[[concept]]` links stored by ID; backlinks; source notes and learner-supplied sources; saving a note queues `knowledge_extract` without blocking; suggestion inbox (extending `proposal`); FTS5 over documents and events.

**Done when:** a malformed equation still shows its source; a renamed concept's link still resolves; a note survives failed extraction; accepting one suggestion does not require accepting others; Markdown export round-trips; V1 entries are unchanged.

### Step D: Global Atlas and bridges

**Build:** global neighborhoods and clustering; label and alias bridge candidates; `bridge_propose` with rationale; review in the inbox; merge and alias flow; global and local switch; filters; dated event history and "accepted state at date"; performance work to the 5.9 targets.

**Done when:** piano and physics link through harmonics with an intelligible rationale; running is not connected to piano; a rejected bridge stays rejected; the 1,000-node fixture is usable with progressive detail; history at an earlier date reflects accepted records only; unrelated note saves cause no layout jump.

### Step E: Goals and the Guide

**Build:** freeform interview with resumable turns; charter draft, edit and approve with versions (extending `charter`); `learning_route` and `route_step` with validation; route overlay on the Atlas; Guide UI with visible context target, intent router, bounded read tools, replan diff and approval; search guidance and learner-supplied sources; optional timed practice tool preserved. Hook the live Codex adapter after stub behavior is stable.

**Done when:** Marx philosophy and Marx economics give visibly different routes; revising a goal preserves old charters and routes; core, context and optional are visible and meaningful; "Why is dialectics relevant?" gets a short goal-aware answer; "20 minutes" gets one feasible suggestion; a provider failure leaves saved routes unchanged; unrelated journeys stay out of task context.

### Step F: Consolidation and beta

**Build:** retire Plan, Focus and Log as primary screens (keep reachable as optional tools and legacy routes); export and tested restore; recovery from interrupted work; the remote-access security decision; real iPad and touch verification; docs, seeds, backup and upgrade guidance.

**Done when:** all ten scenarios in 12.4 pass; clean install and V1 upgrade are both reproducible; histories survive restart; remote exposure is secure or explicitly unsupported; lint, build, unit, integration and screenshot suites pass.

### Later (not in this release)

Verified web resources with retrieval-time provenance, animated history scrubbing, embedding-based bridge candidates, the full facet set, PDF annotation, citation export, `model_job` queue if retry state outgrows the existing records.

**Never treat a step as done because TypeScript builds while the experience is generic or broken.**

---

## 14. Codex prompts

### 14.1 Step A (paste-ready)

```text
You are upgrading the existing Marginalia app to Marginalia 2.0.

Read MARGINALIA-V2.md fully, then inspect the actual repository, including
app.md, context.md, AGENTS.md, README.md, PRODUCT-PLAN.md if present,
package.json, the SQLite schema and migrations, lib/ai/codex.ts,
lib/ai/context.ts, lib/db/apply.ts, the routes and the Playwright tests.

Do Step A ONLY (section 13). Do not recreate the app, delete legacy schema,
introduce a hosted database, or touch production data.

Deliver:
1. Repository inventory: what already works, what V2 needs new, and any
   differences between the docs and the code.
2. A verified SQLite backup and restore procedure, tested on a disposable
   copy, plus a migration-risk map.
3. A V2 feature flag.
4. ADRs: graph renderer and layout (include a spike of @xyflow/react and one
   canvas viewer on a generated 1,000-node, 3,000-edge fixture, with measured
   selection latency and keyboard/touch notes), Markdown/LaTeX editor and
   renderer, schema strategy (extend charter and proposal; list new tables),
   and the Codex provider boundary.
5. A Codex structured-output test using schemas of the size in section 10.5
   (interview turn, route proposal, proposal batch); report reliability and
   whether outputs must be split.
6. The Impeccable design skill, installed per section 8.11: find the
   official repo by name, vet its license and SKILL.md, install in repo
   scope, confirm it loads in a fresh session, and record source and
   version in a design ADR. Where it conflicts with section 8 of
   MARGINALIA-V2.md or the context.md tokens, the project files win.
7. A Step B plan with an acceptance checklist.

Show what was tested, what remains uncertain, and how existing data is
protected. Do not start Step B until these are reported.
```

### 14.2 Step B (use after Step A is reported)

```text
Do Step B of MARGINALIA-V2.md: the local Atlas from V1 data.

Use the ADR decisions from Step A. Back up first. Add atlas_node,
atlas_relation, knowledge_observation and graph_event through a versioned,
retry-safe migration. Backfill from V1 skills, prerequisites and skill events
as described in 9.5, flagging invalid or circular prerequisites for manual
review. Build the V2 shell behind the flag (Atlas / Guide / Notebook), the
local Atlas graph with an outline fallback, and the concept inspector with
dated quotes that open the original entries. Manual node and edge creation
goes through proposals.

Follow the design rules in section 8 and use the Impeccable skill for UI work
(section 8.11); run its anti-pattern checks on the changed screens and report
violations. Take screenshots at 390 and 1280, light and dark, using the 3, 30,
200 and 1,000-node fixtures, and fix differences.
Report acceptance results for Step B before stopping.
```

### 14.3 AGENTS.md addition

Append, do not overwrite valid existing instructions:

```markdown
## Marginalia V2

Read `MARGINALIA-V2.md` before any V2 work. It overrides V1 product and screen
behavior where they conflict; `context.md` still supplies compatible visual
tokens and legacy requirements.

- Preserve existing user data and raw learning history. Back up before migrating.
- Atlas nodes and relations are canonical. Routes are goal-conditioned proposals.
  Layout is never semantic data.
- The AI is a guide, not a default tutor. No forced exercises or daily logs.
- Extend `charter` and `proposal`; do not add parallel goal or suggestion tables.
- AI semantic writes are validated proposals, never silent mutations.
- Notes support Markdown and LaTeX. Source and evidence links must resolve.
- Build only the current approved step. Keep stub AI and legacy routes working.
- Inspect light and dark, mobile and desktop screenshots, and test failure states.
- For UI work, use the Impeccable design skill and run its anti-pattern checks.
  Where any design skill conflicts with `MARGINALIA-V2.md` section 8 or the
  `context.md` tokens, the project files win.
```

---

## 15. Decisions and defaults

| Decision | Default | Reconsider if |
|---|---|---|
| AI role | Self-directed Guide with optional short explanations | Owner asks for tutoring |
| Navigation | Atlas / Guide / Notebook | Usability testing says otherwise |
| Goal creation | Adaptive interview before a formal route | The goal is deliberately exploratory |
| Optional timed practice | **Keep Plan and Focus as an optional tool** for motor practice, outside the main flow | Owner prefers removing them |
| Bridge candidates | **Shared labels and aliases first**, AI rationale required; embeddings later | Labels prove too sparse across domains |
| Codex structured output | Test in Step A; split large outputs if unreliable | Tests show it handles full schemas |
| Personal state | Three facets (exposure, self-assessment, evidence) plus legacy level | A screen needs more facets |
| History | Event list and accepted state at date | Owner wants animated scrubbing |
| Resources | Search guidance and learner-supplied sources first; verified web resources deferred | Retrieval is available and approved |
| Graph persistence | SQLite adjacency plus events | Measured scale demands otherwise |
| Design skill | Impeccable, vetted and pinned in repo scope; project design rules take precedence | Vetting fails, or it keeps conflicting with section 8 |
| Provider | Existing Codex CLI adapter with stub fallback | Audit requires a change |
| Hosting | Local, private single-user host | Owner opts into a secure alternative |
| Migration | Additive, reversible where practical, tested on a copy | A clean install has no V1 data |

### Unknowns Codex must verify, not invent

- Real repository versions, folders, scripts and migrations, and whether V1 onboarding matches `context.md`.
- Whether the installed Codex CLI supports the structured output and tool boundaries required.
- Whether the chosen graph viewer meets accessibility and 1,000-node targets on real devices.
- Whether the chosen editor round-trips Markdown, wiki links and LaTeX; otherwise ship a documented safe subset.
- Licensing and availability of any search integration or commercial extension. Do not buy or assume paid integrations without approval.
- The network exposure, backups and authentication actually configured on the host.

---

## 16. References

Project sources: `app.md` (implemented V1), `context.md` (V1 specification). `PRODUCT-PLAN.md` is only assumed to exist; inspect it before relying on it.

Candidates for evaluation, not approved dependencies (pin versions only after Step A):

- React Flow: <https://reactflow.dev/>
- Tiptap Markdown and mathematics: <https://tiptap.dev/docs/editor/markdown>, <https://tiptap.dev/docs/editor/extensions/nodes/mathematics>
- `react-markdown`: <https://github.com/remarkjs/react-markdown>; `remark-math` and `rehype-katex`: <https://github.com/remarkjs/remark-math>; `rehype-sanitize`: <https://github.com/rehypejs/rehype-sanitize>

---

## Final product test

**A learner can tell Marginalia what they want to understand, have the Guide discover what that means, see a goal-specific route drawn through their existing knowledge, learn independently with whichever materials they choose, save thinking naturally in a Markdown and LaTeX notebook, and watch an evidence-backed Knowledge Atlas evolve, without being forced into lessons, schedules or logs.**
