import { describe, expect, it } from 'vitest';
import { addDays, diffDays, fmtMinutes, h12, mondayOf, yearProgress } from '../../src/lib/dates';

describe('dates', () => {
  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-11-21')).toBe('2026-11-16'); // Saturday
    expect(mondayOf('2026-11-16')).toBe('2026-11-16'); // Monday
    expect(mondayOf('2026-11-22')).toBe('2026-11-16'); // Sunday
  });
  it('adds and diffs days across months', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(diffDays('2026-11-01', '2026-12-01')).toBe(30);
  });
  it('formats times and durations', () => {
    expect(h12(0)).toBe('12am');
    expect(h12(13 * 60 + 30)).toBe('1:30pm');
    expect(fmtMinutes(45)).toBe('45m');
    expect(fmtMinutes(135)).toBe('2h 15m');
    expect(fmtMinutes(120)).toBe('2h');
  });
  it('reports how much of the year has passed', () => {
    expect(yearProgress('2026-01-01')).toBe(0);
    expect(yearProgress('2026-12-31')).toBe(100);
    expect(yearProgress('2026-07-02')).toBe(50);
    expect(yearProgress('2028-12-31')).toBe(100); // leap year
  });
});
