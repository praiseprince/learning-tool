# Project instructions

Read `README.md` (what the app does and how it runs) and `DESIGN.md` (structure, look and UI rules) before starting any task.

## Product rules
- Chat-first: one thread per goal plus the goal panel. One tap for common actions. Follow `DESIGN.md`.
- The database is the Guide's memory; agent sessions are disposable. Never rely on a session for anything the database should hold.
- Every AI write is a proposal the learner accepts inline (`proposal` table). Nothing the AI suggests changes data until accepted. Logged entries are immutable.
- Extend `charter` and `proposal`; do not add parallel goal or suggestion tables.
- Atlas nodes and relations are canonical and shared between goals. Routes are goal-conditioned proposals. Layout is never semantic data.
- The Guide is a guide, not a default tutor: no forced exercises or daily logs.
- Notes support Markdown and LaTeX. Source and evidence links must resolve; check links in the app, never trust the model's claim.
- Preserve user data and raw learning history. Back up before migrating, resetting or deleting (`backupBeforeReset`).

## Agent rules
- Agent work lives in `lib/agent/`. The agent only writes inside `data/workspace/<goal>/out/<job>/`; everything it wants to change is a proposal.
- Validate all agent output with zod.
- Both engines (Codex, Claude Code) must keep working, and so must `AI_PROVIDER=stub`, which tests and screenshots use.
- Never load this repository's instructions into the Guide: Codex runs with `-c project_root_markers=[]`, Claude Code with `--setting-sources ""`.

## UI rules
- Use tokens from `app/theme.css`; no raw hex in components.
- The Map is a grid (controls | canvas | details) with a List fallback. Never float panels over the canvas.
- No browser dialogs (`confirm`, `alert`); confirm in place.
- A UI task is not done until you have run `npm run shots`, looked at the screenshots (390 and 1280px, light and dark, including worst-case data) and fixed what is wrong. Test failure states too.
- For UI work, the Impeccable design skill and its anti-pattern checks apply. Where a design skill conflicts with `DESIGN.md`, `DESIGN.md` wins.

## Mac app
- `desktop/` is the Tauri app: `src-tauri/src/main.rs` (window, menu bar, server lifecycle) and `bundle.mjs` (standalone server plus Node.js). Build with `npm run app`.
- The app's server must keep working without the checkout: anything read at runtime through `process.cwd()` has to be copied in `bundle.mjs`, and data paths come from the environment (`DATABASE_URL`, `MARGINALIA_WORKSPACES`, `FIRECRAWL_HOME`).
- Quit and a killed app must both stop every process the server started (process group plus `lib/watchdog.ts`). Test both after changing anything that spawns.

## Before committing
`npx tsc --noEmit`, `npm run lint`, `npm test` and `npm run build` must pass (the build also typechecks the tests).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
