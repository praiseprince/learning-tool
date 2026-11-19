# Project instructions

Read context.md before starting any task. It is the source of truth for product, design and build order.

- Follow the phases in section 15, one at a time.
- Design values come from sections 7 and 8, structure from section 11. Do not use raw hex or off-scale spacing.
- Highlighter color is data only. Buttons and links are ink. Two typefaces. No all caps, no card-in-card.
- Develop with AI_PROVIDER=stub until Phase 3.
- Every AI write goes through the proposal table. Entries are immutable.
- A UI task is not done until you have run npm run shots, compared the screenshots, and fixed the differences.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
