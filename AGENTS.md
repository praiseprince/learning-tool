# Project instructions

Read README.md and DESIGN.md before starting any task. context.md is the V1 product reference; its visual design is superseded by DESIGN.md.

- Follow the phases in section 15, one at a time.
- Structure comes from context.md section 11. **The design system is in `DESIGN.md` (supersedes the paper-and-ink rules in context.md sections 7-8 and MARGINALIA-V2.md section 8).** Use tokens from `app/theme.css`; no raw hex in components.
- Follow `DESIGN.md` (chat-first: one thread + goal panel; one tap for common actions; AI proposals appear inline and need acceptance).
- Develop with AI_PROVIDER=stub until Phase 3.
- Every AI write goes through the proposal table. Entries are immutable.
- A UI task is not done until you have run npm run shots, compared the screenshots, and fixed the differences.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
- Agent work lives in `lib/agent/`. The agent only ever writes inside `data/workspace/<goal>/out/<job>/`; every change it wants to make is a proposal the learner accepts. Validate all agent output with zod; check links in the app, never trust the model's claim.
- The Map is a grid (controls | canvas | details) with a List fallback. Never float panels over the canvas.
- For UI work, use the Impeccable design skill and run its anti-pattern checks.
  Where any design skill conflicts with `MARGINALIA-V2.md` section 8 or the
  `context.md` tokens, the project files win.
