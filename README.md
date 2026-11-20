# Marginalia

A personal, AI-guided learning environment for one learner. Journeys, practice entries, notes and a knowledge atlas live in SQLite on the computer running the app (`data/app.db` by default).

**One screen.** Marginalia is a conversation with a Guide that knows your whole learning history. Open it and you are in the chat for your current goal, with that goal's roadmap, materials, skills and week on the right. Switch goals from the top bar. Everything else (the 3D Map, Notes, Settings) is one click away.

In the chat you can just say things:
- "I have 30 minutes and I'm a bit tired" → a plan card with timed steps, each naming your actual material and where to continue ("Alfred's, Level 1, p. 58"). Tap how each step went, then **Save this session**.
- "I practised the left hand for 20 minutes" → logs it, and the Guide offers the skill updates it took from it (you confirm with one tap).
- Any question → the Guide answers from your own logs and notes, and says when it searched the web.
- **Find materials** → it searches the web, opens each page, and returns real suggestions; the app re-checks each link itself. You add the ones you want.
- **Attach work** (photos, PDFs, text) → specific feedback, and evidence only where your own words support it.
- **Plan my week** (or "plan my week, I'm away Thursday") → the Guide reads the last two weeks, says what moved and what stalled, and drafts one line per day, rest days included. **Use this week**, or **Change it** and say what to change. An accepted week shows in the panel, and **Plan today** then starts from today's slot without asking.
- **Quiz me** → retrieval practice written from your own notes and sessions: try to answer, reveal, say honestly whether you had it. A finished quiz is saved as a session, so what you missed reaches your skills and later plans. Every note also has **Quiz me on this note**.
- **Practice sheet** → exercises, handouts or generated files, saved as AI-labelled notes.
- **Save to notes** under any longer answer keeps it in your notebook, so the knowledge base grows from conversations too.

**Adding a goal** is an interview (`/goals/new`): you say what you want, the Guide asks one relevant question at a time, then shows what it understood for you to correct in words and confirm. **Revise a goal** any time from the panel; each revision is a new version, history and evidence are kept.

**The Guide is a real agent, and the database is its memory.** It runs on Codex or Claude Code (choose in Settings). The session is disposable and the database is not: Claude Code continues its session while you are active (30 minutes, 12 turns, or until it gets large), then starts fresh; Codex starts fresh every turn (measured: continuing a Codex session costs more than starting over). Nothing is ever compacted. A continued turn is told which context files changed since its last turn. Before each turn the app rebuilds the goal's sandboxed workspace (`data/workspace/<goal>/context/`) from the database: the goal and roadmap, the whole chat (recent part plus an archive), skills and evidence, the knowledge map, every session and note, materials, profile facts, preferences and calendar, plus a `library/` of notes from your other goals. The agent reads what the task needs and searches the rest. It finds pages with its own web search and reads them in full through **Firecrawl Local** (below), and writes files only inside `out/<job>/` (Codex: workspace-write sandbox; Claude Code: path-scoped permissions, no user settings or MCP servers). Everything it proposes appears in the chat as a card you accept or dismiss; nothing changes until you do. Progress streams live. In `AI_PROVIDER=stub` mode the same flows run on offline stub results.

Other screens: **Map** (a 3D graph of everything you know; hover for a tooltip and to light up neighbours, drag to pin, double-click to open, filter, colour by goal or level, overlay your roadmap, keyboard navigation), **Notes** (list and editor, Markdown and LaTeX, **Refine** tidies what you typed with a side-by-side), ⌘K searches everything.

Visual identity and design rules: [`DESIGN.md`](DESIGN.md). Product and AI specification: `MARGINALIA-V2.md`; V1 reference: `context.md`; data migration: `docs/v2/MIGRATION-NOTES.md`; release checks: `docs/v2/beta.md`.

## Run

```
npm ci
npm run local
```

`npm run local:prod` builds and runs the fast production server (recommended for daily use); `npm run local` runs the development server. Either way it starts the app with the V2 workspace enabled on all interfaces and prints a Wi-Fi address, so an iPad on the same network can open it. Press ⌘K / Ctrl+K anywhere to jump to a page, journey or concept. `npm run seed:showcase` loads detailed demo data (Marx, Plato, a 5K, piano with singing and chords) into an **empty** database: delete `data/app.db*` first, and back it up with `scripts/sqlite-snapshot.mjs`. Use `AI_PROVIDER=stub` (see `.env.example`) to run without model calls; the default provider is the installed Codex CLI (`codex login status` to check); switch to Claude Code (`claude`, signed in) in Settings. `AI_MODEL` overrides the Codex model and `CLAUDE_MODEL` the Claude Code model.

**Firecrawl Local** ([firecrawl/apps/local](https://github.com/firecrawl/firecrawl/tree/main/apps/local)) is one binary with no API key, account or Docker. `npm install` builds it into `.tools/bin` when Rust is installed (`npm run setup:firecrawl` to rebuild; it skips quietly without Rust). The app starts `firecrawl-local serve` on 127.0.0.1:3002 the first time the Guide needs the web and stops it on exit, with `FIRECRAWL_CLOUD=off`, so nothing is sent to Firecrawl. The agents get one extra tool, `read_page` (whole page as Markdown, JavaScript rendered with your installed Chrome); every page read is logged, and suggested materials are verified against that log, then by the app's own fetch with Firecrawl as fallback. `FIRECRAWL_URL=off` disables it. For a production run: `npm run build`, then `MARGINALIA_V2=1 npm run start:lan`.

## Stats, defined

| Measure | Meaning |
| --- | --- |
| Sessions | Saved practice entries; two on one day count twice. |
| Minutes | Recorded practice time (accepted corrections applied). Entries without a duration add zero. |
| Practice days | Distinct dates with practice. Rest days and notes are excluded. |
| Skill level / evidence | Level is recorded ability (legacy 0-5); evidence is logged support. Practice time alone does not establish mastery. |

Weeks start on the day chosen under **You**. Backdated entries count on their practice date.

## Optional remote access

Marginalia is a single-user app for a trusted Wi-Fi network. Anyone who can reach the origin can read or change the notebook. Public access to the origin is unsupported. The optional command `npm run tunnel -- <named-tunnel>` uses a preconfigured Cloudflare Tunnel. Only use it behind an identity policy that you have tested from a signed-out browser; Marginalia does not set up or verify that policy.

## Back up, upgrade and restore

Before upgrading, run `node scripts/sqlite-snapshot.mjs backup data/app.db marginalia-backup.db` from the repository. Supply a new output filename. SQLite includes committed changes from the write-ahead log. The command checks the snapshot before publishing it.

Run `npm ci` after upgrading and start with `npm run local`. Opening the V2 workspace imports existing skills and observations. The original journey, goal, journal and practice URLs remain available. To test a restore, run `node scripts/sqlite-snapshot.mjs restore marginalia-backup.db restored.db`, then `DATABASE_URL=./restored.db npm run local` on a free port. The restore leaves the original database in place.

## Development

Run `npm run lint` and `npm run build`. `npm run seed:demo` fills a database with demo journeys (use a disposable `DATABASE_URL`); `npx tsx scripts/seed-live-demo.mts` fills an empty database with five real goals (Spanish, linear algebra, a half marathon, fingerstyle guitar, the Roman Republic), three weeks of history and notes, then runs the live Guide on each; `npm test` runs the week-plan and quiz tests. `npm run shots` builds, seeds throwaway showcase and worst-case data, and screenshots every screen at 390 and 1280px in light and dark (into `design/current`); it fails on overflow, page errors or a non-200 page. The 3D Atlas needs WebGL; for headless screenshots launch Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader`. In `next dev`, open the app via `localhost`, not `127.0.0.1`.

## Learning entries and stats

Open a journey and choose **Log a session** under **This week**. Practice entries contribute to session count, distinct practice days and recorded minutes. Rest days appear in the weekly activity view. Minutes accepted during review count toward totals. Undo restores the previous values.

Session extraction defaults to the installed Codex CLI. Run `codex login status` under the account starting Marginalia to check authentication. Codex processes the entry and the journey’s skill list using that account. Set `AI_PROVIDER=stub` to run extraction locally without model calls. Journey drafts, session plans and weekly reviews use the same provider.

Run `npm run evals` to exercise 12 synthetic entries with the live Codex CLI. This uses the authenticated account’s model allowance.

## Installed app and exports

On a secure origin, the production build registers a service worker and can be added to a home screen. Plain HTTP on a Wi-Fi address supports the journal. Service workers and screen wake lock require HTTPS or localhost.

Open **You** to set the theme and week start, edit profile facts, or download JSON and Markdown. **Goal** keeps an immutable version history, including restored versions.

Plans and extractions use a bounded history of recent entries, relevant older entries, and summaries of completed periods. **Skills → View prerequisites** shows which skills come first. Under **You**, a daily reminder can be enabled for the current browser while Marginalia is open. Run `node evals/context.mjs` to check long-history limits and separation between journeys.
