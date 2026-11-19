# Marginalia design: chat-first

## Why
The earlier versions spread the product over five pages and six tabs per goal, with forms for everything. Using it meant navigating, not learning. The app is now one conversation, with context beside it.

## Structure
- **Home (`/`) is the chat** for the current goal: the thread (user messages, Guide replies, and cards for plans, minutes, logged sessions, suggestions, notes, live agent progress) above one message box with quick-action chips. A persistent **goal panel** on the right shows where you are, this week, the roadmap, materials (edit "where you are" inline), skills and recent evidence. On narrow screens the panel slides over.
- **Top bar:** wordmark, goal switcher, Map, Notes, search (⌘K), Settings. Nothing else.
- **Secondary screens** (Map, Notes, goal details, Settings) keep the same look; they are reached rarely.
- Events live in `chat_event`; the agent runner is `lib/agent/`; thread rendering is `components/chat/`.

## Principles
1. One input box for everything. A message is classified (plan / log / ask); chips cover the common actions; attachments mean "review my work".
2. One tap where possible: minutes are chips, each plan step is one tap, saving a session is one tap, accepting a suggestion is one tap.
3. Nothing the AI proposes changes your data until you accept it, and it is shown inline where it was proposed.
4. Always show what is happening (live agent steps, "planning, about 20 seconds"), never a blank wait.
5. Fast: use the production server (`npm run local:prod`); confirming a log is instant (no hidden AI call).

## Look: paper
Warm paper, near-black ink, one coral signal. Modelled on the restraint of Claude, Linear and Things, not on a generic app kit.
- **Neutrals:** warm off-white page (`--paper`), slightly lighter cards (`--sheet`), a sunk tone for quiet fills, hairline 1px rules. Dark mode is warm charcoal, never blue-grey. No tinted blue anywhere.
- **Actions:** primary buttons are near-black (`--ink`) with paper-coloured text; secondary are 1px outlined. Radius 8px on controls, 12px on cards. No pills, no glows, no floating shadows (only menus get one soft shadow).
- **One signal colour:** coral (`--marker`) marks "Now" and "here", focus rings and selection. Nothing else is coloured. Goal hues are only small identity dots and the Map's clusters.
- **Voice:** the Guide's replies and page titles are serif (Newsreader); controls, labels and numbers are sans (Instrument Sans).
- **Rules for changes:** add no new accent colours, no pill shapes, no gradients, no card shadows. Separate with space first, a hairline second.

Check at 390 / 1440, light and dark, with `scripts/seed-worstcase.mjs` data (long names, emoji, many goals).

## System rules (keep these when adding UI)
- **Type scale, nothing else:** 12 meta · 14 interface (buttons, menus, labels, tabs) · 16 reading · 18 lead · 22 section · 32 page title. Use the `--t-*` tokens.
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32 / 48. Items inside a group are tight; groups are separated by a hairline plus 24px, page sections by 32px.
- **Controls:** every button, input, dropdown and the search field is 36px high (44px on touch), 8px radius, 1px border.
- **Menus:** one look for every popup (`.menu`, the goal switcher, search): sheet background, 1px rule, 10px radius, one soft shadow, 32px rows, selected row marked with a tick. Use `components/ui/select.tsx` instead of `<select>`.
- **Settings:** a list of rows, label left and control right, preferences save as you change them. Reset lives under Your data and always makes a backup first.

