// Day: top priorities, brain dump, habits and Claude planning on the left;
// the time-block schedule on the right. Drag down the grid to block hours,
// click a half-hour cell for 30 minutes, drag brain-dump items onto the grid.
import { h, icon, valueOf, checkedOf, focusById } from '../lib/dom';
import { addDays, h12, longDate, today } from '../lib/dates';
import { clamp, cleanPlan, uid, type PlanResult } from '../lib/planner';
import { askClaudeForJson, buildPlanPrompt, ClaudeError, getApiKey } from '../lib/ai';
import { moveInList, setDragHandlers, suppressClick } from '../lib/drag';
import { board, day, saveDay, saveSettings, settings, trackerColor } from '../app/state';
import { card, iconButton, openDialog, pageHead } from '../app/ui';
import { go, rerender } from '../app/shell';
import type { Block, Day } from '../lib/types';

const ROW = 48; // px per hour

export function renderDay(param: string | null): Node[] {
  const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : today();
  const d = day(date);
  const save = (): void => saveDay(date);
  const isToday = date === today();

  const head = pageHead(longDate(date), {
    sub: isToday ? 'Today' : undefined,
    actions: [
      !isToday ? h('wa-button', { size: 's', appearance: 'outlined', onclick: () => go('day', today()) }, 'Today') : null,
      iconButton('chevron_left', 'Previous day', () => go('day', addDays(date, -1))),
      iconButton('chevron_right', 'Next day', () => go('day', addDays(date, 1)))
    ].filter(Boolean) as Node[]
  });

  const grid = buildSchedule(d, date, save);

  setDragHandlers((payload, zone, index, ev) => {
    const [type, id] = payload.split(':');
    if (type !== 'dump') return;
    const item = d.dump.find((x) => x.id === id);
    if (!item) return;
    if (zone === 'schedule') {
      const slot = grid.slotAt(ev);
      if (!slot) return;
      const s = settings();
      const start = (s.dayStart + slot.row) * 60;
      const end = Math.min(start + 60, s.dayEnd * 60);
      d.blocks.push({ id: uid(), start, dur: end - start, text: item.text.slice(0, 60) || 'Untitled', done: false, tracker: null });
      item.blocked = true;
      save(); rerender();
    } else if (zone === 'dump') {
      moveInList(d.dump, item, index);
      save(); rerender();
    }
  }, (zone, ev) => grid.hover(zone === 'schedule' ? ev : null));

  return [head, h('div', { class: 'two-col' },
    h('div', { class: 'stack' }, prioritiesCard(d, save), dumpCard(d, save), habitsCard(d, save), planCard(d, date, save)),
    card('Schedule', [grid.el, scheduleFoot()], { meta: 'Drag down to block hours. Click a half hour for 30 minutes.' }))];
}

/* ---------- left column ---------- */

function prioritiesCard(d: Day, save: () => void): HTMLElement {
  return card('Top priorities', [h('ul', { class: 'list' }, d.priorities.map((p, i) =>
    h('li', { class: `row no-grip${p.done ? ' is-done' : ''}` },
      h('wa-checkbox', { checked: p.done, 'aria-label': `Priority ${i + 1} done`, onchange: (e: Event) => { p.done = checkedOf(e.target); (e.target as HTMLElement).closest('li')!.classList.toggle('is-done', p.done); save(); } }),
      h('input', { class: 'row-text', id: `priority-${i}`, value: p.text, maxlength: 80, 'aria-label': `Priority ${i + 1}`, placeholder: i === 0 ? 'The one thing that matters most today' : 'Add a priority', oninput: (e: Event) => { p.text = valueOf(e.target); save(); } }),
      h('span'))))]);
}

function dumpCard(d: Day, save: () => void): HTMLElement {
  const add = h('wa-input', {
    id: 'dump-add', class: 'add-row', placeholder: 'Add a task, call or thought, then press Enter', maxlength: 120,
    onkeydown: (e: KeyboardEvent) => {
      const v = valueOf(e.target).trim();
      if (e.key === 'Enter' && v) { d.dump.push({ id: uid(), text: v, done: false }); save(); rerender(); focusById('dump-add'); }
    }
  });
  return card('Brain dump', [
    h('ul', { class: 'list', 'data-drop': 'dump', 'data-list': '' },
      d.dump.length ? d.dump.map((it) => h('li', { class: `row${it.done ? ' is-done' : ''}`, 'data-drag': `dump:${it.id}` },
        h('span', { class: 'grip', title: 'Drag onto the schedule' }, icon('drag_indicator')),
        h('wa-checkbox', { checked: it.done, 'aria-label': 'Done', onchange: (e: Event) => { it.done = checkedOf(e.target); (e.target as HTMLElement).closest('li')!.classList.toggle('is-done', it.done); save(); } }),
        h('input', { class: 'row-text', value: it.text, maxlength: 120, 'aria-label': 'Brain dump item', oninput: (e: Event) => { it.text = valueOf(e.target); save(); } }),
        h('span', { style: 'display:flex;align-items:center' },
          it.blocked ? h('span', { class: 'tag-scheduled' }, 'Scheduled') : null,
          h('wa-button', { appearance: 'plain', size: 's', onclick: () => { d.dump = d.dump.filter((x) => x !== it); save(); rerender(); } }, icon('close', 'Remove item')))))
      : h('li', { class: 'empty-note' }, 'Empty. Write down everything on your mind, then drag items onto the schedule.')),
    add
  ], { meta: `${d.dump.filter((x) => !x.done).length} open` });
}

function habitsCard(d: Day, save: () => void): HTMLElement | null {
  const s = settings();
  if (!s.habits.length) return null;
  return card('Habits today', [h('div', { class: 'chips' }, s.habits.map((x) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(Boolean(d.habits[x.id])),
    onclick: (e: MouseEvent) => { d.habits[x.id] = !d.habits[x.id]; (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(d.habits[x.id])); save(); }
  }, x.name)))]);
}

function planCard(d: Day, date: string, save: () => void): HTMLElement {
  const hasKey = Boolean(getApiKey());
  const notes = h('wa-textarea', { id: 'plan-notes', rows: 2, resize: 'auto', maxlength: 500, label: 'Anything Claude should know?', placeholder: 'For example: gym at 6, low energy after lunch, evenings are when I drift' });
  const out = h('div', { 'aria-live': 'polite', style: 'margin-top:12px' });
  const btn = h('wa-button', { variant: 'brand', appearance: 'accent', disabled: !hasKey }, 'Plan my day with Claude');
  btn.addEventListener('click', async () => {
    btn.setAttribute('loading', '');
    out.replaceChildren(h('p', { class: 'muted' }, 'Claude is laying out your day.'));
    try {
      const now = new Date();
      const nowMin = date === today() ? now.getHours() * 60 + now.getMinutes() : null;
      const raw = await askClaudeForJson(buildPlanPrompt(d, date, settings(), board(), valueOf(notes), nowMin));
      showPlan(cleanPlan(raw, d, settings(), nowMin ?? -1), d, save, out);
    } catch (e) {
      out.replaceChildren(h('wa-callout', { variant: 'danger' }, e instanceof ClaudeError ? e.message : 'Claude couldn’t make a plan. Try again.'));
    }
    btn.removeAttribute('loading');
  });
  return card('Plan with Claude', [
    h('p', { class: 'muted', style: 'margin:0 0 12px' }, 'Claude reads your priorities, brain dump, board and trackers, then suggests blocks. You choose which to keep.'),
    hasKey ? null : h('wa-callout', { variant: 'neutral', style: 'margin-bottom:12px' }, 'Add your Anthropic API key in ', h('a', { href: '#settings' }, 'Settings'), ' to use this. The key stays on this device.'),
    notes,
    h('div', { style: 'margin-top:12px' }, btn),
    out
  ]);
}

function showPlan(plan: PlanResult, d: Day, save: () => void, out: HTMLElement): void {
  if (!plan.blocks.length) { out.replaceChildren(h('p', { class: 'muted' }, plan.note || 'No open time left to plan.')); return; }
  const picks = plan.blocks.map((b) => ({ b, on: true }));
  out.replaceChildren(
    plan.note ? h('p', { style: 'margin:0 0 8px' }, plan.note) : '',
    h('ul', { class: 'list plan-list' }, picks.map((p) => h('li', null,
      h('wa-checkbox', { checked: true, 'aria-label': `Keep ${p.b.text}`, onchange: (e: Event) => { p.on = checkedOf(e.target); } }),
      h('span', { class: 'time' }, `${h12(p.b.start)} – ${h12(p.b.start + p.b.dur)}`),
      h('span', null, p.b.text)))),
    h('div', { style: 'display:flex;gap:8px;margin-top:12px' },
      h('wa-button', { variant: 'brand', appearance: 'accent', onclick: () => { d.blocks.push(...picks.filter((p) => p.on).map((p) => p.b)); save(); rerender(); } }, 'Add selected blocks'),
      h('wa-button', { appearance: 'outlined', onclick: () => out.replaceChildren() }, 'Discard')));
}

/* ---------- schedule grid ---------- */

interface Slot { row: number; half: 0 | 1; min: number }

function buildSchedule(d: Day, date: string, save: () => void): { el: HTMLElement; slotAt: (e: PointerEvent | MouseEvent) => Slot | null; hover: (e: PointerEvent | null) => void } {
  const s = settings(), ds = s.dayStart, de = s.dayEnd, rows = de - ds;
  const grid = h('div', { class: 'schedule', 'data-drop': 'schedule', style: `height:${rows * ROW}px` });
  for (let r = 0; r < rows; r++) {
    grid.append(h('div', { class: 'hour', style: `top:${r * ROW}px;height:${ROW}px` },
      h('span', { class: 'label' }, h12((ds + r) * 60)), h('span', { class: 'half' }), h('span', { class: 'half' })));
  }
  const layer = h('div', { class: 'blocks', 'aria-label': 'Schedule' });
  grid.append(layer);
  const preview = h('div', { class: 'block preview', hidden: true });
  layer.append(preview);

  const place = (el: HTMLElement, start: number, dur: number): void => {
    // Rows are hours with a :00 and a :30 column, so a 30-minute block fills one cell
    // and longer blocks span whole rows.
    const half = dur === 30, right = half && start % 60 === 30;
    const top = (Math.floor(start / 60) - ds) * ROW;
    Object.assign(el.style, {
      top: `${top + 2}px`, height: `${(half ? ROW : (dur / 60) * ROW) - 4}px`,
      left: right ? 'calc(50% + 2px)' : '2px', width: half ? 'calc(50% - 4px)' : 'calc(100% - 4px)'
    });
  };
  const slotAt = (e: PointerEvent | MouseEvent): Slot | null => {
    const r = layer.getBoundingClientRect();
    if (e.clientX < r.left - 56 || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    const row = clamp(Math.floor((e.clientY - r.top) / ROW), 0, rows - 1);
    const half = (e.clientX - r.left > r.width / 2 ? 1 : 0) as 0 | 1;
    return { row, half, min: (ds + row) * 60 + half * 30 };
  };
  const hover = (e: PointerEvent | null): void => {
    const sl = e && slotAt(e);
    if (!sl) { preview.hidden = true; return; }
    preview.hidden = false;
    place(preview, (ds + sl.row) * 60, 60);
  };

  const create = (start: number, dur: number): void => {
    const b: Block = { id: uid(), start, dur, text: '', done: false, tracker: null };
    void editBlock(d, b, save, true);
  };

  let lastPointer = 'mouse';
  layer.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType;
    if (e.target !== layer || e.button !== 0 || e.pointerType !== 'mouse') return;
    const a = slotAt(e);
    if (!a) return;
    e.preventDefault();
    layer.setPointerCapture(e.pointerId);
    let b = a;
    const shape = (): { start: number; dur: number } => {
      if (a.row === b.row && a.half === b.half) return { start: a.min, dur: 30 };
      const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row);
      return { start: (ds + r1) * 60, dur: (r2 - r1 + 1) * 60 };
    };
    const move = (ev: PointerEvent): void => { const sl = slotAt(ev); if (!sl) return; b = sl; const sh = shape(); preview.hidden = false; place(preview, sh.start, sh.dur); };
    const done = (commit: boolean) => (): void => {
      layer.removeEventListener('pointermove', move);
      layer.removeEventListener('pointerup', up);
      layer.removeEventListener('pointercancel', cancel);
      preview.hidden = true;
      if (commit) { const sh = shape(); create(sh.start, sh.dur); }
    };
    const up = done(true), cancel = done(false);
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', cancel);
  });
  layer.addEventListener('click', (e) => {
    if (e.target !== layer || lastPointer === 'mouse') return;
    const sl = slotAt(e);
    if (sl) create(sl.min, 30);
  });

  const trackers = new Map(s.trackers.map((t) => [t.id, t]));
  for (const b of [...d.blocks].sort((x, y) => x.start - y.start)) {
    if (b.start < ds * 60 || b.start >= de * 60) continue;
    const tr = b.tracker ? trackers.get(b.tracker) : undefined;
    const el = h('div', {
      class: `block${b.done ? ' is-done' : ''}`, tabindex: 0, role: 'button', 'data-block': b.id,
      'aria-label': `${b.text}, ${h12(b.start)} to ${h12(b.start + b.dur)}${b.done ? ', done' : ''}. Press Enter to edit.`
    },
      h('span', { class: 'move', 'aria-hidden': 'true' }),
      h('span', { class: 'block-text' }, b.text, b.dur >= 60 ? h('span', { class: 'block-meta' }, `${h12(b.start)} – ${h12(b.start + b.dur)}`) : null),
      tr ? h('span', { class: 'tracker-dot', style: `background:${trackerColor(tr)}`, title: `Counts toward ${tr.name}` }) : null,
      h('button', {
        type: 'button', class: 'check', 'aria-pressed': String(b.done), 'aria-label': b.done ? 'Mark not done' : 'Mark done',
        onclick: (e: MouseEvent) => { e.stopPropagation(); b.done = !b.done; save(); rerender(); }
      }),
      h('span', { class: 'resize', 'aria-hidden': 'true', title: 'Drag to change length' }));
    place(el, b.start, b.dur);
    el.addEventListener('click', () => void editBlock(d, b, save, false));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === el) { e.preventDefault(); void editBlock(d, b, save, false); } });
    el.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement;
      if (e.button !== 0 || target.closest('.check')) return;
      const resizing = Boolean(target.closest('.resize'));
      if (!resizing && e.pointerType !== 'mouse' && !target.closest('.move')) return;
      e.preventDefault(); e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      const s0 = slotAt(e), topRow = Math.floor(b.start / 60) - ds, grab = s0 ? s0.row - topRow : 0;
      let moved = false, ns = b.start, nd = b.dur;
      const x0 = e.clientX, y0 = e.clientY;
      const move = (ev: PointerEvent): void => {
        if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
        moved = true;
        el.classList.add('is-moving');
        const lr = layer.getBoundingClientRect();
        const sl = slotAt(ev) ?? { row: clamp(Math.floor((ev.clientY - lr.top) / ROW), 0, rows - 1), half: 0 as const, min: 0 };
        if (resizing) { const end = Math.max(topRow, sl.row); ns = (ds + topRow) * 60; nd = (end - topRow + 1) * 60; }
        else if (b.dur === 30) ns = (ds + sl.row) * 60 + sl.half * 30;
        else { const n = b.dur / 60, r = clamp(sl.row - grab, 0, rows - n); ns = (ds + r) * 60; }
        place(el, ns, nd);
      };
      const up = (): void => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.classList.remove('is-moving');
        if (moved) { suppressClick(); b.start = ns; b.dur = nd; save(); rerender(); }
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    layer.append(el);
  }

  if (date === today()) {
    const n = new Date(), m = n.getHours() * 60 + n.getMinutes();
    if (m >= ds * 60 && m < de * 60) grid.append(h('div', { class: 'now-line', style: `top:${((m - ds * 60) / 60) * ROW}px`, 'aria-hidden': 'true' }));
  }
  return {
    el: h('div', null, h('div', { class: 'grid-head', 'aria-hidden': 'true' }, h('span'), h('span', null, ':00'), h('span', null, ':30')), grid),
    slotAt,
    hover
  };
}

function scheduleFoot(): HTMLElement {
  const s = settings();
  const hourSelect = (id: string, label: string, value: number, from: number, to: number, set: (v: number) => void): HTMLElement =>
    h('wa-select', { id, size: 's', value: String(value), 'aria-label': label, onchange: (e: Event) => { set(Number(valueOf(e.target))); saveSettings(); rerender(); } },
      Array.from({ length: to - from + 1 }, (_, i) => from + i).map((v) => h('wa-option', { value: String(v) }, h12((v * 60) % 1440))));
  return h('div', { class: 'schedule-foot' }, 'Day runs from',
    hourSelect('day-start', 'Day starts at', s.dayStart, 4, 12, (v) => { s.dayStart = v; }), 'to',
    hourSelect('day-end', 'Day ends at', s.dayEnd, 17, 24, (v) => { s.dayEnd = v; }));
}

async function editBlock(d: Day, b: Block, save: () => void, isNew: boolean): Promise<void> {
  const s = settings();
  const text = h('wa-input', { label: 'What goes in this block?', value: b.text, maxlength: 60, autofocus: true });
  const tracker = h('wa-select', { label: 'Counts toward a tracker when done', value: b.tracker ?? 'none' },
    h('wa-option', { value: 'none' }, 'Not tracked'),
    s.trackers.map((t) => h('wa-option', { value: t.id }, t.name)));
  const done = h('wa-checkbox', { checked: b.done }, 'Done');
  const result = await openDialog(isNew ? 'New block' : 'Edit block', [
    h('p', { class: 'muted', style: 'margin-top:0' }, `${h12(b.start)} – ${h12(b.start + b.dur)}`),
    h('div', { style: 'display:grid;gap:16px' }, text, tracker, done)
  ], isNew
    ? [{ id: 'cancel', label: 'Cancel' }, { id: 'save', label: 'Add block', variant: 'brand' }]
    : [{ id: 'delete', label: 'Delete', variant: 'danger' }, { id: 'cancel', label: 'Cancel' }, { id: 'save', label: 'Save', variant: 'brand' }]);
  if (result === 'delete') { d.blocks = d.blocks.filter((x) => x !== b); save(); rerender(); return; }
  if (result !== 'save') return;
  const label = valueOf(text).trim();
  if (!label) { if (!isNew) { d.blocks = d.blocks.filter((x) => x !== b); save(); rerender(); } return; }
  b.text = label;
  const tv = valueOf(tracker);
  b.tracker = tv && tv !== 'none' ? tv : null;
  b.done = checkedOf(done);
  if (isNew) d.blocks.push(b);
  save(); rerender();
}

