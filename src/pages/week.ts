// Week: notes, an urgent/important matrix and the habit tracker.
import { h, icon, valueOf, checkedOf, focusById } from '../lib/dom';
import { addDays, fromIso, mondayOf, MONTHS_SHORT, today, WEEKDAYS_SHORT } from '../lib/dates';
import { store, weekKey } from '../lib/store';
import { uid } from '../lib/planner';
import { setDragHandlers } from '../lib/drag';
import { day, saveDay, saveSettings, sendToToday, settings } from '../app/state';
import { announce, card, iconButton, pageHead } from '../app/ui';
import { go, rerender } from '../app/shell';
import type { MatrixItem, Quadrant, Week } from '../lib/types';

const QUADS: { q: Quadrant; title: string; hint: string }[] = [
  { q: 'q1', title: 'Do first', hint: 'Urgent and important' },
  { q: 'q3', title: 'Delegate or batch', hint: 'Urgent, not important' },
  { q: 'q2', title: 'Schedule', hint: 'Important, not urgent' },
  { q: 'q4', title: 'Drop or later', hint: 'Neither' }
];

export function renderWeek(param: string | null): Node[] {
  const mon = mondayOf(param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : today());
  const key = weekKey(mon);
  const w = store.get<Week>(key);
  const save = (): void => store.save(key);
  const sun = addDays(mon, 6);
  const a = fromIso(mon), z = fromIso(sun);
  const title = `Week of ${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${a.getMonth() !== z.getMonth() ? MONTHS_SHORT[z.getMonth()] + ' ' : ''}${z.getDate()}`;

  setDragHandlers((payload, zone, index) => {
    const [type, from, id] = payload.split(':');
    if (type !== 'quad' || !zone.startsWith('quad:')) return;
    const to = zone.slice(5) as Quadrant;
    const item = w.matrix[from as Quadrant]?.find((x) => x.id === id);
    if (!item) return;
    w.matrix[from as Quadrant] = w.matrix[from as Quadrant].filter((x) => x !== item);
    w.matrix[to].splice(Math.min(index, w.matrix[to].length), 0, item);
    save(); rerender();
  });

  return [
    pageHead(title, {
      actions: [
        mondayOf(today()) !== mon ? h('wa-button', { size: 's', appearance: 'outlined', onclick: () => go('week', mondayOf(today())) }, 'This week') : null,
        iconButton('chevron_left', 'Previous week', () => go('week', addDays(mon, -7))),
        iconButton('chevron_right', 'Next week', () => go('week', addDays(mon, 7)))
      ].filter(Boolean) as Node[]
    }),
    h('div', { class: 'two-col' },
      h('div', { class: 'stack' },
        card('Weekly notes', [
          h('wa-textarea', { class: 'notes-area', id: 'week-notes', value: w.notes, maxlength: 6000, resize: 'vertical', placeholder: 'Meetings, deadlines, ideas. Come back to this through the week.', 'aria-label': 'Weekly notes', oninput: (e: Event) => { w.notes = valueOf(e.target); save(); } })
        ]),
        card('Self-care', [
          h('wa-input', { id: 'self-care', value: w.selfCare, maxlength: 120, placeholder: 'One thing you’ll do for yourself this week', 'aria-label': 'Self-care', oninput: (e: Event) => { w.selfCare = valueOf(e.target); save(); } })
        ])),
      h('div', { class: 'stack' },
        card('Priority matrix', [matrix(w, save)], { meta: 'Drag items between boxes' }),
        card('Habit tracker', [habitTable(mon)]))
    )
  ];
}

function matrix(w: Week, save: () => void): HTMLElement {
  const item = (q: Quadrant, it: MatrixItem): HTMLElement => h('li', { class: `row${it.done ? ' is-done' : ''}`, 'data-drag': `quad:${q}:${it.id}` },
    h('span', { class: 'grip' }, icon('drag_indicator')),
    h('wa-checkbox', { checked: it.done, 'aria-label': 'Done', onchange: (e: Event) => { it.done = checkedOf(e.target); (e.target as HTMLElement).closest('li')!.classList.toggle('is-done', it.done); save(); } }),
    h('input', { class: 'row-text', value: it.text, maxlength: 100, 'aria-label': 'Item', oninput: (e: Event) => { it.text = valueOf(e.target); save(); } }),
    h('span', { style: 'display:flex' },
      h('wa-button', { appearance: 'plain', size: 's', onclick: () => { sendToToday(it.text); announce(`Added “${it.text}” to today’s brain dump.`); } }, icon('today', 'Add to today’s brain dump')),
      h('wa-button', { appearance: 'plain', size: 's', onclick: () => { w.matrix[q] = w.matrix[q].filter((x) => x !== it); save(); rerender(); } }, icon('close', 'Remove'))));
  return h('div', { class: 'matrix' },
    h('span', { class: 'axis', style: 'grid-column:2;grid-row:1' }, 'Important'),
    h('span', { class: 'axis', style: 'grid-column:3;grid-row:1' }, 'Not important'),
    h('span', { class: 'axis side', style: 'grid-column:1;grid-row:2' }, 'Urgent'),
    h('span', { class: 'axis side', style: 'grid-column:1;grid-row:3' }, 'Not urgent'),
    QUADS.map(({ q, title, hint }, i) => h('div', { class: `quad ${q}`, style: `grid-column:${2 + (i % 2)};grid-row:${2 + Math.floor(i / 2)}` },
      h('h3', null, title), h('div', { class: 'hint' }, hint),
      h('ul', { class: 'list', 'data-drop': `quad:${q}`, 'data-list': '' }, w.matrix[q].map((it) => item(q, it))),
      h('wa-input', { id: `quad-add-${q}`, size: 's', placeholder: 'Add and press Enter', maxlength: 100, 'aria-label': `Add to ${title}`,
        onkeydown: (e: KeyboardEvent) => {
          const v = valueOf(e.target).trim();
          if (e.key === 'Enter' && v) { w.matrix[q].push({ id: uid(), text: v, done: false }); save(); rerender(); focusById(`quad-add-${q}`); }
        } }))));
}

function habitTable(mon: string): HTMLElement {
  const s = settings();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const days = dates.map((x) => day(x));
  const t = today();
  return h('div', null,
    s.habits.length ? h('table', { class: 'habit-table' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Habit'),
        dates.map((x, i) => h('th', { scope: 'col', class: x === t ? 'is-today' : '' }, WEEKDAYS_SHORT[i])), h('th', null, h('span', { class: 'visually-hidden' }, 'Remove')))),
      h('tbody', null, s.habits.map((hb) => h('tr', null,
        h('th', { scope: 'row', style: 'font-weight:400' }, hb.name),
        days.map((d, i) => h('td', null, h('button', {
          type: 'button', class: 'dot', 'aria-pressed': String(Boolean(d.habits[hb.id])), 'aria-label': `${hb.name}, ${WEEKDAYS_SHORT[i]}`,
          onclick: (e: MouseEvent) => { d.habits[hb.id] = !d.habits[hb.id]; (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(d.habits[hb.id])); saveDay(dates[i]); }
        }))),
        h('td', null, h('wa-button', { appearance: 'plain', size: 's', onclick: () => { s.habits = s.habits.filter((x) => x !== hb); saveSettings(); rerender(); } }, icon('close', `Remove ${hb.name}`))))))) : h('p', { class: 'empty-note' }, 'No habits yet.'),
    h('wa-input', { id: 'habit-add', size: 's', style: 'margin-top:12px', placeholder: 'Add a habit and press Enter', maxlength: 40, 'aria-label': 'Add a habit',
      onkeydown: (e: KeyboardEvent) => {
        const v = valueOf(e.target).trim();
        if (e.key === 'Enter' && v) { s.habits.push({ id: uid(), name: v }); saveSettings(); rerender(); focusById('habit-add'); }
      } }));
}

