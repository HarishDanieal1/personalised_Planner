// Claude day planning. Each person uses their own Anthropic API key, which stays
// in this browser's storage only: it is never synced to Supabase or committed.
import type { Board, Day, Settings } from './types';
import { WEEKDAYS_LONG, fromIso, hm } from './dates';

const KEY_STORAGE = 'planner:anthropic-api-key';
const MODEL_STORAGE = 'planner:anthropic-model';

export const CLAUDE_MODELS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (recommended)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)' }
];
const DEFAULT_MODEL = 'claude-sonnet-5-5';

export const getApiKey = (): string => localStorage.getItem(KEY_STORAGE) ?? '';
export const setApiKey = (key: string): void => localStorage.setItem(KEY_STORAGE, key.trim());
export const forgetApiKey = (): void => localStorage.removeItem(KEY_STORAGE);
export const getModel = (): string => localStorage.getItem(MODEL_STORAGE) ?? DEFAULT_MODEL;
export const setModel = (id: string): void => localStorage.setItem(MODEL_STORAGE, id);

export class ClaudeError extends Error {}

export function buildPlanPrompt(day: Day, date: string, settings: Settings, board: Board, notes: string, nowMin: number | null): string {
  const data = {
    date,
    weekday: WEEKDAYS_LONG[fromIso(date).getDay()],
    currentTime: nowMin === null ? null : hm(nowMin),
    plannerHours: `${hm(settings.dayStart * 60)}-${hm(settings.dayEnd * 60)}`,
    topPriorities: day.priorities.filter((p) => p.text.trim() && !p.done).map((p) => p.text.trim()),
    brainDump: day.dump.filter((d) => !d.done && !d.blocked).map((d) => d.text.trim()).filter(Boolean),
    existingBlocks: day.blocks.map((b) => ({ start: hm(b.start), minutes: b.dur, text: b.text })),
    boardInProgress: board.cards.filter((c) => c.col === 'doing').map((c) => c.title).slice(0, 8),
    boardToDo: board.cards.filter((c) => c.col === 'todo').map((c) => c.title).slice(0, 10),
    trackers: settings.trackers.map((t) => ({ id: t.id, name: t.name, type: t.kind === 'limit' ? 'daily limit' : 'daily target', minutes: t.goal })),
    habits: settings.habits.map((h) => h.name),
    userNotes: notes.slice(0, 500)
  };
  return `You plan days for a timebox planner. The person wants a focused, realistic day and tends to drift into unproductive screen time when bored, tired or late at night.

Rules:
- Each block is either exactly 30 minutes (starting on :00 or :30), or a whole number of hours starting on the hour (for example start 09:00, minutes 120).
- Stay inside plannerHours.${nowMin === null ? '' : ' Only plan blocks that start after currentTime.'}
- Never overlap existingBlocks; they stay as they are.
- Put top priorities first, in the best focus hours (morning unless userNotes say otherwise), hardest first. Then brain dump and board items.
- Include meals, movement, and an evening wind-down block with the phone away. Fill risky idle stretches, especially late evening, with something concrete.
- Respect tracker limits (never exceed a daily limit) and aim for targets. Set "tracker" to the matching tracker id, or null.
- Use the person's own wording for task names, at most 40 characters.
- Leave some buffer; don't fill every slot.
Reply with JSON only, in this shape:
{"blocks":[{"start":"HH:MM","minutes":60,"text":"...","tracker":null}],"note":"One or two plain sentences on the shape of the day."}

Data:
${JSON.stringify(data)}`;
}

/** Send a prompt to Claude and parse the JSON object in its reply. */
export async function askClaudeForJson(prompt: string, signal?: AbortSignal): Promise<unknown> {
  const key = getApiKey();
  if (!key) throw new ClaudeError('Add your Anthropic API key in Settings to plan with Claude.');
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: getModel(), max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
    });
  } catch {
    throw new ClaudeError('Couldn’t reach Claude. Check your internet connection and try again.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (res.status === 401) throw new ClaudeError('Your Anthropic API key was rejected. Check it in Settings.');
    if (res.status === 429 || res.status === 529) throw new ClaudeError('Claude is busy right now. Try again in a minute.');
    throw new ClaudeError(body?.error?.message ?? `Claude returned an error (${res.status}).`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ClaudeError('Claude’s reply couldn’t be read as a plan. Try again.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ClaudeError('Claude’s reply couldn’t be read as a plan. Try again.');
  }
}
