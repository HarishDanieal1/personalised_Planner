# Timebox

A timebox planner in a single HTML file, laid out like a paper notebook: dump it, prioritize it, block it.

## Pages

- **Day**: top 3 priorities, a brain dump, and a 6am to 11pm time grid. Drag down the grid to block hours, click a cell for 30 minutes, or drag brain-dump items onto the grid. Blocks can be moved, resized, ticked off and linked to a tracker.
- **Week**: weekly notes, an urgent/important matrix with drag-and-drop items, a habit tracker and a self-care line.
- **Month**: month picker, monthly theme, three goals and a calendar with a note per day.
- **Board**: Backlog, To do, In progress (capped at 3) and Done, with drag-and-drop cards. "Add to today" sends a card to the day's brain dump.
- **Dashboard**: daily productivity score, 14-day charts, habit streaks, and trackers with timers (focus, gaming with a daily limit, cooking, exercise, plus your own).
- **Reset**: a day counter, a 10-minute urge reset with breathing and swap actions, and a private log of triggers and hours.

## Running it

Open `index.html` in a browser. No build step and no dependencies apart from Google Fonts.

When opened as a Claude artifact, the page saves to a private per-user store and can ask Claude to plan your day. Opened anywhere else (locally or on GitHub Pages), it saves to your browser's local storage and the Claude planning button is turned off.

## Security notes

- All user text is rendered with `textContent`; no user data is written as HTML.
- Claude's suggested blocks are validated (time format, length, planner hours, overlaps, known tracker ids) before they are shown.
- No external requests beyond Google Fonts; no secrets in the code.
