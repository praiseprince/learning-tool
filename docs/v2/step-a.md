# Step A · Inventory and decisions

The starting commit is a3579fe. The application uses Next App Router with SQLite WAL, prepared mutations, Drizzle reads, server-side Codex and a deterministic stub. The seed, 12 log evals, long-history test and responsive screenshot harness exist. Current onboarding is an adaptive two-part interview. The dashboard opens all journeys. The original V1 specification predates both changes.

## Data boundary

Runtime initialization creates more tables than the four in the Drizzle declaration and initial migration. IDs are strings. There is no user_id. Manual skill events use an empty entry reference. A timestamp on an event and the local practice date can differ. Undo can remove a V1 event. The present context builder truncates serialized passages and lacks V2 source anchors. The existing proposal table includes automatically applied interpretations. V2 needs explicit domain and revision checks around semantic writes. Existing skill levels must retain their original meaning.

Use MARGINALIA_V2=1 to opt into V2 routes when available. An unset flag keeps V1. Use additive, transactional migrations with a migration ledger, legacy ID mappings and separate accepted state and proposal payloads. Extend charter and proposal for additional content. Preserve all raw entries and early interview versions.

## Recovery rehearsal

Run the following with fresh destination paths. The backup API includes committed WAL contents. Each command verifies integrity before publishing the new file and refuses to overwrite an existing destination.

    node scripts/sqlite-snapshot.mjs backup source.db backup.db
    node scripts/sqlite-snapshot.mjs restore backup.db restored.db

A new disposable demo database was seeded, backed up and restored. The complete SQL dumps of source and restored databases matched. Keep production closed when swapping database files and never pair a restored file with another database’s WAL/SHM files. Run future migration rehearsals on the restored copy. Switching the feature flag off hides the new surfaces without rolling back data.

## Renderer decision

On 19 November 2026 a temporary esbuild bundle compared React Flow 13.0.2 with Cytoscape 3.35.0 in headless Chromium at 1280×800. Each rendered the same 1,000 nodes in a fixed 40-column layout with 3,000 deterministic edges. Ten real pointer selections per renderer measured pointerdown to two animation frames after the selection handler. React Flow median was 27.8 ms, maximum 34.5 ms. Canvas median was 29.1 ms, maximum 29.5 ms. These are warm local selection measurements, not physical iPad timings or a cold-load benchmark.

Use React Flow with visible-element culling, controlled focus and a native outline. React Flow exposed 334 focusable elements with the full fixture, requiring neighborhood filtering. Canvas exposed zero native tab stops. Both need touch verification at beta. Keep deterministic layout and semantic queries separate. Benchmark any global clustering projection again once it includes real labels and grouping.

## Editor and provider decisions

Use plain Markdown as the stored source with a separate sanitized preview. This keeps edits independent of renderer conversions. Step C must test math, broken equations, code, tables, anchor IDs and export/import. Keep server-only Codex and Zod behind a V2 application adapter. Never pass credentials or host tools to model output.

The live probe in evals/v2/provider.mjs returned schema-valid interview, route and proposal-batch responses in 10.9, 13.4 and 9.4 seconds respectively. JSON schemas were 615, 1,337 and 851 bytes. This small sample supports proceeding without splitting those shapes. It does not establish a failure rate or validate grounding. Enforce semantic validation in the application.

## Design tooling

The official site links to pbakaus/impeccable. Installed the upstream repository-scoped skill from commit b49177d32788f2dc585c42831d845dacf1ebed2c, skill 4.10.0, engine 0.1.27, on 19 November 2026. Apache-2.0 license and NOTICE accompany the skill. Launchers can download a release binary and verify its digest against the pinned manifest. Bundled scripts also include browser capture and live design helpers. Use local design checks without enabling external reporting or project hooks. A fresh read-only Codex session identified the repo-scoped skill from its session catalog. Project tokens and V2 section 8 govern conflicts. [Upstream](https://github.com/pbakaus/impeccable/tree/b49177d32788f2dc585c42831d845dacf1ebed2c)

## Step B acceptance

Introduce the V2 shell and local graph behind the flag. Reconcile skills to nodes, valid prerequisites to edges, events to observations and original evidence to durable source links. Quarantine invalid references. Test strict cycles, migration retry, a node with zero observations, keyboard navigation, real quote links and dense fixtures. Keep original URLs available.
