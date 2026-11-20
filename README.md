# Marginalia

A personal learning app for one learner, built around a conversation with a Guide that knows your whole learning history. Goals, sessions, notes, files and a knowledge map live in SQLite on your own computer (`data/app.db`). The Guide is a real agent (Codex or Claude Code), and the database is its memory.

## What you can do

Open the app and you are in the chat for your current goal, with that goal's roadmap, week, materials and skills beside it. Switch goals from the top bar; the Map, Notes and Settings are one click away, and ⌘K searches everything, past conversations included.

In the chat, just say things:
- **"I have 30 minutes and I'm a bit tired"** gives a plan with timed steps that name your own materials and where to continue. Tap how each step went, then **Save this session**.
- **"I practised the left hand for 20 minutes"** logs it, and the Guide offers the skill updates it drew from it.
- **Any question** is answered from your own sessions and notes; it says when it searched the web. With Claude Code the answer appears as it is written.
- **Find materials** searches the web, reads each page and suggests real ones; the app re-checks every link itself.
- **Share files** by dropping, pasting or attaching up to 6 at a time (images including iPhone HEIC, PDF, Word, text, data or code; 20 MB each). They get feedback, or the Guide works from them when you ask about them. Every goal has a **Files** tab.
- **Plan my week**, **Quiz me** (a finished quiz counts as a session) and **Practice sheet** are one tap each.
- **Save to notes** under a longer answer keeps it in your notebook.
- **Worth remembering**: when you mention something about yourself that matters (a new job, a time limit), the Guide offers to remember it in every goal.

Everything the Guide proposes appears as a card you accept or dismiss; nothing changes until you do. Write ahead while it is working and your message waits its turn. If a turn fails, **Try again** repeats it.

**Removing and deleting.**
- **Remove** under any of your messages deletes it and the Guide's replies, with a few seconds to undo. It also goes from the Guide's memory and from both engines' saved transcripts. Anything you already accepted from that exchange stays.
- Goals can be paused or archived (hidden, everything kept). Only an archived goal can be **deleted** for good; a database backup is made first and the goal's files are kept beside it.

**Adding a goal** is a short interview: you say what you want, the Guide asks one question at a time, then shows what it understood for you to correct and confirm. You can revise a goal later; each revision is a new version.

## How the Guide works

Before each turn the app rebuilds the goal's workspace (`data/workspace/<goal>/context/`) from the database. It contains:
- a short **brief** of where you are;
- the goal and roadmap, and the whole chat;
- skills and evidence, the knowledge map, sessions, notes and materials;
- facts about you, preferences, shared files;
- notes from your other goals.

The brief goes into every task; the agent opens only what else it needs. It writes files only inside `out/<job>/`.

- **Claude Code** continues its session while you are active (30 minutes, 12 messages, or until it gets large) and then starts fresh. **Start fresh** under the latest reply does it at any time.
- **Codex** starts fresh every message and keeps no transcript on disk. Continuing a Codex session costs more than starting over.

Nothing is compacted or lost either way, because the memory is the database. Measured per message: Codex about 25k tokens for a simple question (75k when it opens notes), Claude Code about 31k fresh.

**Firecrawl Local** ([firecrawl/apps/local](https://github.com/firecrawl/firecrawl/tree/main/apps/local)) lets the agents read whole web pages. It is one binary, with no API key, account or Docker. `npm install` builds it into `.tools/bin` when Rust is installed (`npm run setup:firecrawl` rebuilds). The app starts it on 127.0.0.1:3002 when needed with `FIRECRAWL_CLOUD=off`, so nothing goes to Firecrawl. `FIRECRAWL_URL=off` disables it.

## Run

```
npm ci
npm run local:prod
```

That builds and starts the production server; `npm run local` runs the development server instead.

The Guide uses the installed Codex CLI by default (`codex login status` to check). Switch to Claude Code (`claude`, signed in) in Settings. Optional overrides:

| Variable | What it does |
| --- | --- |
| `AI_PROVIDER=stub` | Runs every flow offline, without model calls (see `.env.example`). |
| `AI_MODEL` | Overrides the Codex model. |
| `CLAUDE_MODEL` | Overrides the Claude Code model. |
| `DATABASE_URL` | Uses another database file. |
| `MARGINALIA_WORKSPACES` | Puts the workspaces somewhere other than `data/workspace`. |

**Signing in.** Every device signs in once with a PIN and stays signed in for 30 days.
- Set the PIN on the Mac with `node scripts/pin.mjs`. It is stored only as a hash.
- After five wrong tries, sign-in locks for one minute, then twice as long after each further wrong try, up to a day. `node scripts/pin.mjs --unlock` clears the lock.
- **Settings → Devices** lists signed-in devices, signs them out, and changes the PIN.
- `MARGINALIA_AUTH=off` turns sign-in off, for tests only.

**Who can open it.** The server listens on all network interfaces and prints a Wi-Fi address, so a phone or iPad on the same network can open it after signing in. The Wi-Fi address is plain HTTP, so on a shared network someone could capture the PIN as it is sent. Use the tunnel (HTTPS) there instead.

## Your data

**Settings → Your data** has three things:
- **Downloads:** JSON, Markdown, or everything as a .zip with your files.
- **What the Guide has noticed about you:** editable.
- **Reset:** always backs up the database first and keeps your files.

To back up by hand: `node scripts/sqlite-snapshot.mjs backup data/app.db marginalia-backup.db` (pick a new filename). To try a restore without touching the original:
1. `node scripts/sqlite-snapshot.mjs restore marginalia-backup.db restored.db`
2. `DATABASE_URL=./restored.db npm run local` on a free port.

Stats, as counted:

| Measure | Meaning |
| --- | --- |
| Sessions | Saved practice entries; two on one day count twice. |
| Minutes | Recorded practice time, with accepted corrections. Entries without a duration add zero. |
| Practice days | Distinct dates with practice; rest days and notes are excluded. |
| Skill level / evidence | Level is recorded ability; evidence is what you logged in support. Time alone does not establish mastery. |

Weeks start on the day chosen in Settings. Backdated entries count on their practice date.

## Development

Project rules for coding agents: [`AGENTS.md`](AGENTS.md). Design rules: [`DESIGN.md`](DESIGN.md).

| Command | What it does |
| --- | --- |
| `npm test` | Runs the unit and integration tests (stub provider, throwaway databases). |
| `npm run lint` | Lints the code. |
| `npm run build` | Builds the app; it also typechecks the tests. |
| `npm run shots` | Builds, seeds throwaway showcase and worst-case data, and screenshots every screen at 390 and 1280px in light and dark into `design/current`. It fails on overflow, page errors or a non-200 page. |
| `npm run seed:showcase` | Loads demo goals (Marx, Plato, a 5K, piano) into an empty database. |
| `npx tsx scripts/seed-live-demo.mts` | Fills an empty database with five goals and runs the live Guide on each. |
| `npm run evals` | Runs session extraction on 12 synthetic entries with the live Codex CLI (uses your allowance). |

Open the development server via `localhost`, not `127.0.0.1`. The 3D Map needs WebGL; for headless screenshots launch Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader`.
