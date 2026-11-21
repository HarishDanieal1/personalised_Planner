# Planner: notes for AI agents and contributors

Planner is an open-source personal planner: time blocks, a weekly matrix, monthly goals, a board, habit and time trackers, a Reset page, optional Supabase sync and optional Claude day planning. Read README.md for what each page does.

## Commands

```bash
npm run setup     # packages + Playwright's Chromium, both inside node_modules
npm run dev       # http://localhost:5173
npm run build     # tsc --noEmit && vite build
npm test          # Vitest unit tests (tests/unit)
npm run e2e       # Playwright, desktop and phone sizes (tests/e2e)
npm run check     # build, unit, e2e in a row; logs in logs/
```

A change is done when `npm run check` passes. Add or update tests for any logic you touch: pure rules go in `src/lib/` with Vitest tests; user flows get a Playwright test.

## Ground rules

- **Everything stays inside the project.** No global installs. Playwright's browser lives in `node_modules` (`PLAYWRIGHT_BROWSERS_PATH=0`, set by `scripts/local-browsers.mjs`). New tools go in `devDependencies`.
- **No secrets in git.** `.env` is ignored; `.env.example` documents the variables. The browser only ever gets the Supabase publishable key. Never add a Supabase secret or `service_role` key, or anyone's Anthropic API key, to code, tests, logs or workflow files.
- **Never delete or silently overwrite a person's planner data.** Sync is newest-change-wins per document; keep it that way unless the change is designed and tested. Destructive actions in the UI need an explicit choice from the person.
- **User text is text.** Build DOM with `h()` from `src/lib/dom.ts`; never put user or AI content into `innerHTML`.
- **Claude's output is untrusted.** Validate it like `cleanPlan()` does before using it.
- The Reset page is private and supportive. Keep its copy non-judgemental, and never add features that expose its data.

## Structure

- `src/app/`: shell (top bar, left navigation, router, search), shared state, theme, UI helpers
- `src/pages/`: one file per page. A new section (for example anime and film history, or an AI agent) is a new page file plus one entry in `PAGES` in `src/app/shell.ts`. Its data is a new document key in the store; no schema change is needed.
- `src/lib/`: logic without UI: `dates`, `planner` (rules), `store` (local-first documents), `sync` (Supabase), `ai` (Claude), `charts`, `drag`
- `src/styles/tokens.css`: design tokens; `src/styles/app.css`: layout and components
- `supabase/migrations/`: schema; `tests/unit/`, `tests/e2e/`; `legacy/v0.0.1.html`: the first version

## Naming

- Source files: lowercase, one word where possible, kebab-case otherwise (`app-shell.ts`, not `AppShell.ts`). Tests: `<name>.test.ts` (unit), `<name>.spec.ts` (Playwright).
- Supabase migrations follow the CLI convention `YYYYMMDDHHmmss_verb_description.sql` in UTC, for example `20261121190806_create_planner_docs_table.sql`. Use the real creation time; never rename a migration once it has been applied.
- Store keys: `settings`, `board`, `reset`, `day:YYYY-MM-DD`, `week:YYYY-MM-DD` (the Monday), `month:YYYY-MM`. Keys must match `^[a-z0-9:-]{1,64}$` (enforced by the database).
- Branches: `v0.0.x` for releases, `feature/<short-name>` or `fix/<short-name>` for work.

## Design

- Google Cloud console look: white top bar, rectangular left navigation, grey canvas, white cards with 1px borders, one blue accent. Use the tokens in `tokens.css`; don't hard-code colours. Every new colour needs a dark-mode value.
- UI components come from Web Awesome's **free** components (`@awesome.me/webawesome`). Import each one in `src/app/components.ts`. Use the short size values (`s`, `m`, `l`).
- Icons are Material Symbols SVGs copied into `public/icons/material/` (offline). Copy only the icons you use; remove ones you stop using.
- Dashboard metrics each get their own card. Charts: one series per chart, colours from the `--series-N` palette (validated for colour-blindness), a tooltip per mark, a hidden data table, labels in text colours rather than series colours. Status (over a limit) uses the critical colour with an icon and words, never colour alone.
- Write copy from the person's side of the screen: sentence case, plain verbs, buttons that say what happens ("Add block", not "Submit"). No filler, no emoji, no "A · B" meta strings, no decorative eyebrows or numbering.
- Check desktop (1440px), phone (390px), keyboard focus and `prefers-reduced-motion`.

## Pull requests

Describe what changed and how you tested it, including anything you couldn't test. Keep `main` deployable.
