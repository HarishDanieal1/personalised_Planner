// Reset: a steady-days count, a 10-minute urge reset with swap actions,
// and a private log that shows which hours and triggers to protect.
import { h, icon } from '../lib/dom';
import { diffDays, h12, iso, MONTHS_SHORT, pad, today } from '../lib/dates';
import { uid } from '../lib/planner';
import { barChart } from '../lib/charts';
import { day, reset, saveDay, settings, startTimer } from '../app/state';
import { announce, card, pageHead } from '../app/ui';
import { rerender } from '../app/shell';
import { store } from '../lib/store';
import type { Reset } from '../lib/types';

const TRIGGERS = ['Bored', 'Tired', 'Stressed', 'Lonely', 'Late night', 'Phone in bed', 'Avoiding a task', 'Saw something online'];
const save = (): void => store.save('reset');
let flash: string | null = null;

export function renderReset(): Node[] {
  const r = reset();
  const t = today();
  if (!r.streakStart) { r.streakStart = t; save(); }
  const days = Math.max(0, diffDays(r.streakStart, t));
  const best = Math.max(r.best, days);
  const restart = (): void => { r.best = best; r.slips = [...r.slips, t].slice(-200); r.streakStart = t; };
  const message = flash; flash = null;

  const urgeHost = h('div');
  const startBtn = h('wa-button', { variant: 'brand', appearance: 'accent', size: 'l', style: 'width:100%' }, 'I’m feeling the pull');
  startBtn.addEventListener('click', () => {
    startBtn.hidden = true;
    urgeHost.replaceChildren(urgePanel(r, restart));
    urgeHost.querySelector<HTMLElement>('.urge-clock')?.focus();
  });

  const slipArea = h('div', { style: 'margin-top:8px' });
  const slipBtn = h('wa-button', { appearance: 'outlined', onclick: () => {
    slipBtn.hidden = true;
    slipArea.replaceChildren(h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
      h('span', null, 'Restart the count from today?'),
      h('wa-button', { variant: 'brand', appearance: 'accent', size: 's', onclick: () => { restart(); save(); flash = 'Logged. One slip is a data point, not the pattern. Check the hour and trigger on the right.'; rerender(); } }, 'Restart from today'),
      h('wa-button', { appearance: 'outlined', size: 's', onclick: () => { slipBtn.hidden = false; slipArea.replaceChildren(); } }, 'Keep my count')));
  } }, 'Log a slip');

  const nodes: (Node | null)[] = [
    pageHead('Reset', { sub: 'Private to your account. Synced only to your own Supabase rows.' }),
    message ? h('wa-callout', { variant: 'neutral', style: 'margin-bottom:16px', role: 'status' }, message) : null,
    h('div', { class: 'two-col' },
      h('div', { class: 'stack' },
        card('Days steady', [
          h('div', { class: 'streak' }, h('span', { class: 'metric' }, String(days)), h('span', { class: 'muted' }, days === 1 ? 'day' : 'days')),
          h('p', { class: 'metric-note' }, `Best so far: ${best} ${best === 1 ? 'day' : 'days'}. The count is a tool, not a verdict.`),
          h('div', { style: 'margin-top:16px' }, startBtn, urgeHost),
          h('p', { class: 'metric-note', style: 'margin-top:8px' }, 'Starts a 10-minute reset. Urges peak and fade; you only need to outlast this one.'),
          h('wa-divider', { style: 'margin:16px 0' }),
          h('h3', { style: 'font-size:14px;font-weight:500;margin-bottom:4px' }, 'Slipped?'),
          h('p', { class: 'metric-note', style: 'margin:0 0 8px' }, 'Log it honestly so the patterns stay accurate.'),
          slipBtn, slipArea
        ]),
        card('Speed bumps that help', [h('ul', { class: 'tips' },
          h('li', null, 'Planner can’t block websites. Turn on your device’s content filter (Screen Time on iPhone and Mac, Family Safety on Windows, Digital Wellbeing on Android, or a filtering DNS on your router) and give the passcode to someone you trust.'),
          h('li', null, 'Charge your phone outside the bedroom. Most late-night drift starts in bed.'),
          h('li', null, 'Block the risky hour in your day with something concrete instead of leaving it empty.'),
          h('li', null, 'If it’s taking over your sleep, work or mood, a counselor or therapist can help. It’s a common problem and there are people who work on exactly this.'))])),
      h('div', { class: 'stack' }, patternsCard(r), logCard(r)))
  ];
  return nodes.filter((n): n is Node => n !== null);
}

function urgePanel(r: Reset, restart: () => void): HTMLElement {
  let left = 600;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = h('div', { class: 'urge-clock', tabindex: -1, role: 'timer', 'aria-label': 'Ten minute reset' }, '10:00');
  const cue = h('span', null, reduce ? 'In for 4, out for 6' : 'Breathe in');
  const timer = window.setInterval(() => {
    if (!document.body.contains(clock)) { window.clearInterval(timer); return; }
    left--;
    clock.textContent = left > 0 ? `${Math.floor(left / 60)}:${pad(left % 60)}` : 'It passed.';
    if (!reduce) cue.textContent = (600 - left) % 10 < 4 ? 'Breathe in' : 'Breathe out';
    if (left <= 0) window.clearInterval(timer);
  }, 1000);

  const s = settings();
  const has = (id: string): boolean => s.trackers.some((x) => x.id === id);
  const topPriority = day(today()).priorities.find((p) => p.text.trim() && !p.done);
  const swaps: [string, string | null][] = [
    ...(topPriority ? [[`10 minutes on: ${topPriority.text.trim()}`, has('focus') ? 'focus' : null] as [string, string | null]] : []),
    ['Walk around the block, phone in pocket', has('exercise') ? 'exercise' : null],
    ['20 squats or push-ups, right now', null],
    ['Text or call someone', null],
    ['Cook or prep something', has('cooking') ? 'cooking' : null],
    ['Play a game, with the timer on', has('gaming') ? 'gaming' : null],
    ['Shower, then come back to this page', null]
  ];
  let chosen: string | null = null;
  const picked = new Set<string>();
  const swapList = h('div', { class: 'swaps' }, swaps.map(([label, tid]) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': 'false',
    onclick: (e: MouseEvent) => {
      swapList.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      (e.currentTarget as HTMLElement).setAttribute('aria-pressed', 'true');
      chosen = label;
      if (tid) { startTimer(tid); announce(`Timer started for ${s.trackers.find((x) => x.id === tid)?.name}.`); }
    }
  }, label + (tid ? ' (starts a timer)' : ''))));
  const triggers = h('div', { class: 'chips' }, TRIGGERS.map((t) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': 'false',
    onclick: (e: MouseEvent) => { if (picked.has(t)) picked.delete(t); else picked.add(t); (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(picked.has(t))); }
  }, t)));
  const log = (out: 'rode' | 'slip'): void => {
    r.urges = [...r.urges, { t: Date.now(), tr: [...picked], out, swap: chosen }].slice(-500);
    if (out === 'slip') { restart(); flash = 'Logged. The count starts again today. The hour and trigger are the spot to protect next time.'; }
    else flash = 'Logged. One more time you outlasted it.';
    save(); rerender();
  };
  return h('div', { class: 'card', style: 'margin-top:12px;background:var(--pl-surface-sunken);border:0' },
    h('div', { style: 'display:flex;align-items:center;gap:24px;flex-wrap:wrap' }, clock, h('div', { class: 'breath', 'aria-hidden': 'true' }, cue)),
    h('h3', { style: 'font-size:14px;font-weight:500;margin:16px 0 0' }, 'Pick one and start it now'), swapList,
    h('h3', { style: 'font-size:14px;font-weight:500;margin:16px 0 8px' }, 'What set it off?'), triggers,
    h('div', { style: 'display:flex;gap:8px;margin-top:16px' },
      h('wa-button', { variant: 'brand', appearance: 'accent', onclick: () => log('rode') }, 'I rode it out'),
      h('wa-button', { appearance: 'outlined', onclick: () => log('slip') }, 'I slipped')));
}

function patternsCard(r: Reset): HTMLElement {
  if (!r.urges.length) {
    return card('When the pull shows up', [h('p', { class: 'empty-note' }, 'Each time you use the reset, log how it went. After a few entries you’ll see which hours and triggers to protect.')]);
  }
  const hours = Array<number>(24).fill(0);
  r.urges.forEach((u) => { hours[new Date(u.t).getHours()]++; });
  const peak = hours.indexOf(Math.max(...hours));
  const counts = new Map<string, number>();
  r.urges.forEach((u) => u.tr.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top[0]?.[1] ?? 1;
  const month = today().slice(0, 7);
  const thisMonth = r.urges.filter((u) => iso(new Date(u.t)).slice(0, 7) === month);
  const rode = thisMonth.filter((u) => u.out === 'rode').length;
  const s = settings();
  const canBlock = peak >= s.dayStart && peak < s.dayEnd;

  const blockBtn = canBlock ? h('wa-button', { size: 's', appearance: 'outlined', onclick: (e: MouseEvent) => {
    const d = day(today()), start = peak * 60;
    const btn = e.currentTarget as HTMLElement;
    if (d.blocks.some((b) => start < b.start + b.dur && start + 60 > b.start)) { btn.textContent = 'That hour is already blocked today'; return; }
    d.blocks.push({ id: uid(), start, dur: 60, text: 'Phone away, do something real', done: false, tracker: null });
    saveDay(today());
    btn.textContent = `Blocked ${h12(start)} today`;
    btn.setAttribute('disabled', '');
  } }, `Block ${h12(peak * 60)} today`) : null;

  return card('When the pull shows up', [
    barChart(hours, { label: 'Urges by hour of day', labels: hours.map((_, i) => h12(i * 60)), format: (v) => `${v ?? 0} ${v === 1 ? 'urge' : 'urges'}`, color: 'var(--series-1)', height: 80 }),
    h('div', { class: 'chart-axis' }, ['12am', '6am', '12pm', '6pm', '11pm'].map((x) => h('span', null, x))),
    h('p', { style: 'margin:12px 0 8px' }, `Most often around ${h12(peak * 60)}.`),
    blockBtn,
    h('h3', { style: 'font-size:14px;font-weight:500;margin:20px 0 8px' }, 'What sets it off'),
    top.length ? top.map(([t, n]) => h('div', { class: 'hbar' }, h('span', null, t), h('span', { class: 'track' }, h('span', { style: `width:${(n / max) * 100}%` })), h('span', { class: 'num' }, String(n))))
      : h('p', { class: 'empty-note' }, 'No triggers logged yet.'),
    h('p', { class: 'metric-note', style: 'margin-top:12px' }, `This month: ${rode} ridden out, ${thisMonth.length - rode} slips logged with the reset.`)
  ]);
}

function logCard(r: Reset): HTMLElement {
  const recent = r.urges.slice(-8).reverse();
  return card('Recent', [recent.length
    ? h('ul', { class: 'list log' }, recent.map((u) => {
        const d = new Date(u.t);
        return h('li', null,
          h('span', null, `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${h12(d.getHours() * 60 + d.getMinutes())}${u.tr.length ? `: ${u.tr.join(', ')}` : ''}`),
          h('span', { style: 'display:flex;align-items:center;gap:4px' },
            h('wa-tag', { size: 's', variant: u.out === 'slip' ? 'danger' : 'success', appearance: 'outlined' }, u.out === 'slip' ? 'Slipped' : 'Rode it out'),
            h('wa-button', { size: 's', appearance: 'plain', onclick: () => { r.urges = r.urges.filter((x) => x !== u); save(); rerender(); } }, icon('close', 'Remove entry'))));
      }))
    : h('p', { class: 'empty-note' }, 'Nothing logged yet.')]);
}
