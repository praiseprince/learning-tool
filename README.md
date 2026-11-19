# Marginalia

Marginalia is a personal learning journal. Journeys and entries live in SQLite on the computer running the app, in `data/app.db` by default.

## Run on Wi-Fi

After installing dependencies with `npm ci`, run `npm run dev:lan` from the repository. Keep the terminal open. On an iPad connected to the same Wi-Fi, open the Network address printed by Next.js and visit `/new` to create a journey. The root route currently opens the style guide.

For production, run `npm run build` once after source changes and use `npm run start:lan` to launch the built app.

## Optional remote access

With Marginalia listening on port 3000 and cloudflared installed, run `npm run tunnel` in another terminal. The printed public URL gives anyone who has it access to the app. Stop that process to close the tunnel.

## Development

Run `npm run lint` and `npm run build` to check the application. Journey drafting currently uses a local stub.
