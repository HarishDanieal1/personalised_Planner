// Dashboard: every metric is its own card, grouped into Today, Time trackers and Progress.
import { h, icon, checkedOf } from '../lib/dom';
import { addDays, diffDays, fmtMinutes, h12, longDate, mondayOf, shortDate, today, WEEKDAYS_SHORT, fromIso } from '../lib/dates';
import { dayScore, trackerMinutes } from '../lib/planner';
import { barChart } from '../lib/charts';
import { board, day, reset, saveDay, settings, startTimer, stopTimer, trackerColor } from '../app/state';
import { card, pageHead } from '../app/ui';
import { rerender } from '../app/shell';
import type { Day, Settings, Tracker } from '../lib/types';

const link = (href: string, text: string): HTMLElement => h('a', { class: 'card-link', href }, text);

export function renderDashboard(): Node[] {
  const s = settings(), t = today(), d = day(t);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
  const days14 = last14.map((x) => day(x));
  return [
    pageHead('Dashboard', { sub: longDate(t) }),
    h('h2', { class: 'dash-section' }, 'Today'),
    h('div', { class: 'dash-grid' },
      productivityCard(d, s, days14, last14),
      prioritiesCard(d, t),
      scheduleCard(d, t),
      habitsCard(d, t, s, days14)),
    h('h2', { class: 'dash-section' }, 'Time trackers'),
    s.trackers.length
      ? h('div', { class: 'dash-grid' }, s.trackers.map((tr) => trackerCard(tr, d, t, days14.slice(-7), last14.slice(-7))))
      : h('p', { class: 'empty-note' }, 'No trackers yet. ', link('#settings', 'Add one in Settings')),
    h('h2', { class: 'dash-section' }, 'Progress'),
    h('div', { class: 'dash-grid' }, weekCard(t, s), boardCard(), steadyCard(t))
  ];
}

function productivityCard(d: Day, s: Settings, days14: Day[], dates14: string[]): HTMLElement {
  const sc = dayScore(d, s);
  const scores = days14.map((x) => dayScore(x, s).score);
  return card('Productivity', [
    h('div', { class: 'metric' }, sc.score === null ? '–' : String(sc.score), h('small', null, 'out of 100')),
    sc.score === null
      ? h('p', { class: 'metric-note' }, 'Set priorities or block time on the Day page to start a score.')
      : h('p', { class: 'metric-note' }, `${sc.prDone} of ${sc.pr} priorities, ${sc.blDone} of ${sc.bl} blocks, ${sc.hbDone} of ${sc.hb} habits`),
    barChart(scores, {
      label: 'Productivity score, last 14 days',
      labels: dates14.map(shortDate),
      format: (v) => (v === null ? 'no plan' : `${v} out of 100`),
      color: 'var(--series-1)'
    }),
    h('div', { class: 'chart-axis' }, h('span', null, shortDate(dates14[0])), h('span', null, 'Today'))
  ], { class: 'span-2', meta: 'Priorities 40%, blocks 40%, habits 20%' });
}

function prioritiesCard(d: Day, date: string): HTMLElement {
  const items = d.priorities.map((p, i) => ({ p, i })).filter((x) => x.p.text.trim());
  const done = items.filter((x) => x.p.done).length;
  return card('Top priorities', [
    items.length ? h('div', { class: 'metric' }, String(done), h('small', null, `of ${items.length} done`)) : null,
    items.length
      ? h('div', { class: 'list', style: 'margin-top:8px' }, items.map(({ p, i }) =>
          h('wa-checkbox', { checked: p.done, style: 'display:block;padding:4px 0', onchange: (e: Event) => { p.done = checkedOf(e.target); saveDay(date); rerender(); }, 'data-test': `dash-priority-${i}` }, p.text)))
      : h('p', { class: 'empty-note' }, 'No priorities set for today.'),
  ], { actions: [link(`#day/${date}`, items.length ? 'Open day' : 'Set priorities')] });
}

function scheduleCard(d: Day, date: string): HTMLElement {
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const blocks = [...d.blocks].sort((a, b) => a.start - b.start);
  const done = blocks.filter((b) => b.done).length;
  const next = blocks.find((b) => !b.done && b.start + b.dur > nowMin);
  return card('Time blocks', [
    blocks.length ? h('div', { class: 'metric' }, String(done), h('small', null, `of ${blocks.length} done`)) : null,
    blocks.length === 0
      ? h('p', { class: 'empty-note' }, 'Nothing scheduled today.')
      : next
        ? h('p', { class: 'metric-note' }, `${next.start <= nowMin ? 'Now' : 'Next'}: ${h12(next.start)}, ${next.text}`)
        : h('p', { class: 'metric-note' }, 'Everything scheduled for today is done or past.')
  ], { actions: [link(`#day/${date}`, blocks.length ? 'Open schedule' : 'Plan the day')] });
}

function habitsCard(d: Day, date: string, s: Settings, days14: Day[]): HTMLElement {
  const done = s.habits.filter((x) => d.habits[x.id]).length;
  const streak = (id: string): number => {
    let n = 0;
    for (let i = days14.length - 1; i >= 0; i--) {
      if (days14[i].habits[id]) n++;
      else if (i === days14.length - 1) continue;
      else break;
    }
    return n;
  };
  const best = s.habits.map((x) => ({ x, n: streak(x.id) })).sort((a, b) => b.n - a.n)[0];
  return card('Habits', [
    h('div', { class: 'metric' }, String(done), h('small', null, `of ${s.habits.length} today`)),
    s.habits.length
      ? h('div', { class: 'chips', style: 'margin-top:8px' }, s.habits.map((x) => h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(Boolean(d.habits[x.id])),
          onclick: () => { d.habits[x.id] = !d.habits[x.id]; saveDay(date); rerender(); }
        }, x.name)))
      : h('p', { class: 'empty-note' }, 'No habits yet.'),
    best && best.n > 1 ? h('p', { class: 'metric-note', style: 'margin-top:10px' }, `Longest current streak: ${best.x.name}, ${best.n} days`) : null
  ], { actions: [link(`#week/${mondayOf(date)}`, 'Habit tracker')] });
}

function trackerCard(tr: Tracker, d: Day, date: string, days7: Day[], dates7: string[]): HTMLElement {
  const s = settings();
  const value = trackerMinutes(d, tr.id);
  const over = tr.kind === 'limit' && value > tr.goal;
  const running = s.running?.tid === tr.id;
  const adjust = (n: number): void => { d.time[tr.id] = Math.max(0, (d.time[tr.id] || 0) + n); saveDay(date); rerender(); };
  const pct = Math.min(100, (value / Math.max(1, tr.goal)) * 100);
  return card(tr.name, [
    h('div', { class: `metric${over ? ' is-over' : ''}` }, fmtMinutes(value), h('small', null, `of ${fmtMinutes(tr.goal)} ${tr.kind === 'limit' ? 'limit' : 'target'}`)),
    h('div', { class: `meter${over ? ' is-over' : ''}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': tr.goal, 'aria-valuenow': value, 'aria-label': `${tr.name} today` },
      h('span', { style: `width:${pct}%;background:${trackerColor(tr)}` })),
    over ? h('p', { class: 'status-over', style: 'margin:8px 0 0' }, icon('warning'), `${fmtMinutes(value - tr.goal)} over today's limit`) : null,
    barChart(days7.map((x) => trackerMinutes(x, tr.id)), {
      label: `${tr.name} minutes, last 7 days`,
      labels: dates7.map((x) => `${WEEKDAYS_SHORT[(fromIso(x).getDay() + 6) % 7]} ${fromIso(x).getDate()}`),
      format: (v) => fmtMinutes(v ?? 0),
      color: trackerColor(tr),
      goal: tr.goal,
      goalLabel: `Dashed line: daily ${tr.kind === 'limit' ? 'limit' : 'target'}`,
      over: tr.kind === 'limit' ? (v) => v > tr.goal : undefined,
      height: 56
    }),
    h('footer', null,
      h('wa-button', { size: 's', variant: running ? 'danger' : 'neutral', appearance: running ? 'accent' : 'outlined', onclick: () => { if (running) stopTimer(); else startTimer(tr.id); rerender(); } },
        icon(running ? 'stop' : 'play_arrow', undefined, 'start'), running ? 'Stop timer' : 'Start timer'),
      h('wa-button', { size: 's', appearance: 'plain', onclick: () => adjust(15) }, '+15 min'),
      value > 0 ? h('wa-button', { size: 's', appearance: 'plain', onclick: () => adjust(-15) }, '−15 min') : null)
  ], { meta: tr.kind === 'limit' ? 'Daily limit' : 'Daily target', actions: [h('span', { class: 'swatch', style: `background:${trackerColor(tr)}`, 'aria-hidden': 'true' })] });
}

function weekCard(t: string, s: Settings): HTMLElement {
  const mon = mondayOf(t);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const scores = dates.map((x) => (x > t ? null : dayScore(day(x), s).score));
  const planned = scores.filter((x): x is number => x !== null);
  const avg = planned.length ? Math.round(planned.reduce((a, b) => a + b, 0) / planned.length) : null;
  return card('This week', [
    h('div', { class: 'metric' }, avg === null ? '–' : String(avg), h('small', null, 'average score')),
    h('p', { class: 'metric-note' }, `${planned.length} of ${diffDays(mon, t) + 1} days so far had a plan`),
    barChart(scores, {
      label: 'Productivity score this week',
      labels: dates.map((x, i) => `${WEEKDAYS_SHORT[i]} ${fromIso(x).getDate()}`),
      format: (v) => (v === null ? 'no plan' : `${v} out of 100`),
      color: 'var(--series-1)',
      height: 56
    }),
    h('div', { class: 'chart-axis' }, WEEKDAYS_SHORT.map((w) => h('span', null, w)))
  ], { actions: [link(`#week/${mon}`, 'Open week')] });
}

function boardCard(): HTMLElement {
  const cards = board().cards;
  const count = (c: string): number => cards.filter((x) => x.col === c).length;
  const doing = cards.filter((x) => x.col === 'doing');
  return card('Board', [
    h('div', { class: 'metric' }, String(doing.length), h('small', null, 'in progress')),
    h('p', { class: 'metric-note' }, `${count('todo')} to do, ${count('backlog')} in backlog, ${count('done')} done`),
    doing.length ? h('ul', { class: 'list', style: 'margin-top:8px' }, doing.slice(0, 4).map((c) => h('li', { style: 'padding:4px 0;border-bottom:1px solid var(--pl-border)' }, c.title))) : null
  ], { actions: [link('#board', 'Open board')] });
}

function steadyCard(t: string): HTMLElement {
  const r = reset();
  const days = r.streakStart ? Math.max(0, diffDays(r.streakStart, t)) : 0;
  const month = t.slice(0, 7);
  const ridden = r.urges.filter((u) => new Date(u.t).toISOString().slice(0, 7) === month && u.out === 'rode').length;
  return card('Days steady', [
    h('div', { class: 'metric' }, String(days), h('small', null, days === 1 ? 'day' : 'days')),
    h('p', { class: 'metric-note' }, r.streakStart ? `${ridden} urges ridden out this month. Best so far: ${Math.max(r.best, days)} days.` : 'Starts counting the first time you open Reset.')
  ], { actions: [link('#reset', 'Open Reset')] });
}

