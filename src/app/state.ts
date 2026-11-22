// Shared planner state helpers used by several pages.
import { store, dayKey } from '../lib/store';
import { today } from '../lib/dates';
import type { Board, Day, Reset, Settings, Tracker } from '../lib/types';
import { uid } from '../lib/planner';

export const settings = (): Settings => store.get<Settings>('settings');
export const saveSettings = (): void => store.save('settings');
export const day = (date: string): Day => store.get<Day>(dayKey(date));
export const saveDay = (date: string): void => store.save(dayKey(date));
export const board = (): Board => store.get<Board>('board');
export const reset = (): Reset => store.get<Reset>('reset');

export const trackerColor = (t: Pick<Tracker, 'slot'>): string => `var(--series-${((t.slot - 1) % 8) + 1})`;

/** Put text into today's brain dump. */
export function sendToToday(text: string): void {
  const d = day(today());
  d.dump.push({ id: uid(), text: text.slice(0, 120), done: false });
  saveDay(today());
}

/* ---------- running timer ---------- */
export function startTimer(trackerId: string): void {
  const s = settings();
  if (s.running) stopTimer();
  s.running = { tid: trackerId, start: Date.now(), date: today() };
  saveSettings();
}
/** Stops the running timer and logs its minutes on the day it started (up to 12 hours). */
export function stopTimer(): void {
  const s = settings(), r = s.running;
  if (!r) return;
  s.running = null;
  saveSettings();
  const minutes = Math.min(720, Math.round((Date.now() - r.start) / 60000));
  if (minutes > 0) {
    const d = day(r.date);
    d.time[r.tid] = (d.time[r.tid] || 0) + minutes;
    saveDay(r.date);
  }
}
