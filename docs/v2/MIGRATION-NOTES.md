# Migration notes

Enable V2 for a **copy** with `MARGINALIA_V2=1 DATABASE_URL=/path/to/copy.db npm run dev:lan`. Visiting a V2 route runs the additive atlas-1 transaction once.md before enabling the flag on a working notebook. Keep the original snapshot until reconciliation and source-link checks pass.

Each legacy skill keeps its original record and maps to one shared node. Legacy events retain dates and quote text. An entry link is emitted only for a verified substring. A missing entry remains attributable to its original skill event. Dangling or cyclic prerequisites go into migration_issue. Inspect those rows before deciding whether to recreate a connection. Recorded graph history begins with import time; earlier evidence dates are preserved separately.

To revert the interface, remove MARGINALIA_V2 and restart. To revert the storage state, restore a separate verified snapshot and start the server against that file. Snapshot restoration reverts edits made since the snapshot.

The migration fixture adds a dangling edge and a self-cycle and verifies both are isolated, every demo skill and event reconciles, repeated initialization is safe, entry bytes match and every imported log quote resolves. Run `node evals/v2/migration.mjs`. For UI checks run `npm run build`, `npm run shots` and `node scripts/atlas-scale-check.mjs`. All create disposable databases. The fixture generator refuses an existing path.
