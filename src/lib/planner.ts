// Pure planner rules, kept free of the DOM so they can be unit tested.
import type { Block, Day, Settings, Tracker } from './types';
import { hm } from './dates';

export const uid = (): string => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Minutes logged for a tracker on a day: timers and manual entries, plus finished blocks linked to it. */
export const trackerMinutes = (day: Day, trackerId: string): number =>
  (day.time[trackerId] || 0) + day.blocks.filter((b) => b.done && b.tracker === trackerId).reduce((s, b) => s + b.dur, 0);

export interface Score { score: number | null; pr: number; prDone: number; bl: number; blDone: number; hb: number; hbDone: number }
/**
 * Daily productivity score out of 100: priorities 40%, blocks 40%, habits 20%.
 * Parts with nothing planned are left out and the rest is rescaled.
 */
export function dayScore(day: Day, settings: Settings): Score {
  const pr = day.priorities.filter((p) => p.text.trim());
  const prDone = pr.filter((p) => p.done).length;
  const bl = day.blocks.length, blDone = day.blocks.filter((b) => b.done).length;
  const hb = settings.habits.length, hbDone = settings.habits.filter((h) => day.habits[h.id]).length;
  let total = 0, weight = 0;
  if (pr.length) { total += (40 * prDone) / pr.length; weight += 40; }
  if (bl) { total += (40 * blDone) / bl; weight += 40; }
  if (hb && (hbDone || weight)) { total += (20 * hbDone) / hb; weight += 20; }
  return { score: weight ? Math.round((total / weight) * 100) : null, pr: pr.length, prDone, bl, blDone, hb, hbDone };
}

/** Shade for a day on the Year page: 0 when nothing was planned, then 1-4 by quarter of the score. */
export function scoreLevel(score: number | null): 0 | 1 | 2 | 3 | 4 {
  if (score === null) return 0;
  if (score >= 75) return 4;
  if (score >= 50) return 3;
  if (score >= 25) return 2;
  return 1;
}

/** Snap a block: 30 minutes on a half hour, or whole hours on the hour. */
export function snapBlock(startMin: number, minutes: number): { start: number; dur: number } {
  if (minutes <= 30) return { start: Math.floor(startMin / 30) * 30, dur: 30 };
  return { start: Math.floor(startMin / 60) * 60, dur: Math.max(1, Math.round(minutes / 60)) * 60 };
}
export const overlaps = (a: { start: number; dur: number }, b: { start: number; dur: number }): boolean =>
  a.start < b.start + b.dur && b.start < a.start + a.dur;

export interface PlanResult { blocks: Block[]; note: string }
/**
 * Validate blocks proposed by Claude: parse times, snap to the grid, keep them inside
 * planner hours and after `notBefore`, drop overlaps and unknown trackers.
 */
export function cleanPlan(raw: unknown, day: Day, settings: Settings, notBefore = -1): PlanResult {
  const ids = new Set(settings.trackers.map((t: Tracker) => t.id));
  const taken = day.blocks.map((b) => ({ start: b.start, dur: b.dur }));
  const out: Block[] = [];
  const res = (raw && typeof raw === 'object' ? raw : {}) as { blocks?: unknown; note?: unknown };
  const list = Array.isArray(res.blocks) ? res.blocks.slice(0, 30) : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(r.start ?? '').trim());
    if (!m) continue;
    const minutes = Number(r.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    const { start, dur } = snapBlock(Number(m[1]) * 60 + Number(m[2]), minutes);
    if (start < settings.dayStart * 60 || start + dur > settings.dayEnd * 60 || start < notBefore) continue;
    const text = String(r.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!text) continue;
    const slot = { start, dur };
    if (taken.some((t) => overlaps(t, slot))) continue;
    taken.push(slot);
    const tracker = typeof r.tracker === 'string' && ids.has(r.tracker) ? r.tracker : null;
    out.push({ id: uid(), start, dur, text, done: false, tracker });
  }
  out.sort((a, b) => a.start - b.start);
  return { blocks: out, note: typeof res.note === 'string' ? res.note.slice(0, 400) : '' };
}

export const describeBlock = (b: Block): string => `${hm(b.start)}-${hm(b.start + b.dur)} ${b.text}`;

/** The block happening now, or else the next one that is not done. Null when nothing is left today. */
export function nextBlock(blocks: Block[], nowMin: number): { block: Block; now: boolean } | null {
  const left = [...blocks].sort((a, b) => a.start - b.start).find((b) => !b.done && b.start + b.dur > nowMin);
  return left ? { block: left, now: left.start <= nowMin } : null;
}
