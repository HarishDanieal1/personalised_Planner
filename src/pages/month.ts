// Month: a theme, three goals and a calendar with a note per day.
import { h, valueOf, checkedOf } from '../lib/dom';
import { iso, MONTHS_LONG, today, WEEKDAYS_SHORT, pad } from '../lib/dates';
import { monthKey, store, dayKey } from '../lib/store';
import { card, iconButton, pageHead } from '../app/ui';
import { go } from '../app/shell';
import type { Day, Month } from '../lib/types';

export function renderMonth(param: string | null): Node[] {
  const now = new Date();
  const [y, m] = param && /^\d{4}-\d{2}$/.test(param) ? param.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const ym = `${y}-${pad(m)}`;
  const key = monthKey(ym);
  const mo = store.get<Month>(key);
  const save = (): void => store.save(key);
  const shift = (n: number): string => { const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const t = today();

  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysIn = new Date(y, m, 0).getDate();
  const weeks = Math.ceil((offset + daysIn) / 7);
  const cells: HTMLElement[] = [];
  for (let c = 0; c < weeks * 7; c++) {
    const n = c - offset + 1;
    if (n < 1 || n > daysIn) { cells.push(h('div', { class: 'mcell is-outside', 'aria-hidden': 'true' })); continue; }
    const date = iso(new Date(y, m - 1, n));
    const saved = store.keys().includes(dayKey(date)) ? store.get<Day>(dayKey(date)) : null;
    const blockCount = saved?.blocks.length ?? 0;
    cells.push(h('div', { class: `mcell${date === t ? ' is-today' : ''}` },
      h('button', { type: 'button', class: 'date', 'aria-label': `Open ${MONTHS_LONG[m - 1]} ${n}`, onclick: () => go('day', date) }, String(n)),
      h('textarea', { 'aria-label': `Note for ${MONTHS_LONG[m - 1]} ${n}`, maxlength: 140, '.value': mo.cells[String(n)] ?? '', oninput: (e: Event) => { mo.cells[String(n)] = valueOf(e.target); save(); } }),
      blockCount ? h('span', { class: 'count' }, `${blockCount} ${blockCount === 1 ? 'block' : 'blocks'}`) : null));
  }

  return [
    pageHead(`${MONTHS_LONG[m - 1]} ${y}`, {
      actions: [
        t.slice(0, 7) !== ym ? h('wa-button', { size: 's', appearance: 'outlined', onclick: () => go('month', t.slice(0, 7)) }, 'This month') : null,
        iconButton('chevron_left', 'Previous month', () => go('month', shift(-1))),
        iconButton('chevron_right', 'Next month', () => go('month', shift(1)))
      ].filter(Boolean) as Node[]
    }),
    h('div', { class: 'dash-grid', style: 'margin-bottom:16px' },
      card('This month will be', [
        h('wa-input', { id: 'month-theme', value: mo.theme, maxlength: 80, placeholder: 'A word or phrase for the month', 'aria-label': 'Theme for the month', oninput: (e: Event) => { mo.theme = valueOf(e.target); save(); } })
      ]),
      card('Goals of the month', [h('ul', { class: 'list' }, mo.goals.map((g, i) => h('li', { class: `row no-grip${g.done ? ' is-done' : ''}` },
        h('wa-checkbox', { checked: g.done, 'aria-label': `Goal ${i + 1} done`, onchange: (e: Event) => { g.done = checkedOf(e.target); (e.target as HTMLElement).closest('li')!.classList.toggle('is-done', g.done); save(); } }),
        h('input', { class: 'row-text', id: `goal-${i}`, value: g.text, maxlength: 80, placeholder: `Goal ${i + 1}`, 'aria-label': `Goal ${i + 1}`, oninput: (e: Event) => { g.text = valueOf(e.target); save(); } }),
        h('span'))))], { class: 'span-2' })),
    card('Calendar', [h('div', { class: 'month-grid' },
      WEEKDAYS_SHORT.map((w) => h('div', { class: 'dow' }, w)),
      cells)], { meta: 'Click a date to open that day' })
  ];
}
