// Memory notes: short text notes kept in two documents, one the AI keeps about how to work with
// the person (memory-ai) and one about the person (memory-user). Pure rules, no UI.
import type { Memory, MemoryNote } from './types';

export type MemoryKind = 'ai' | 'user';
export const MAX_NOTE = 1000;
export const MAX_NOTES = 200;
export const memoryKey = (kind: MemoryKind): string => `memory-${kind}`;
export const emptyMemory = (): Memory => ({ notes: [] });

let counter = 0;
const noteId = (now: number): string => `n${now.toString(36)}${(counter++).toString(36)}`;

/** Add a note at the top. Returns null for empty text or when the list is full. */
export function addNote(mem: Memory, text: string, by: MemoryNote['by'], now: number): MemoryNote | null {
  const clean = text.trim().slice(0, MAX_NOTE);
  if (!clean || mem.notes.length >= MAX_NOTES) return null;
  const note: MemoryNote = { id: noteId(now), text: clean, by, created: now, updated: now };
  mem.notes.unshift(note);
  return note;
}

/** Change a note's text. Returns false when the note is missing, the text is empty or nothing changed. */
export function editNote(mem: Memory, id: string, text: string, now: number): boolean {
  const note = mem.notes.find((n) => n.id === id);
  const clean = text.trim().slice(0, MAX_NOTE);
  if (!note || !clean || clean === note.text) return false;
  note.text = clean;
  note.updated = now;
  return true;
}

export function removeNote(mem: Memory, id: string): boolean {
  const i = mem.notes.findIndex((n) => n.id === id);
  if (i < 0) return false;
  mem.notes.splice(i, 1);
  return true;
}
