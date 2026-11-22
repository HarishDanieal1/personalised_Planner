# Planner

An open-source personal planner: time-block your day, sort the week by urgency and importance, set monthly and yearly goals, run Personal and Work projects on a Jira-style board shared with the AI, and track habits and time (focus, gaming, cooking, exercise or your own). A dashboard shows every area as its own cards. Optional Claude day planning and Supabase sync.

It runs in the browser and installs as an app on Windows, macOS, Linux, Android and iOS (it's a progressive web app). It works offline; with an account it syncs across devices.

## Pages

Day, Week, Month, Year and Reset sit in the **Planner** group of the left navigation; the Financial and Memory pages have their own groups. Groups collapse and expand.

| Page | What it's for |
| --- | --- |
| Dashboard | One view across every area: today, this week and year, the board, money (sample data) and days steady. |
| Progress | Today's productivity score, priorities, time blocks, habits, one card per time tracker, this week, the board and days steady. Sits first in the Planner group. |
| Day | Top 3 priorities, a brain dump, and a schedule from early morning to night. Drag down the grid to block hours, click a half hour for 30 minutes, drag brain-dump items onto the grid. |
| Week | Weekly notes, an urgent/important matrix with drag and drop, the habit tracker and a self-care line. |
| Month | A theme for the month, three goals and a calendar with a note per day. |
| Year | A theme and goals for the year, and all twelve months with each day shaded by its score. Click a day to open it. |
| Reset | A days-steady count, a 10-minute urge reset with things to do instead, and a private log of when and why urges show up, including slips. |
| Board | Jira-style, with Personal and Work as separate projects. Issues have a key (WORK-12), type, priority, story points, an assignee (you or the AI), labels, an epic, comments and a full change history. Plan sprints in the backlog, then work the sprint board. Day plans the AI makes are logged here too. |
| Memory | Two note lists: AI memory (how the AI should work with you) and User memory (facts and preferences about you). Kept on your device and synced like everything else; never sent to Claude. |
| Financial | Overview, spending, transactions, budget, recurring, categories, reports, investments, holdings, market watch, forecast and cash, with sample data for now. |
| Settings | Account and sync, Claude, theme, trackers, habits and a data download. |

## Run it

You need [Node.js](https://nodejs.org) 20 or newer and Git.

```bash
git clone https://github.com/HarishDanieal1/personalised_Planner.git
cd personalised_Planner
npm run setup     # installs packages and the test browser, all inside this folder
npm run dev       # http://localhost:5173
```

Everything is installed inside the project: packages in `node_modules`, and Playwright's test browser in `node_modules` too (the scripts set `PLAYWRIGHT_BROWSERS_PATH=0`). Nothing is installed globally.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server on port 5173 |
| `npm run build` | Type-checks and builds to `dist/` |
| `npm run preview` | Serves the build on port 4173 |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | Browser tests (Playwright), desktop and phone sizes; screenshots go to `test-results/screenshots/` |
| `npm run check` | Build, unit and browser tests in a row, with logs in `logs/` |

## Cloud sync with Supabase (optional)

Without this, Planner saves everything in the browser on that device.

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/migrations/20261121190806_create_planner_docs_table.sql`. It creates one table, `planner_docs`, with row-level security so each signed-in person can only read and change their own rows.
3. Under **Authentication → URL Configuration**, set the Site URL to where the app runs (for local use, `http://localhost:5173`).
4. Copy `.env.example` to `.env` and fill in your Project URL and **publishable** key from **Project Settings → API Keys**.
5. Restart `npm run dev`, open **Settings** and create an account.

`.env` is in `.gitignore`. The publishable key is safe in the browser because of row-level security. Never put a secret key (`sb_secret_…`) or the `service_role` key in the app or the repo.

Migration file names follow the Supabase CLI convention, `YYYYMMDDHHmmss_short_description.sql`: the timestamp orders the migrations and must not be changed once applied.

## Claude day planning (optional)

On the Day page, "Plan my day with Claude" reads your priorities, brain dump, board and trackers and suggests time blocks; you choose which to keep. Each person uses their own Anthropic API key, entered in Settings. The key is kept in that browser only: it is not synced and not committed. Requests go directly from the browser to Anthropic. Get a key at [console.anthropic.com](https://console.anthropic.com).

## Install as an app

Open Planner in Edge or Chrome and choose **Install** in the address bar (or the browser menu). On Android, use **Add to Home screen**. It opens in its own window and works offline.

## AI agents on GitHub

The repo has two Claude workflows (`.github/workflows/claude.yml` and `claude-review.yml`), built on [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action):

- **@claude:** mention `@claude` in an issue, a pull request comment or a review, and Claude answers, investigates or makes the change on a branch.
- **Pull request review:** Claude reviews every pull request when it's opened or updated and leaves comments. It doesn't push changes.

Both follow the rules in [CLAUDE.md](CLAUDE.md). Only people with write access to the repo can trigger them, and runs from forked pull requests are off.

To turn them on in your copy:

1. Install the Claude GitHub App on the repository: https://github.com/apps/claude
2. Add one repository secret under **Settings → Secrets and variables → Actions → New repository secret**:
   - `CLAUDE_CODE_OAUTH_TOKEN` to run on your Claude subscription (Pro, Max, Team or Enterprise). Get it by running `claude setup-token` in Claude Code on your computer. Best for a personal repo.
   - or `ANTHROPIC_API_KEY`, a key from [console.anthropic.com](https://console.anthropic.com), billed as API usage.

Until one of these secrets exists, both workflows skip with a notice. See "Models and cost" in [CLAUDE.md](CLAUDE.md) for which model each kind of work uses.

## Project layout

```
src/
  main.ts            entry: styles, components, start
  app/               shell (top bar, navigation, router, search), shared state, theme, UI helpers
  pages/             one file per page: dashboard, progress, day, week, month, year, reset, board, finance, settings
  lib/               logic without UI: dates, planner rules, board rules, local store, Supabase sync, Claude, charts, drag and drop
  styles/            design tokens and app styles
public/icons/        app icons and the Material Symbols used by the UI
supabase/migrations/ database schema
tests/unit/          Vitest
tests/e2e/           Playwright
CLAUDE.md            rules for AI agents and contributors
legacy/v0.0.1.html   the first single-file version
```

A new section, such as an anime and film history or an AI agent, is a new file in `src/pages/` plus one line in the navigation list (`NAV`) in `src/app/shell.ts`. Its data is another document in the same store, so it syncs with no schema change.

## Built with

[Web Awesome](https://webawesome.com) components (MIT, free components only), [Material Symbols](https://fonts.google.com/icons) icons (Apache 2.0), your system font, [Supabase](https://supabase.com), [Vite](https://vite.dev), [vite-plugin-pwa](https://vite-pwa-org.netlify.app), Vitest and Playwright.

## Feedback

Issues and pull requests are welcome.

## License

MIT, see [LICENSE](LICENSE).
