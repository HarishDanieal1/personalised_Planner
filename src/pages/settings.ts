// Settings: account and sync, Claude, appearance, trackers, habits and data export.
import { h, icon, valueOf } from '../lib/dom';
import { cloudConfigured, signIn, signOut, signUp, syncState, pullAll } from '../lib/sync';
import { CLAUDE_MODELS, forgetApiKey, getApiKey, getModel, setApiKey, setModel } from '../lib/ai';
import { fmtMinutes, today } from '../lib/dates';
import { uid, clamp } from '../lib/planner';
import { nextTrackerSlot } from '../lib/defaults';
import { store } from '../lib/store';
import { saveSettings, settings, trackerColor } from '../app/state';
import { announce, card, pageHead } from '../app/ui';
import { getTheme, setTheme, type ThemeChoice } from '../app/theme';
import { rerender } from '../app/shell';

export function renderSettings(): Node[] {
  return [pageHead('Settings'), h('div', { class: 'settings' }, accountCard(), claudeCard(), appearanceCard(), trackersCard(), habitsCard(), dataCard())];
}

function accountCard(): HTMLElement {
  const st = syncState();
  if (!cloudConfigured()) {
    return card('Account and sync', [h('p', null, 'Cloud sync isn’t set up for this copy of Planner, so everything is saved on this device only. To turn it on, add your Supabase project’s URL and publishable key to a .env file (see .env.example) and restart the app.')]);
  }
  if (st.email) {
    return card('Account and sync', [
      h('p', { style: 'margin-top:0' }, 'Signed in as ', h('strong', null, st.email), '. Your planner syncs to your own rows in Supabase; nobody else can read them.'),
      st.message ? h('wa-callout', { variant: 'danger', style: 'margin-bottom:12px' }, `Last sync problem: ${st.message}`) : null,
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        h('wa-button', { appearance: 'outlined', onclick: async () => { const changed = await pullAll(); announce(changed ? 'Synced. Newer changes from your other devices were loaded.' : 'Synced. Everything is up to date.'); rerender(); } }, icon('sync', undefined, 'start'), 'Sync now'),
        h('wa-button', { appearance: 'outlined', onclick: async () => { await signOut(); announce('Signed out. Your planner stays on this device.'); rerender(); } }, icon('logout', undefined, 'start'), 'Sign out'))
    ]);
  }
  const email = h('wa-input', { id: 'auth-email', label: 'Email', type: 'email', autocomplete: 'email', required: true });
  const password = h('wa-input', { id: 'auth-password', label: 'Password', type: 'password', autocomplete: 'current-password', 'password-toggle': true, minlength: 8, required: true, hint: 'At least 8 characters' });
  const status = h('div', { 'aria-live': 'polite' });
  const submit = async (mode: 'in' | 'up'): Promise<void> => {
    const e = valueOf(email).trim(), p = valueOf(password);
    if (!e || p.length < 8) { status.replaceChildren(h('wa-callout', { variant: 'danger' }, 'Enter your email and a password of at least 8 characters.')); return; }
    status.replaceChildren(h('p', { class: 'muted' }, mode === 'in' ? 'Signing in…' : 'Creating your account…'));
    const err = mode === 'in' ? await signIn(e, p) : await signUp(e, p);
    if (err === 'check-email') status.replaceChildren(h('wa-callout', { variant: 'success' }, `Check ${e} for a confirmation link, then come back and sign in.`));
    else if (err) status.replaceChildren(h('wa-callout', { variant: 'danger' }, err));
    else { announce('Signed in. Syncing your planner.'); rerender(); }
  };
  return card('Account and sync', [
    h('p', { style: 'margin-top:0' }, 'Sign in to keep your planner in sync across devices. Without an account it’s saved on this device only.'),
    h('form', { style: 'display:grid;gap:12px;max-width:420px', onsubmit: (ev: Event) => { ev.preventDefault(); void submit('in'); } },
      email, password,
      h('div', { style: 'display:flex;gap:8px' },
        h('wa-button', { type: 'submit', variant: 'brand', appearance: 'accent' }, 'Sign in'),
        h('wa-button', { appearance: 'outlined', onclick: () => void submit('up') }, 'Create account'))),
    status
  ]);
}

function claudeCard(): HTMLElement {
  const has = Boolean(getApiKey());
  const key = h('wa-input', { id: 'claude-key', label: 'Anthropic API key', type: 'password', 'password-toggle': true, autocomplete: 'off', placeholder: has ? 'A key is saved. Enter a new one to replace it.' : 'sk-ant-…', hint: 'Get one at console.anthropic.com. It’s stored on this device only and never synced.' });
  const model = h('wa-select', { id: 'claude-model', label: 'Model', value: getModel(), onchange: (e: Event) => { setModel(valueOf(e.target)); announce('Model saved.'); } },
    CLAUDE_MODELS.map((m) => h('wa-option', { value: m.id }, m.label)));
  return card('Claude day planning', [
    h('p', { style: 'margin-top:0' }, has ? 'A key is saved on this device. “Plan my day with Claude” is on.' : 'Add your own Anthropic API key to turn on “Plan my day with Claude” on the Day page. Requests go straight from this device to Anthropic.'),
    h('div', { style: 'display:grid;gap:12px;max-width:520px' }, key, model),
    h('div', { style: 'display:flex;gap:8px;margin-top:12px' },
      h('wa-button', { variant: 'brand', appearance: 'accent', onclick: () => { const v = valueOf(key).trim(); if (!v) return; setApiKey(v); announce('API key saved on this device.'); rerender(); } }, 'Save key'),
      has ? h('wa-button', { appearance: 'outlined', onclick: () => { forgetApiKey(); announce('API key removed from this device.'); rerender(); } }, 'Remove key') : null)
  ]);
}

function appearanceCard(): HTMLElement {
  const choices: [ThemeChoice, string][] = [['system', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']];
  return card('Appearance', [h('wa-select', { id: 'theme', label: 'Theme', value: getTheme(), style: 'max-width:320px', onchange: (e: Event) => setTheme(valueOf(e.target) as ThemeChoice) },
    choices.map(([v, l]) => h('wa-option', { value: v }, l)))]);
}

function trackersCard(): HTMLElement {
  const s = settings();
  const name = h('wa-input', { id: 'tracker-name', label: 'Name', maxlength: 30, placeholder: 'For example: Reading' });
  const kind = h('wa-select', { id: 'tracker-kind', label: 'Type', value: 'target' }, h('wa-option', { value: 'target' }, 'Target (aim to reach)'), h('wa-option', { value: 'limit' }, 'Limit (stay under)'));
  const goal = h('wa-input', { id: 'tracker-goal', label: 'Minutes per day', type: 'number', min: 5, max: 1440, step: 5, value: '30' });
  return card('Time trackers', [
    h('ul', { class: 'list settings-list' }, s.trackers.map((t) => h('li', null,
      h('span', { class: 'swatch', style: `background:${trackerColor(t)}`, 'aria-hidden': 'true' }),
      h('span', { class: 'label' }, `${t.name}: ${fmtMinutes(t.goal)} a day, ${t.kind === 'limit' ? 'limit' : 'target'}`),
      h('wa-button', { size: 's', appearance: 'plain', onclick: () => { s.trackers = s.trackers.filter((x) => x !== t); if (s.running?.tid === t.id) s.running = null; saveSettings(); rerender(); } }, icon('delete', `Remove ${t.name}. Its logged minutes stay in your days.`))))),
    h('form', { class: 'form-row', style: 'margin-top:16px', onsubmit: (e: Event) => {
      e.preventDefault();
      const n = valueOf(name).trim();
      if (!n) return;
      s.trackers.push({ id: uid(), name: n, kind: valueOf(kind) === 'limit' ? 'limit' : 'target', goal: clamp(Math.round(Number(valueOf(goal)) || 30), 5, 1440), slot: nextTrackerSlot(s.trackers.map((x) => x.slot)) });
      saveSettings(); rerender();
    } }, name, kind, goal, h('wa-button', { type: 'submit', appearance: 'outlined' }, icon('add', undefined, 'start'), 'Add tracker'))
  ]);
}

function habitsCard(): HTMLElement {
  const s = settings();
  return card('Habits', [
    h('ul', { class: 'list settings-list' }, s.habits.map((x) => h('li', null,
      h('span', { class: 'label' }, x.name),
      h('wa-button', { size: 's', appearance: 'plain', onclick: () => { s.habits = s.habits.filter((y) => y !== x); saveSettings(); rerender(); } }, icon('delete', `Remove ${x.name}`))))),
    h('p', { class: 'metric-note' }, 'Add habits from the habit tracker on the Week page.')
  ]);
}

function dataCard(): HTMLElement {
  const exportData = (): void => {
    const all: Record<string, unknown> = {};
    for (const k of store.keys()) all[k] = store.get(k);
    const blob = new Blob([JSON.stringify({ app: 'planner', version: 1, exported: new Date().toISOString(), documents: all }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `planner-export-${today()}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.getAttribute('href')!), 1000);
  };
  return card('Your data', [
    h('p', { style: 'margin-top:0' }, `${store.keys().length} ${store.keys().length === 1 ? 'document' : 'documents'} saved on this device. Download a copy any time; it’s plain JSON you can keep or move.`),
    h('wa-button', { appearance: 'outlined', onclick: exportData }, 'Download my data')
  ]);
}
