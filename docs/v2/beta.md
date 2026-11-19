# Local beta verification

The release target is one learner on a trusted network. Run `npm run local` after `npm ci`. The top-level dashboard collects weekly practice and journeys. The Guide starts a new goal. Existing journeys open their local Atlas, with the original journal and practice screens available under **Practice tools and journal**.

## Acceptance checks

| Scenario | Reproducible check |
| --- | --- |
| Interview, stop, resume and edit a charter | `node evals/v2/guide-browser.mjs` opens a new philosophy goal and reloads the interview before answering the baseline question. |
| Goal-specific route and change of direction | The Guide browser test requests economics after approving philosophy and opens both route revisions. `node evals/v2/guide.mjs` checks dependency validation and stale proposal rejection. |
| Inspect an included concept | The Guide browser test filters the Atlas to the approved route and opens Hegelian dialectics. |
| Research directions and a time limit | The Guide browser test asks for a search direction, relevance and a 20-minute activity. The stub supplies search terms. Live outputs depend on the installed Codex account. |
| Markdown, math, exact source and export | `node evals/v2/notebook-browser.mjs` exercises the editor, malformed math, export and independent review. `node evals/v2/notebook.mjs` checks stable links after a rename and conflicts between revisions. |
| Cross-journey connections | `node scripts/shots-v2.mjs` uses piano, physics and running. It accepts the proposed harmonics connection and checks running separately. |
| Dated graph history | `node evals/v2/bridges.mjs` checks an earlier date, accepted and dismissed states, aliases, merge and undo. |
| Provider unavailable | The notebook browser test substitutes a failing Codex executable and reads the saved revision back. Manual route drafts work with the provider unavailable. |
| Upgrade, restore and erase | `node evals/v2/release.mjs` upgrades a disposable V1 database, verifies original IDs and text, compares restored V2 table contents, and tests deletion on that fixture. |
| Responsive layouts and large graphs | Build, run `node scripts/shots-v2.mjs`, then `node scripts/atlas-scale-check.mjs`. Screenshots cover both themes. The largest graph has 1,000 nodes and 3,000 relations. |

The tablet check uses Chromium touch emulation at 768 × 1024. A separate startup test fetched the Guide via the laptop’s Wi-Fi address. A physical iPad and a remotely deployed identity policy were outside this verification.

## Data and provider behavior

A note save and its extraction have separate lifetimes. The editor retains unsaved text in browser storage, and revisions use optimistic concurrency. A three-minute lease allows retry after a worker stops mid-extraction. The Guide retains learner turns during a provider failure. An accepted charter and route are written together in a SQLite transaction. A new pending route leaves the previously approved route active.

Use the SQLite backup and restore commands in the README for an exact working copy, including original IDs and search indexes. The JSON and Markdown downloads are human-readable exports. Schema migrations apply on first use of a V2 workspace. Running the application with the V2 flag off still allows access to the original screens.
