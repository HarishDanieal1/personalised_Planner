// Year: a theme and goals for the year, and every month at a glance. Each day is
// shaded by its productivity score, and every day links to its Day page.
import { h, valueOf, checkedOf } from '../lib/dom';
import { iso, MONTHS_LONG, MONTHS_SHORT, today, WEEKDAYS_SHORT } from '../lib/dates';
import { dayKey, store, yearKey } from '../lib/store';
import { dayScore, scoreLevel } from '../lib/planner';
import { settings } from '../app/state';
import { card, iconButton, pageHead } from '../app/ui';
import { go } from '../app/shell';
import type { Day, Month, Year } from '../lib/types';

const LEVEL_TEXT = ['No plan', 'Under 25%', '25 to 49%', '50 to 74%', '75% or more'];

export function renderYear(param: string | null): Node[] {
  const y = param && /^\d{4}$/.test(param) ? Number(param) : new Date().getFullYear();
  const key = yearKey(String(y));
  const yr = store.get<Year>(key);
  const save = (): void => store.save(key);
  const t = today();
  const saved = new Set(store.keys());
  const s = settings();

  const monthCard = (m: number): HTMLElement => {
    const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
    const mo = saved.has(`month:${ym}`) ? store.get<Month>(`month:${ym}`) : null;
    const goals = mo?.goals.filter((g) => g.text.trim()) ?? [];
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysIn = new Date(y, m + 1, 0).getDate();
    const cells: HTMLElement[] = [];
    for (let i = 0; i < offset; i++) cells.push(h('span', { class: 'yday is-blank', 'aria-hidden': 'true' }));
    for (let n = 1; n <= daysIn; n++) {
      const date = iso(new Date(y, m, n));
      const sc = saved.has(dayKey(date)) ? dayScore(store.get<Day>(dayKey(date)), s).score : null;
      const level = scoreLevel(sc);
      cells.push(h('a', {
        class: `yday level-${level}${date === t ? ' is-today' : ''}`,
        href: `#day/${date}`,
        title: `${MONTHS_SHORT[m]} ${n}: ${sc === null ? 'nothing planned' : `${sc}% done`}`,
        'aria-label': `${MONTHS_LONG[m]} ${n}, ${sc === null ? 'nothing planned' : `${sc} percent done`}`
      }));
    }
    return h('section', { class: 'card ymonth', 'aria-label': MONTHS_LONG[m] },
      h('div', { class: 'card-head' },
        h('h2', null, h('a', { href: `#month/${ym}`, class: 'ymonth-link' }, MONTHS_LONG[m])),
        goals.length ? h('span', { class: 'meta' }, `${goals.filter((g) => g.done).length} of ${goals.length} goals`) : null),
      mo?.theme ? h('p', { class: 'ymonth-theme' }, mo.theme) : null,
      h('div', { class: 'ygrid' }, WEEKDAYS_SHORT.map((w) => h('span', { class: 'ydow', 'aria-hidden': 'true' }, w[0])), cells));
  };

  return [
    pageHead(String(y), {
      actions: [
        y !== new Date().getFullYear() ? h('wa-button', { size: 's', appearance: 'outlined', onclick: () => go('year', String(new Date().getFullYear())) }, 'This year') : null,
        iconButton('chevron_left', 'Previous year', () => go('year', String(y - 1))),
        iconButton('chevron_right', 'Next year', () => go('year', String(y + 1)))
      ].filter(Boolean) as Node[]
    }),
    h('div', { class: 'dash-grid', style: 'margin-bottom:16px' },
      card('This year will be', [
        h('wa-input', { id: 'year-theme', value: yr.theme, maxlength: 80, placeholder: 'A word or phrase for the year', 'aria-label': 'Theme for the year', oninput: (e: Event) => { yr.theme = valueOf(e.target); save(); } })
      ]),
      card('Goals of the year', [h('ul', { class: 'list' }, yr.goals.map((g, i) => h('li', { class: `row no-grip${g.done ? ' is-done' : ''}` },
        h('wa-checkbox', { checked: g.done, 'aria-label': `Year goal ${i + 1} done`, onchange: (e: Event) => { g.done = checkedOf(e.target); (e.target as HTMLElement).closest('li')!.classList.toggle('is-done', g.done); save(); } }),
        h('input', { class: 'row-text', id: `year-goal-${i}`, value: g.text, maxlength: 100, placeholder: `Goal ${i + 1}`, 'aria-label': `Year goal ${i + 1}`, oninput: (e: Event) => { g.text = valueOf(e.target); save(); } }),
        h('span'))))], { class: 'span-2' })),
    h('div', { class: 'year-legend', 'aria-hidden': 'true' }, h('span', null, 'Day score'),
      LEVEL_TEXT.map((text, i) => h('span', { class: 'legend-item' }, h('span', { class: `yday level-${i}` }), text))),
    h('div', { class: 'year-grid' }, Array.from({ length: 12 }, (_, m) => monthCard(m)))
  ];
}
