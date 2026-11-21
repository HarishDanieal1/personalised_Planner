// Board: Backlog, To do, In progress (limit 3) and Done, with drag and drop.
import { h, icon, valueOf, focusById } from '../lib/dom';
import { fmtMinutes } from '../lib/dates';
import { uid, clamp } from '../lib/planner';
import { setDragHandlers } from '../lib/drag';
import { board, sendToToday } from '../app/state';
import { announce, openDialog, pageHead } from '../app/ui';
import { rerender } from '../app/shell';
import { store } from '../lib/store';
import type { Card, Column } from '../lib/types';

const COLUMNS: { id: Column; title: string; empty: string }[] = [
  { id: 'backlog', title: 'Backlog', empty: 'Ideas and someday tasks.' },
  { id: 'todo', title: 'To do', empty: 'What you mean to do this week.' },
  { id: 'doing', title: 'In progress', empty: 'Drag one card here and finish it.' },
  { id: 'done', title: 'Done', empty: 'Finished cards land here.' }
];
const TAGS = ['Work', 'Personal', 'Learning', 'Health', 'Home'];
const LIMIT = 3;
const save = (): void => store.save('board');

export function renderBoard(): Node[] {
  const bd = board();
  setDragHandlers((payload, zone, index) => {
    const [type, id] = payload.split(':');
    if (type !== 'card' || !zone.startsWith('col:')) return;
    const c = bd.cards.find((x) => x.id === id);
    if (!c) return;
    const col = zone.slice(4) as Column;
    bd.cards.splice(bd.cards.indexOf(c), 1);
    c.col = col;
    const inCol = bd.cards.filter((x) => x.col === col);
    if (index >= inCol.length) bd.cards.push(c); else bd.cards.splice(bd.cards.indexOf(inCol[index]), 0, c);
    save(); rerender();
  });

  const cardEl = (c: Card): HTMLElement => h('li', {
    class: `tcard${c.col === 'done' ? ' is-done' : ''}`, 'data-drag': `card:${c.id}`, tabindex: 0,
    'aria-label': `${c.title}. Press Enter to edit.`,
    onclick: () => void editCard(c),
    onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) void editCard(c); }
  },
    h('span', { class: 'grip' }, icon('drag_indicator')),
    h('div', { class: 'title' }, c.title),
    h('div', { class: 'meta' },
      c.tag ? h('wa-tag', { size: 's', appearance: 'outlined' }, c.tag) : null,
      c.est ? h('span', null, fmtMinutes(c.est)) : null,
      c.col !== 'done' ? h('wa-button', { class: 'to-today', size: 's', appearance: 'plain', onclick: (e: MouseEvent) => { e.stopPropagation(); sendToToday(c.title); announce(`Added “${c.title}” to today’s brain dump.`); } }, 'Add to today') : null));

  return [
    pageHead('Board', { sub: 'Drag cards between columns. Keep three or fewer in progress.' }),
    h('div', { class: 'board' }, COLUMNS.map((col) => {
      const cards = bd.cards.filter((x) => x.col === col.id);
      const over = col.id === 'doing' && cards.length > LIMIT;
      return h('section', { class: `column${over ? ' is-over' : ''}`, 'aria-label': col.title },
        h('div', { class: 'column-head' }, h('h2', null, col.title), h('span', { class: 'count' }, col.id === 'doing' ? `${cards.length} of ${LIMIT}` : String(cards.length))),
        over ? h('p', { class: 'column-warning' }, icon('warning'), 'Over the limit. Finish one before starting another.') : null,
        col.id !== 'done' ? h('wa-input', { id: `add-${col.id}`, size: 's', placeholder: 'Add a card and press Enter', maxlength: 100, 'aria-label': `Add a card to ${col.title}`, style: 'margin-bottom:8px',
          onkeydown: (e: KeyboardEvent) => {
            const v = valueOf(e.target).trim();
            if (e.key === 'Enter' && v) { bd.cards.push({ id: uid(), title: v, col: col.id, tag: '', est: 0, notes: '' }); save(); rerender(); focusById(`add-${col.id}`); }
          } }) : null,
        h('ul', { class: 'cards list', 'data-drop': `col:${col.id}`, 'data-list': '' },
          cards.length ? cards.map(cardEl) : h('li', { class: 'empty-note' }, col.empty)));
    }))
  ];
}

async function editCard(c: Card): Promise<void> {
  const bd = board();
  const title = h('wa-input', { label: 'Title', value: c.title, maxlength: 100 });
  const col = h('wa-select', { label: 'Column', value: c.col }, COLUMNS.map((x) => h('wa-option', { value: x.id }, x.title)));
  const tag = h('wa-select', { label: 'Tag', value: c.tag || 'none' }, h('wa-option', { value: 'none' }, 'No tag'), TAGS.map((t) => h('wa-option', { value: t }, t)));
  const est = h('wa-input', { label: 'Estimate in minutes', type: 'number', min: 0, max: 1440, step: 15, value: c.est ? String(c.est) : '' });
  const notes = h('wa-textarea', { label: 'Notes', rows: 3, maxlength: 1000, value: c.notes });
  const result = await openDialog('Edit card', [h('div', { style: 'display:grid;gap:16px' }, title, col, tag, est, notes)],
    [{ id: 'delete', label: 'Delete', variant: 'danger' }, { id: 'cancel', label: 'Cancel' }, { id: 'save', label: 'Save', variant: 'brand' }]);
  if (result === 'delete') { bd.cards = bd.cards.filter((x) => x !== c); save(); rerender(); return; }
  if (result !== 'save') return;
  if (valueOf(title).trim()) c.title = valueOf(title).trim();
  const newCol = valueOf(col) as Column;
  if (newCol !== c.col) { bd.cards.splice(bd.cards.indexOf(c), 1); bd.cards.push(c); c.col = newCol; }
  const tv = valueOf(tag);
  c.tag = tv === 'none' ? '' : tv;
  c.est = clamp(Math.round(Number(valueOf(est)) || 0), 0, 1440);
  c.notes = valueOf(notes);
  save(); rerender();
}
