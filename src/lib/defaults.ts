import type { Board, Day, Month, Reset, Settings, Week } from './types';

export const defaultSettings = (): Settings => ({
  dayStart: 6,
  dayEnd: 23,
  running: null,
  habits: [
    { id: 'h1', name: 'Read 20 minutes' },
    { id: 'h2', name: 'Move my body' },
    { id: 'h3', name: 'Phone out of bed by 11' },
    { id: 'h4', name: 'Drink water' }
  ],
  trackers: [
    { id: 'focus', name: 'Focus', kind: 'target', goal: 240, slot: 1 },
    { id: 'gaming', name: 'Gaming', kind: 'limit', goal: 90, slot: 2 },
    { id: 'cooking', name: 'Cooking', kind: 'target', goal: 45, slot: 3 },
    { id: 'exercise', name: 'Exercise', kind: 'target', goal: 30, slot: 4 }
  ]
});
export const defaultDay = (): Day => ({
  priorities: [{ text: '', done: false }, { text: '', done: false }, { text: '', done: false }],
  dump: [],
  blocks: [],
  time: {},
  habits: {}
});
export const defaultWeek = (): Week => ({ notes: '', matrix: { q1: [], q2: [], q3: [], q4: [] }, selfCare: '' });
export const defaultMonth = (): Month => ({
  theme: '',
  goals: [{ text: '', done: false }, { text: '', done: false }, { text: '', done: false }],
  cells: {}
});
export const defaultBoard = (): Board => ({ cards: [] });
export const defaultReset = (): Reset => ({ streakStart: null, best: 0, slips: [], urges: [] });

/** The next free palette slot for a new tracker, so existing trackers keep their colours. */
export function nextTrackerSlot(used: number[]): number {
  for (let i = 1; i <= 8; i++) if (!used.includes(i)) return i;
  return ((used.length) % 8) + 1;
}

/** Document keys: settings, board, reset, day:YYYY-MM-DD, week:YYYY-MM-DD (Monday), month:YYYY-MM. */
export function defaultFor(key: string): object {
  if (key.startsWith('day:')) return defaultDay();
  if (key.startsWith('week:')) return defaultWeek();
  if (key.startsWith('month:')) return defaultMonth();
  if (key === 'settings') return defaultSettings();
  if (key === 'board') return defaultBoard();
  if (key === 'reset') return defaultReset();
  return {};
}
