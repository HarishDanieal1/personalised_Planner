// App shell: glass top bar, fixed left navigation with collapsible groups, hash router,
// search, timer and sync status.
import { h, icon, valueOf, focusById } from '../lib/dom';
import { store } from '../lib/store';
import { installDrag, setDragHandlers } from '../lib/drag';
import { onSyncChange, startSync, syncState, type SyncState } from '../lib/sync';
import { shortDate } from '../lib/dates';
import { settings, stopTimer, trackerColor } from './state';
import { applyTheme } from './theme';
import { renderDashboard } from '../pages/dashboard';
import { renderProgress } from '../pages/progress';
import { renderDay } from '../pages/day';
import { renderWeek } from '../pages/week';
import { renderMonth } from '../pages/month';
import { renderBoard } from '../pages/board';
import { renderReset } from '../pages/reset';
import { renderYear } from '../pages/year';
import { renderMemory } from '../pages/memory';
import { FINANCE_PAGES, renderFinance } from '../pages/finance';
import { logo } from './logo';
import { renderSettings } from '../pages/settings';
import type { Board, Day, Month, Week } from '../lib/types';

export interface Route { page: string; param: string | null }
type Renderer = (param: string | null) => Node[];

interface PageDef { id: string; label: string; icon: string; render: Renderer }
interface NavGroup { group: string; label: string; icon: string; items: (PageDef | { section: string })[] }
type NavEntry = PageDef | NavGroup;

const page = (id: string, label: string, ic: string, render: Renderer): PageDef => ({ id, label, icon: ic, render });
const NAV: NavEntry[] = [
  page('dashboard', 'Dashboard', 'dashboard', () => renderDashboard()),
  { group: 'planner', label: 'Planner', icon: 'event_note', items: [
    page('progress', 'Progress', 'trending_up', () => renderProgress()),
    page('day', 'Day', 'today', (p) => renderDay(p)),
    page('week', 'Week', 'date_range', (p) => renderWeek(p)),
    page('month', 'Month', 'calendar_month', (p) => renderMonth(p)),
    page('year', 'Year', 'grid_view', (p) => renderYear(p)),
    page('reset', 'Reset', 'self_improvement', () => renderReset())
  ] },
  page('board', 'Board', 'view_kanban', (p) => renderBoard(p)),
  { group: 'memory', label: 'Memory', icon: 'bookmark', items: [
    page('memory-ai', 'AI memory', 'smart_toy', () => renderMemory('ai')),
    page('memory-user', 'User memory', 'person', () => renderMemory('user'))
  ] },
  { group: 'financial', label: 'Financial', icon: 'account_balance_wallet', items: FINANCE_PAGES.flatMap((f, i) => [
    ...(f.section && f.section !== FINANCE_PAGES[i - 1]?.section ? [{ section: f.section }] : []),
    page(f.id, f.label, f.icon, () => renderFinance(f.id))
  ]) }
];
const SETTINGS: PageDef = page('settings', 'Settings', 'settings', () => renderSettings());
const isGroup = (e: NavEntry): e is NavGroup => 'group' in e;
const PAGES: PageDef[] = NAV.flatMap((e) => isGroup(e) ? e.items.filter((x): x is PageDef => 'id' in x) : [e]);
const groupOf = (pageId: string): NavGroup | undefined => NAV.filter(isGroup).find((g) => g.items.some((x) => 'id' in x && x.id === pageId));

/* Which groups are open is a per-device preference. */
const OPEN_KEY = 'planner:nav-open';
const openGroups = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '["planner"]') as string[]); } catch { return new Set(['planner']); }
};
const saveOpenGroups = (s: Set<string>): void => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...s])); } catch { /* private mode */ } };

let main: HTMLElement;
let nav: HTMLElement;
let timerChip: HTMLElement;
let syncChip: HTMLElement;

export function parseRoute(hash: string): Route {
  const [page, param] = hash.replace(/^#/, '').split('/');
  const known = [...PAGES, SETTINGS].some((p) => p.id === page);
  return { page: known ? page : 'dashboard', param: param ? decodeURIComponent(param) : null };
}
export const go = (page: string, param?: string): void => { location.hash = param ? `${page}/${param}` : page; };

/** Re-render the current page, keeping the scroll position. */
export function rerender(): void {
  const route = parseRoute(location.hash);
  const def = [...PAGES, SETTINGS].find((p) => p.id === route.page)!;
  setDragHandlers(null);
  const y = window.scrollY;
  const active = document.activeElement as HTMLElement | null;
  const focusId = active?.id || null;
  main.replaceChildren(...def.render(route.param));
  window.scrollTo(0, y);
  if (focusId) focusById(focusId);
  for (const a of nav.querySelectorAll('a')) {
    if (a.dataset.page === route.page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  const g = groupOf(route.page);
  if (g) setGroupOpen(g.group, true, false);
  document.title = `${def.label} – Planner`;
  updateTimerChip();
}

export function startApp(root: HTMLElement): void {
  applyTheme();
  installDrag();

  const navLink = (p: PageDef): HTMLElement => h('a', { href: `#${p.id}`, 'data-page': p.id, 'data-drawer': 'close' }, icon(p.icon), h('span', null, p.label));
  const open = openGroups();
  const navGroup = (g: NavGroup): HTMLElement => {
    const listId = `nav-group-${g.group}`;
    return h('div', { class: 'nav-group', 'data-group': g.group },
      h('button', { type: 'button', class: 'nav-group-toggle', 'aria-expanded': String(open.has(g.group)), 'aria-controls': listId,
        onclick: (e: MouseEvent) => setGroupOpen(g.group, (e.currentTarget as HTMLElement).getAttribute('aria-expanded') !== 'true') },
        icon(g.icon), h('span', null, g.label), h('wa-icon', { name: 'chevron_right', class: 'chev', 'aria-hidden': 'true' })),
      h('div', { class: 'nav-group-items', id: listId, hidden: !open.has(g.group) },
        g.items.map((x) => 'id' in x ? navLink(x) : h('div', { class: 'nav-sub', 'aria-hidden': 'true' }, x.section))));
  };
  nav = h('nav', { slot: 'navigation', class: 'sidenav', 'aria-label': 'Main' },
    NAV.map((e) => isGroup(e) ? navGroup(e) : navLink(e)),
    h('div', { class: 'nav-spacer' }),
    h('hr'),
    navLink(SETTINGS));

  timerChip = h('div', { class: 'timer-chip', hidden: true });
  syncChip = h('a', { class: 'sync-chip', href: '#settings' });

  const header = h('header', { slot: 'header', class: 'topbar' },
    h('wa-button', { 'data-toggle-nav': true, appearance: 'plain' }, icon('menu', 'Open navigation')),
    h('a', { class: 'brand', href: '#dashboard', 'aria-label': 'Planner, go to dashboard' }, logo(34), h('span', null, 'Planner')),
    buildSearch(),
    h('div', { class: 'top-actions' }, timerChip, syncChip));

  main = h('main', { id: 'main-content' });
  const shell = h('wa-page', { 'mobile-breakpoint': '900' }, header, nav, main);
  root.replaceWith(shell);

  onSyncChange(renderSyncChip);
  renderSyncChip(syncState());
  startSync(() => rerender());
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); rerender(); });
  setInterval(updateTimerChip, 1000);
  rerender();
}

/** Open or close a navigation group. `remember` saves the choice for next time. */
function setGroupOpen(group: string, isOpen: boolean, remember = true): void {
  const el = nav.querySelector<HTMLElement>(`[data-group="${group}"]`);
  if (!el) return;
  el.querySelector('.nav-group-toggle')!.setAttribute('aria-expanded', String(isOpen));
  (el.querySelector('.nav-group-items') as HTMLElement).hidden = !isOpen;
  if (remember) {
    const s = openGroups();
    if (isOpen) s.add(group); else s.delete(group);
    saveOpenGroups(s);
  }
}

function renderSyncChip(s: SyncState): void {
  const map: Record<SyncState['status'], [string, string]> = {
    'not-configured': ['cloud_off', 'Saved on this device'],
    'signed-out': ['cloud_off', 'Saved on this device'],
    syncing: ['sync', 'Syncing…'],
    synced: ['cloud_done', 'Synced'],
    offline: ['cloud_off', 'Offline, will sync later'],
    error: ['cloud_off', 'Sync failed']
  };
  const [ic, text] = map[s.status];
  syncChip.classList.toggle('is-error', s.status === 'error');
  syncChip.title = s.message || text;
  syncChip.replaceChildren(icon(ic), h('span', null, text));
}

function updateTimerChip(): void {
  const s = settings(), r = s.running;
  if (!r) { timerChip.hidden = true; return; }
  const t = s.trackers.find((x) => x.id === r.tid);
  const sec = Math.max(0, Math.floor((Date.now() - r.start) / 1000));
  const text = `${t?.name ?? 'Timer'} ${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const label = timerChip.querySelector('.label');
  if (timerChip.hidden || !label) {
    timerChip.hidden = false;
    timerChip.replaceChildren(
      h('span', { class: 'swatch', style: t ? `background:${trackerColor(t)}` : '' }),
      h('span', { class: 'label', role: 'timer', 'aria-live': 'off' }, text),
      h('wa-button', { size: 's', appearance: 'plain', onclick: () => { stopTimer(); rerender(); } }, icon('stop', 'Stop timer')));
  } else label.textContent = text;
}

/* ---------- search ---------- */
interface Hit { text: string; where: string; href: string }

function searchAll(q: string): Hit[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: Hit[] = [];
  const add = (text: string, where: string, href: string): void => {
    if (text && text.toLowerCase().includes(needle)) hits.push({ text, where, href });
  };
  for (const key of store.keys()) {
    if (key.startsWith('day:')) {
      const date = key.slice(4), d = store.get<Day>(key), where = shortDate(date);
      d.priorities.forEach((p) => add(p.text, `Priority, ${where}`, `#day/${date}`));
      d.dump.forEach((x) => add(x.text, `Brain dump, ${where}`, `#day/${date}`));
      d.blocks.forEach((b) => add(b.text, `Schedule, ${where}`, `#day/${date}`));
    } else if (key === 'board') {
      (store.get<Board>(key).issues ?? []).forEach((c) => add(`${c.key} ${c.title}`, `Board, ${c.project === 'WORK' ? 'Work' : 'Personal'}`, '#board/backlog'));
    } else if (key.startsWith('week:')) {
      const mon = key.slice(5), w = store.get<Week>(key), where = `Week of ${shortDate(mon)}`;
      Object.values(w.matrix).flat().forEach((x) => add(x.text, where, `#week/${mon}`));
      if (w.notes.toLowerCase().includes(needle)) add(w.notes.split('\n').find((l) => l.toLowerCase().includes(needle)) ?? w.notes, `Notes, ${where}`, `#week/${mon}`);
    } else if (key.startsWith('month:')) {
      const ym = key.slice(6), m = store.get<Month>(key);
      m.goals.forEach((g) => add(g.text, `Monthly goal, ${ym}`, `#month/${ym}`));
      Object.entries(m.cells).forEach(([d, t]) => add(t, `${ym}-${d.padStart(2, '0')}`, `#day/${ym}-${d.padStart(2, '0')}`));
    }
  }
  return hits.slice(0, 20);
}

function buildSearch(): HTMLElement {
  const results = h('ul', { class: 'search-results', id: 'search-results', role: 'listbox', hidden: true });
  const input = h('wa-input', {
    id: 'global-search',
    placeholder: 'Search priorities, tasks, cards and notes',
    'with-clear': true,
    'aria-controls': 'search-results',
    autocomplete: 'off'
  }, icon('search', undefined, 'start'));
  const show = (): void => {
    const q = valueOf(input);
    const hits = searchAll(q);
    if (q.trim().length < 2) { results.hidden = true; return; }
    results.hidden = false;
    results.replaceChildren(...(hits.length
      ? hits.map((x) => h('li', { role: 'option' }, h('a', { href: x.href, onclick: () => { results.hidden = true; } }, h('span', null, x.text.slice(0, 90)), h('span', { class: 'where' }, x.where))))
      : [h('li', { class: 'empty' }, `Nothing matches “${q.trim()}”.`)]));
  };
  input.addEventListener('input', show);
  input.addEventListener('wa-clear', () => { results.hidden = true; });
  input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') results.hidden = true; });
  document.addEventListener('pointerdown', (e) => { if (!(e.target as HTMLElement).closest('.search')) results.hidden = true; });
  return h('div', { class: 'search', role: 'search' }, input, results);
}

