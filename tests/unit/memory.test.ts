import { describe, expect, it } from 'vitest';
import { addNote, editNote, emptyMemory, MAX_NOTE, MAX_NOTES, memoryKey, removeNote } from '../../src/lib/memory';
import { defaultFor } from '../../src/lib/defaults';

const T = new Date(2026, 10, 21, 9, 0).getTime();

describe('memory notes', () => {
  it('adds notes newest first and trims the text', () => {
    const m = emptyMemory();
    const a = addNote(m, '  Early mornings work best  ', 'me', T)!;
    const b = addNote(m, 'Keep evenings free', 'ai', T + 1)!;
    expect(m.notes.map((n) => n.id)).toEqual([b.id, a.id]);
    expect(a).toMatchObject({ text: 'Early mornings work best', by: 'me', created: T, updated: T });
    expect(a.id === b.id).toBe(false);
  });

  it('refuses empty text and caps length and count', () => {
    const m = emptyMemory();
    expect(addNote(m, '   ', 'me', T)).toBeNull();
    expect(addNote(m, 'x'.repeat(MAX_NOTE + 50), 'me', T)!.text).toHaveLength(MAX_NOTE);
    for (let i = 1; i < MAX_NOTES; i++) addNote(m, `note ${i}`, 'me', T);
    expect(m.notes).toHaveLength(MAX_NOTES);
    expect(addNote(m, 'one too many', 'me', T)).toBeNull();
  });

  it('edits and removes by id, and ignores no-ops', () => {
    const m = emptyMemory();
    const n = addNote(m, 'First', 'me', T)!;
    expect(editNote(m, n.id, 'First', T + 5)).toBe(false);
    expect(editNote(m, n.id, '   ', T + 5)).toBe(false);
    expect(editNote(m, 'missing', 'x', T + 5)).toBe(false);
    expect(editNote(m, n.id, 'Second', T + 5)).toBe(true);
    expect(m.notes[0]).toMatchObject({ text: 'Second', created: T, updated: T + 5 });
    expect(removeNote(m, 'missing')).toBe(false);
    expect(removeNote(m, n.id)).toBe(true);
    expect(m.notes).toEqual([]);
  });

  it('uses document keys the database accepts, with an empty default', () => {
    for (const k of ['ai', 'user'] as const) {
      expect(/^[a-z0-9:-]{1,64}$/.test(memoryKey(k))).toBe(true);
      expect(defaultFor(memoryKey(k))).toEqual({ notes: [] });
    }
  });
});
