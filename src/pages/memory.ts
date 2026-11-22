// Memory pages: notes the AI keeps about working with the person, and notes about the person.
// Text is stored on this device and synced like every other document; it is not sent to Claude.
import { h, icon, valueOf } from '../lib/dom';
import { store } from '../lib/store';
import { addNote, editNote, emptyMemory, MAX_NOTE, memoryKey, removeNote, type MemoryKind } from '../lib/memory';
import { announce, card, openDialog, pageHead } from '../app/ui';
import { rerender } from '../app/shell';
import { longDate, iso } from '../lib/dates';
import type { Memory, MemoryNote } from '../lib/types';

const COPY: Record<MemoryKind, { title: string; sub: string; placeholder: string; empty: string }> = {
  ai: {
    title: 'AI memory',
    sub: 'Notes about how the AI should work with you. Only you can edit them for now.',
    placeholder: 'For example: plan deep work before noon and keep afternoons light.',
    empty: 'No notes yet. Add what the AI should keep in mind when it plans with you.'
  },
  user: {
    title: 'User memory',
    sub: 'Facts and preferences about you that help planning.',
    placeholder: 'For example: I do my best work early, and I want evenings free.',
    empty: 'No notes yet. Add something about you that a good assistant would know.'
  }
};

export function renderMemory(kind: MemoryKind): Node[] {
  const key = memoryKey(kind), c = COPY[kind];
  const mem = store.get<Memory>(key);
  if (!Array.isArray(mem.notes)) Object.assign(mem, emptyMemory());
  const save = (): void => store.save(key);

  const input = h('wa-textarea', { id: `memory-new-${kind}`, rows: 3, maxlength: MAX_NOTE, placeholder: c.placeholder, 'aria-label': 'New note', resize: 'auto' });
  const add = (): void => {
    if (!addNote(mem, valueOf(input), 'me', Date.now())) { announce('Write a note first.'); return; }
    save(); announce('Note added'); rerender();
  };

  return [
    pageHead(c.title, { sub: c.sub }),
    h('wa-callout', { variant: 'neutral', style: 'margin-bottom:16px' },
      'Kept on this device and synced to your own Supabase rows when you are signed in. Notes are never sent to Claude.'),
    h('div', { class: 'two-col' },
      card('Add a note', [input, h('div', { style: 'margin-top:12px' }, h('wa-button', { variant: 'brand', appearance: 'accent', onclick: add }, 'Add note'))]),
      card('Notes', mem.notes.length
        ? [h('ul', { class: 'list memory-list' }, mem.notes.map((n) => noteRow(kind, mem, n, save)))]
        : [h('p', { class: 'empty-note' }, c.empty)], { meta: `${mem.notes.length}` }))
  ];
}

function noteRow(kind: MemoryKind, mem: Memory, n: MemoryNote, save: () => void): HTMLElement {
  const when = longDate(iso(new Date(n.updated)));
  return h('li', { class: 'memory-note' },
    h('div', { class: 'memory-text' }, n.text),
    h('div', { class: 'memory-foot' },
      h('span', { class: 'muted' }, `${n.by === 'ai' ? 'AI' : 'You'}, ${when}`),
      h('span', { class: 'memory-actions' },
        h('wa-button', { appearance: 'plain', size: 's', 'aria-label': 'Edit note', onclick: () => void edit(kind, mem, n, save) }, icon('edit', 'Edit')),
        h('wa-button', { appearance: 'plain', size: 's', 'aria-label': 'Delete note', onclick: () => void remove(mem, n, save) }, icon('delete', 'Delete')))));
}

async function edit(kind: MemoryKind, mem: Memory, n: MemoryNote, save: () => void): Promise<void> {
  const field = h('wa-textarea', { rows: 5, maxlength: MAX_NOTE, value: n.text, label: 'Note', resize: 'auto' });
  const r = await openDialog(`Edit ${COPY[kind].title.toLowerCase()} note`, [field], [{ id: 'cancel', label: 'Cancel' }, { id: 'save', label: 'Save note', variant: 'brand' }]);
  if (r !== 'save') return;
  if (editNote(mem, n.id, valueOf(field), Date.now())) { save(); announce('Note saved'); rerender(); }
}

async function remove(mem: Memory, n: MemoryNote, save: () => void): Promise<void> {
  const r = await openDialog('Delete this note?', [h('p', null, 'The note will be removed from this device and from your synced copy. This can’t be undone.')],
    [{ id: 'cancel', label: 'Keep it' }, { id: 'delete', label: 'Delete note', variant: 'danger' }]);
  if (r !== 'delete') return;
  removeNote(mem, n.id); save(); announce('Note deleted'); rerender();
}
