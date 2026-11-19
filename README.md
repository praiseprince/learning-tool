# Marginalia

Marginalia is a personal learning journal. Journeys and entries live in SQLite on the computer running the app, in `data/app.db` by default.

## Run on Wi-Fi

After installing dependencies with `npm ci`, run `npm run dev:lan` from the repository. Keep the terminal open. On an iPad connected to the same Wi-Fi, open the Network address printed by Next.js and visit `/new` to create a journey. The root route opens your most recently viewed active journey or onboarding.

For production, run `npm run build` once after source changes and use `npm run start:lan` to launch the built app.

## Optional remote access

With Marginalia listening on port 3000 and cloudflared installed, run `npm run tunnel` in another terminal. The printed public URL gives anyone who has it access to the app. Stop that process to close the tunnel.

## Development

Run `npm run lint` and `npm run build` to check the application. Run `npm run shots` for mobile and desktop captures against a disposable demo database.

## Learning entries and stats

Open a journey and choose **Log a session** under **This week**. Practice entries contribute to session count, distinct practice days and recorded minutes. Rest days appear in the weekly activity view. Minutes accepted during review count toward totals. Undo restores the previous values.

Session extraction defaults to the installed Codex CLI. Run `codex login status` under the account starting Marginalia to check authentication. Codex processes the entry and the journey’s skill list using that account. Set `AI_PROVIDER=stub` to run extraction locally without model calls. Journey drafts, session plans and weekly reviews use the same provider.

Run `npm run evals` to exercise 12 synthetic entries with the live Codex CLI. This uses the authenticated account’s model allowance.

## Installed app and exports

On a secure origin, the production build registers a service worker and can be added to a home screen. Plain HTTP on a Wi-Fi address supports the journal. Service workers and screen wake lock require HTTPS or localhost. The optional HTTPS tunnel also works for these browser features.

Open **You** to set the theme and week start, edit profile facts, or download JSON and Markdown. **Goal** keeps an immutable version history, including restored versions.

Plans and extractions use a bounded history of recent entries, relevant older entries, and summaries of completed periods. **Skills → View prerequisites** shows which skills come first. Under **You**, a daily reminder can be enabled for the current browser while Marginalia is open. Run `node evals/context.mjs` to check long-history limits and separation between journeys.
