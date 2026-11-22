// Dashboard: one page across every area. Each metric is its own card; the detail lives on the
// page each card links to. Reset shows only the days-steady count, never triggers or logs.
import { h } from '../lib/dom';
import { addDays, diffDays, fromIso, h12, longDate, mondayOf, today, WEEKDAYS_SHORT, yearProgress } from '../lib/dates';
import { dayScore, nextBlock } from '../lib/planner';
import { activeSprint, sprintPoints } from '../lib/board';
import { barChart } from '../lib/charts';
import { day, reset, settings } from '../app/state';
import { store, yearKey } from '../lib/store';
import { FEATURES } from '../lib/features';
import { loadBoard } from './board';
import { financeSummary, formatMoney } from './finance';
import { card, pageHead } from '../app/ui';
import type { Board, Year } from '../lib/types';

const link = (href: string, text: string): HTMLElement => h('a', { class: 'card-link', href }, text);

export function renderDashboard(): Node[] {
  const t = today(), bd = loadBoard();
  return [
    pageHead('Dashboard', { sub: longDate(t) }),
    h('h2', { class: 'dash-section' }, 'Today'),
    h('div', { class: 'dash-grid' }, scoreCard(t), nextCard(t), prioritiesCard(t), habitsCard(t)),
    h('h2', { class: 'dash-section' }, 'This week and year'),
    h('div', { class: 'dash-grid' }, weekCard(t), yearCard(t)),
    h('h2', { class: 'dash-section' }, 'Board'),
    h('div', { class: 'dash-grid' }, sprintCard(bd), doingCard(bd), aiCard(bd)),
    ...(FEATURES.financial ? [h('h2', { class: 'dash-section' }, 'Money'), h('div', { class: 'dash-grid' }, netWorthCard(), budgetCard())] : []),
    h('h2', { class: 'dash-section' }, 'Reset'),
    h('div', { class: 'dash-grid' }, steadyCard(t))
  ];
}

function scoreCard(t: string): HTMLElement {
  const sc = dayScore(day(t), settings());
  return card('Productivity today', [
    h('div', { class: 'metric' }, sc.score === null ? '–' : String(sc.score), h('small', null, 'out of 100')),
    h('p', { class: 'metric-note' }, sc.score === null ? 'Set priorities or block time to start a score.' : `${sc.prDone} of ${sc.pr} priorities, ${sc.blDone} of ${sc.bl} blocks, ${sc.hbDone} of ${sc.hb} habits`)
  ], { actions: [link('#progress', 'Open progress')] });
}

function nextCard(t: string): HTMLElement {
  const now = new Date(), blocks = day(t).blocks;
  const n = nextBlock(blocks, now.getHours() * 60 + now.getMinutes());
  return card('Time blocks', [
    n ? h('div', { class: 'metric' }, h12(n.block.start), h('small', null, n.now ? 'now' : 'next')) : null,
    h('p', { class: n || blocks.length ? 'metric-note' : 'empty-note' },
      n ? n.block.text : blocks.length ? 'Everything scheduled for today is done or past.' : 'Nothing scheduled today.')
  ], { actions: [link('#day', blocks.length ? 'Open day' : 'Plan the day')] });
}

function prioritiesCard(t: string): HTMLElement {
  const items = day(t).priorities.filter((p) => p.text.trim());
  const done = items.filter((p) => p.done).length;
  return card('Top priorities', [
    items.length ? h('div', { class: 'metric' }, String(done), h('small', null, `of ${items.length} done`)) : h('p', { class: 'empty-note' }, 'No priorities set for today.')
  ], { actions: [link('#day', items.length ? 'Open day' : 'Set priorities')] });
}

function habitsCard(t: string): HTMLElement {
  const s = settings(), d = day(t);
  const done = s.habits.filter((x) => d.habits[x.id]).length;
  return card('Habits', [
    s.habits.length ? h('div', { class: 'metric' }, String(done), h('small', null, `of ${s.habits.length} today`)) : h('p', { class: 'empty-note' }, 'No habits yet.')
  ], { actions: [link('#progress', 'Open progress')] });
}

function weekCard(t: string): HTMLElement {
  const mon = mondayOf(t), s = settings();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const scores = dates.map((x) => (x > t ? null : dayScore(day(x), s).score));
  const planned = scores.filter((x): x is number => x !== null);
  const avg = planned.length ? Math.round(planned.reduce((a, b) => a + b, 0) / planned.length) : null;
  return card('This week', [
    h('div', { class: 'metric' }, avg === null ? '–' : `${avg}%`, h('small', null, 'average score')),
    h('p', { class: 'metric-note' }, `${planned.length} of ${diffDays(mon, t) + 1} days so far had a plan`),
    barChart(scores, {
      label: 'Productivity score this week',
      labels: dates.map((x, i) => `${WEEKDAYS_SHORT[i]} ${fromIso(x).getDate()}`),
      format: (v) => (v === null ? 'No plan' : `${v}%`),
      color: 'var(--series-1)',
      height: 56
    }),
    h('div', { class: 'chart-axis' }, WEEKDAYS_SHORT.map((w) => h('span', null, w)))
  ], { class: 'span-2', actions: [link(`#week/${mon}`, 'Open week')] });
}

function yearCard(t: string): HTMLElement {
  const y = t.slice(0, 4), pct = yearProgress(t);
  const goals = store.keys().includes(yearKey(y)) ? store.get<Year>(yearKey(y)).goals.filter((g) => g.text.trim()) : [];
  const done = goals.filter((g) => g.done).length;
  return card(`Year ${y}`, [
    h('div', { class: 'metric' }, `${pct}%`, h('small', null, 'of the year passed')),
    h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': 'Year passed' },
      h('span', { style: `width:${pct}%;background:var(--series-1)` })),
    h('p', { class: goals.length ? 'metric-note' : 'empty-note', style: 'margin-top:8px' }, goals.length ? `${done} of ${goals.length} year goals done` : 'No goals set yet')
  ], { actions: [link('#year', goals.length ? 'Open year' : 'Set goals')] });
}

function sprintCard(bd: Board): HTMLElement {
  const sprints = bd.projects.map((p) => ({ p, sp: activeSprint(bd, p.key) })).filter((x) => x.sp);
  return card('Active sprint', sprints.length
    ? sprints.map(({ p, sp }) => {
        const pts = sprintPoints(bd, sp!.id, p.key);
        const pct = pts.total ? Math.round((pts.done / pts.total) * 100) : 0;
        return h('div', { style: 'margin-bottom:10px' },
          h('div', { class: 'metric' }, `${pct}%`, h('small', null, `${pts.done} of ${pts.total} points, ${p.name}`)),
          h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': `${p.name} sprint` },
            h('span', { style: `width:${pct}%;background:var(--series-1)` })));
      })
    : [h('p', { class: 'empty-note' }, 'No sprint running.')], { actions: [link('#board', 'Open board')] });
}

function doingCard(bd: Board): HTMLElement {
  const n = bd.issues.filter((i) => i.type !== 'epic' && i.status === 'doing').length;
  return card('In progress', [h('div', { class: 'metric' }, String(n), h('small', null, n === 1 ? 'issue' : 'issues'))], { actions: [link('#board', 'Open board')] });
}

function aiCard(bd: Board): HTMLElement {
  const n = bd.issues.filter((i) => i.type !== 'epic' && i.assignee === 'ai' && i.status !== 'done').length;
  return card('Assigned to the AI', [h('div', { class: 'metric' }, String(n), h('small', null, 'open'))], { actions: [link('#board', 'Open board')] });
}

function netWorthCard(): HTMLElement {
  const f = financeSummary();
  return card('Net worth', [
    h('div', { class: 'metric' }, formatMoney(f.netWorth)),
    h('p', { class: 'metric-note' }, `Sample data. ${formatMoney(f.netWorthChange)} this month.`)
  ], { actions: [link('#fin-overview', 'Open financial')] });
}

function budgetCard(): HTMLElement {
  const f = financeSummary();
  return card('Spent this month', [
    h('div', { class: 'metric' }, formatMoney(f.spent), h('small', null, `of ${formatMoney(f.budget)} budgeted`)),
    h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': f.budget, 'aria-valuenow': f.spent, 'aria-label': 'Spent against budget' },
      h('span', { style: `width:${Math.min(100, (f.spent / f.budget) * 100)}%;background:var(--series-1)` })),
    h('p', { class: 'metric-note', style: 'margin-top:8px' }, 'Sample data')
  ], { actions: [link('#fin-overview', 'Open financial')] });
}

function steadyCard(t: string): HTMLElement {
  const r = reset();
  const days = r.streakStart ? Math.max(0, diffDays(r.streakStart, t)) : 0;
  return card('Days steady', [
    h('div', { class: 'metric' }, String(days), h('small', null, days === 1 ? 'day' : 'days')),
    r.streakStart ? null : h('p', { class: 'metric-note' }, 'Starts counting the first time you open Reset.')
  ], { actions: [link('#reset', 'Open Reset')] });
}
