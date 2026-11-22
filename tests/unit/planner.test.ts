import { describe, expect, it } from 'vitest';
import { cleanPlan, dayScore, nextBlock, overlaps, snapBlock, trackerMinutes } from '../../src/lib/planner';
import { defaultDay, defaultSettings } from '../../src/lib/defaults';

describe('snapBlock', () => {
  it('keeps 30-minute blocks on the half hour', () => {
    expect(snapBlock(9 * 60 + 40, 30)).toEqual({ start: 9 * 60 + 30, dur: 30 });
  });
  it('rounds longer blocks to whole hours starting on the hour', () => {
    expect(snapBlock(9 * 60 + 30, 90)).toEqual({ start: 9 * 60, dur: 120 });
    expect(snapBlock(14 * 60, 45)).toEqual({ start: 14 * 60, dur: 60 });
  });
});

describe('overlaps', () => {
  it('detects overlap and allows touching blocks', () => {
    expect(overlaps({ start: 60, dur: 60 }, { start: 90, dur: 30 })).toBe(true);
    expect(overlaps({ start: 60, dur: 60 }, { start: 120, dur: 30 })).toBe(false);
  });
});

describe('trackerMinutes', () => {
  it('adds timer minutes and finished linked blocks only', () => {
    const d = defaultDay();
    d.time.focus = 25;
    d.blocks.push({ id: 'a', start: 540, dur: 60, text: 'Deep work', done: true, tracker: 'focus' });
    d.blocks.push({ id: 'b', start: 600, dur: 60, text: 'Not done yet', done: false, tracker: 'focus' });
    d.blocks.push({ id: 'c', start: 660, dur: 30, text: 'Other tracker', done: true, tracker: 'gaming' });
    expect(trackerMinutes(d, 'focus')).toBe(85);
  });
});

describe('dayScore', () => {
  it('is null when nothing is planned and no habit is ticked', () => {
    expect(dayScore(defaultDay(), defaultSettings()).score).toBeNull();
  });
  it('weights priorities 40, blocks 40 and habits 20', () => {
    const s = defaultSettings();
    const d = defaultDay();
    d.priorities = [{ text: 'A', done: true }, { text: 'B', done: false }, { text: '', done: false }];
    d.blocks = [{ id: 'x', start: 540, dur: 60, text: 'X', done: true, tracker: null }];
    d.habits = { h1: true, h2: true };
    // priorities 1/2 -> 20, blocks 1/1 -> 40, habits 2/4 -> 10; total 70 of 100
    expect(dayScore(d, s).score).toBe(70);
  });
  it('rescales when a part has nothing planned', () => {
    const s = defaultSettings();
    const d = defaultDay();
    d.priorities[0] = { text: 'Only one', done: true };
    // priorities 40/40, habits 0/20 -> 40 of 60
    expect(dayScore(d, s).score).toBe(67);
  });
});

describe('cleanPlan', () => {
  const s = defaultSettings();
  it('accepts valid blocks, snaps them and drops bad or overlapping ones', () => {
    const d = defaultDay();
    d.blocks.push({ id: 'e', start: 600, dur: 60, text: 'Existing', done: false, tracker: null });
    const res = cleanPlan({
      blocks: [
        { start: '09:00', minutes: 60, text: 'Write report', tracker: 'focus' },
        { start: '10:30', minutes: 30, text: 'Overlaps existing', tracker: null },
        { start: '05:00', minutes: 60, text: 'Before the day starts', tracker: null },
        { start: 'later', minutes: 60, text: 'Bad time', tracker: null },
        { start: '13:15', minutes: 50, text: '  Lunch   walk ', tracker: 'not-a-tracker' },
        { start: '22:30', minutes: 120, text: 'Runs past day end', tracker: null }
      ],
      note: 'Hardest first.'
    }, d, s);
    expect(res.blocks.map((b) => [b.start, b.dur, b.text, b.tracker])).toEqual([
      [540, 60, 'Write report', 'focus'],
      [780, 60, 'Lunch walk', null]
    ]);
    expect(res.note).toBe('Hardest first.');
  });
  it('respects the not-before time and survives junk input', () => {
    const d = defaultDay();
    expect(cleanPlan({ blocks: [{ start: '08:00', minutes: 60, text: 'Too early' }] }, d, s, 9 * 60).blocks).toEqual([]);
    expect(cleanPlan('nonsense', d, s).blocks).toEqual([]);
    expect(cleanPlan(null, d, s).note).toBe('');
  });
});

describe('nextBlock', () => {
  const b = (id: string, start: number, dur: number, done = false) => ({ id, start, dur, text: id, done, tracker: null });
  it('returns the block in progress, then the next one', () => {
    const blocks = [b('b', 600, 60), b('a', 540, 60)];
    expect(nextBlock(blocks, 560)?.block.id).toBe('a');
    expect(nextBlock(blocks, 560)?.now).toBe(true);
    expect(nextBlock(blocks, 500)?.now).toBe(false);
  });
  it('skips done and past blocks, and returns null when nothing is left', () => {
    expect(nextBlock([b('a', 540, 60, true), b('b', 600, 60)], 545)?.block.id).toBe('b');
    expect(nextBlock([b('a', 540, 60)], 700)).toBeNull();
  });
});
