// Board, Jira-style. Two projects keep Personal and Work apart. The sprint board shows
// the active sprint's issues by status; the backlog plans sprints. Every issue has a
// type, priority, points, an assignee (you or the AI), comments and a change history.
import { h, icon, valueOf, focusById } from '../lib/dom';
import { shortDate, today } from '../lib/dates';
import { setDragHandlers } from '../lib/drag';
import {
  ACTORS, ISSUE_TYPES, NO_FILTER, POINTS, PRIORITIES, STATUSES,
  activeSprint, addComment, completeSprint, createIssue, createSprint, deleteIssue, epicsOf, matches,
  projectOf, sprintPoints, startSprint, updateIssue, upgradeBoard, type IssueFilter
} from '../lib/board';
import { board, sendToToday } from '../app/state';
import { announce, openDialog, pageHead } from '../app/ui';
import { go, rerender } from '../app/shell';
import { store } from '../lib/store';
import type { Actor, Board, Issue, IssuePriority, IssueStatus, IssueType, Sprint } from '../lib/types';

const LIMIT = 3;
const save = (): void => store.save('board');
let filter: IssueFilter = { ...NO_FILTER };

const typeOf = (t: IssueType) => ISSUE_TYPES.find((x) => x.id === t)!;
const prioOf = (p: IssuePriority) => PRIORITIES.find((x) => x.id === p)!;
const when = (t: number): string => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The board document, upgraded from older versions if needed. */
export function loadBoard(): Board {
  const bd = board();
  if (upgradeBoard(bd)) save();
  return bd;
}

export function renderBoard(param: string | null): Node[] {
  const bd = loadBoard();
  const view = param === 'backlog' ? 'backlog' : 'board';
  const projects = bd.projects.filter((p) => filter.project === 'all' || p.key === filter.project);

  setDragHandlers((payload, zone, index) => {
    const [type, id] = payload.split(':');
    const issue = bd.issues.find((x) => x.id === id);
    if (type !== 'issue' || !issue) return;
    if (zone.startsWith('status:')) {
      updateIssue(bd, issue, 'status', zone.slice(7) as IssueStatus, 'me');
    } else if (zone.startsWith('sprint:')) {
      const [, target, project] = zone.split(':');
      if (project !== issue.project) { announce(`${issue.key} belongs to ${projectOf(bd, issue.project)?.name}. Move it within that project.`); return; }
      updateIssue(bd, issue, 'sprint', target === 'backlog' ? null : target, 'me');
    } else return;
    // Keep the drop order within the list.
    const peers = bd.issues.filter((x) => x !== issue && sameList(x, issue));
    bd.issues.splice(bd.issues.indexOf(issue), 1);
    if (index >= peers.length) bd.issues.push(issue); else bd.issues.splice(bd.issues.indexOf(peers[index]), 0, issue);
    save(); rerender();
  });

  return [
    pageHead('Board', {
      sub: view === 'board' ? 'The active sprint, by status. Drag issues across, or open one to change it.' : 'Plan sprints: drag issues from the backlog into a sprint, then start it.',
      actions: [
        h('div', { class: 'segmented', role: 'group', 'aria-label': 'View' },
          h('button', { type: 'button', 'aria-pressed': String(view === 'board'), onclick: () => go('board') }, 'Sprint board'),
          h('button', { type: 'button', 'aria-pressed': String(view === 'backlog'), onclick: () => go('board', 'backlog') }, 'Backlog')),
        h('wa-button', { variant: 'brand', appearance: 'accent', size: 's', id: 'create-issue', onclick: () => void createDialog(bd) }, icon('add', undefined, 'start'), 'Create issue')
      ]
    }),
    filterBar(bd),
    view === 'board' ? sprintBoard(bd, projects.map((p) => p.key)) : backlog(bd, projects.map((p) => p.key))
  ];
}

function sameList(a: Issue, b: Issue): boolean {
  return a.project === b.project && a.sprint === b.sprint && a.status === b.status;
}

/* ---------- filters ---------- */
function filterBar(bd: Board): HTMLElement {
  const chip = (label: string, pressed: boolean, onclick: () => void): HTMLElement =>
    h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pressed), onclick }, label);
  const set = (patch: Partial<IssueFilter>): void => { filter = { ...filter, ...patch }; rerender(); };
  const active = JSON.stringify(filter) !== JSON.stringify(NO_FILTER);
  return h('div', { class: 'board-filters glass', role: 'search', 'aria-label': 'Filter issues' },
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Project' },
      chip('All projects', filter.project === 'all', () => set({ project: 'all' })),
      bd.projects.map((p) => chip(p.name, filter.project === p.key, () => set({ project: p.key })))),
    h('wa-input', { id: 'issue-search', size: 's', placeholder: 'Search issues', value: filter.text, 'with-clear': true, 'aria-label': 'Search issues',
      oninput: (e: Event) => { filter.text = valueOf(e.target); rerender(); focusById('issue-search'); },
      'onwa-clear': () => set({ text: '' }) }, icon('search', undefined, 'start')),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Assignee' },
      (['me', 'ai', 'none'] as const).map((a) => chip(a === 'none' ? 'Unassigned' : ACTORS[a], filter.assignee === a, () => set({ assignee: filter.assignee === a ? 'any' : a })))),
    h('wa-select', { size: 's', value: filter.type, 'aria-label': 'Type', onchange: (e: Event) => set({ type: valueOf(e.target) as IssueFilter['type'] }) },
      h('wa-option', { value: 'any' }, 'All types'), ISSUE_TYPES.map((t) => h('wa-option', { value: t.id }, t.label))),
    h('wa-select', { size: 's', value: filter.priority, 'aria-label': 'Priority', onchange: (e: Event) => set({ priority: valueOf(e.target) as IssueFilter['priority'] }) },
      h('wa-option', { value: 'any' }, 'All priorities'), PRIORITIES.map((p) => h('wa-option', { value: p.id }, p.label))),
    active ? h('wa-button', { size: 's', appearance: 'plain', onclick: () => { filter = { ...NO_FILTER }; rerender(); } }, 'Clear filters') : null);
}

/* ---------- pieces ---------- */
const avatar = (a: Actor | null): HTMLElement => a
  ? h('span', { class: `avatar is-${a}`, title: `Assignee: ${ACTORS[a]}` }, icon(a === 'ai' ? 'smart_toy' : 'person', `Assignee: ${ACTORS[a]}`))
  : h('span', { class: 'avatar is-none', title: 'Unassigned' }, icon('person', 'Unassigned'));
const typeIcon = (t: IssueType): HTMLElement => h('span', { class: `type-icon is-${t}`, title: typeOf(t).label }, icon(typeOf(t).icon, typeOf(t).label));
const prioIcon = (p: IssuePriority): HTMLElement => h('span', { class: `prio-icon is-${p}`, title: `${prioOf(p).label} priority` }, icon(prioOf(p).icon, `${prioOf(p).label} priority`));

function issueCard(bd: Board, i: Issue): HTMLElement {
  const epic = i.epic ? bd.issues.find((x) => x.id === i.epic) : null;
  return h('li', {
    class: `tcard${i.status === 'done' ? ' is-done' : ''}`, 'data-drag': `issue:${i.id}`, tabindex: 0,
    'aria-label': `${i.key} ${i.title}. Press Enter to open.`,
    onclick: () => void issueDialog(bd, i),
    onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) void issueDialog(bd, i); }
  },
    h('span', { class: 'grip' }, icon('drag_indicator')),
    h('div', { class: 'title' }, i.title),
    epic ? h('span', { class: 'epic-tag' }, epic.title) : null,
    i.labels.length ? h('div', { class: 'labels' }, i.labels.map((l) => h('span', { class: 'label-tag' }, l))) : null,
    h('div', { class: 'meta' }, typeIcon(i.type), h('span', { class: 'key' }, i.key), prioIcon(i.priority),
      i.points !== null ? h('span', { class: 'points', title: 'Story points' }, String(i.points)) : null,
      h('span', { class: 'spacer' }), avatar(i.assignee)));
}

function issueRow(bd: Board, i: Issue): HTMLElement {
  return h('li', {
    class: `issue-row${i.status === 'done' ? ' is-done' : ''}`, 'data-drag': `issue:${i.id}`, tabindex: 0,
    'aria-label': `${i.key} ${i.title}. Press Enter to open.`,
    onclick: () => void issueDialog(bd, i),
    onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) void issueDialog(bd, i); }
  },
    h('span', { class: 'grip' }, icon('drag_indicator')),
    typeIcon(i.type), h('span', { class: 'key' }, i.key), h('span', { class: 'row-title' }, i.title),
    h('span', { class: `status-pill is-${i.status}` }, STATUSES.find((s) => s.id === i.status)!.label),
    prioIcon(i.priority),
    h('span', { class: 'points', title: 'Story points' }, i.points !== null ? String(i.points) : '–'),
    avatar(i.assignee));
}

/* ---------- sprint board ---------- */
function sprintBoard(bd: Board, projectKeys: string[]): Node {
  const sprints = projectKeys.map((k) => activeSprint(bd, k)).filter((s): s is Sprint => Boolean(s));
  if (!sprints.length) {
    return h('div', { class: 'card empty-state' },
      h('h2', null, 'No sprint running'),
      h('p', { class: 'muted' }, 'Start one from the backlog: pick the issues for the next two weeks, then start the sprint.'),
      h('wa-button', { variant: 'brand', appearance: 'accent', onclick: () => go('board', 'backlog') }, 'Open backlog'));
  }
  const ids = new Set(sprints.map((s) => s.id));
  const issues = bd.issues.filter((i) => i.sprint !== null && ids.has(i.sprint) && i.type !== 'epic' && matches(i, filter));
  return h('div', null,
    h('div', { class: 'sprint-strip' }, sprints.map((s) => {
      const pts = sprintPoints(bd, s.id);
      return h('div', { class: 'sprint-info glass' },
        h('div', null, h('strong', null, s.name), h('span', { class: 'muted' }, ` ${shortDate(s.start)} to ${shortDate(s.end)}`)),
        s.goal ? h('div', { class: 'muted' }, s.goal) : null,
        h('div', { class: 'sprint-progress' },
          h('div', { class: 'meter' }, h('span', { style: `width:${pts.total ? (pts.done / pts.total) * 100 : 0}%;background:var(--series-1)` })),
          h('span', { class: 'muted num' }, `${pts.done} of ${pts.total} points done`)),
        h('wa-button', { size: 's', appearance: 'outlined', onclick: () => void completeDialog(bd, s) }, 'Complete sprint'));
    })),
    h('div', { class: 'board' }, STATUSES.map((st) => {
      const list = issues.filter((i) => i.status === st.id);
      const mine = list.filter((i) => i.assignee === 'me').length;
      const over = st.id === 'doing' && mine > LIMIT;
      return h('section', { class: `column${over ? ' is-over' : ''}`, 'aria-label': st.label },
        h('div', { class: 'column-head' }, h('h2', null, st.label), h('span', { class: 'count' }, String(list.length))),
        over ? h('p', { class: 'column-warning' }, icon('warning'), `You have ${mine} in progress. Finish one before starting another.`) : null,
        h('ul', { class: 'cards list', 'data-drop': `status:${st.id}`, 'data-list': '' },
          list.length ? list.map((i) => issueCard(bd, i)) : h('li', { class: 'empty-note' }, st.id === 'done' ? 'Finished issues land here.' : 'Nothing here.')));
    })));
}

/* ---------- backlog ---------- */
function backlog(bd: Board, projectKeys: string[]): Node {
  return h('div', { class: 'stack' }, projectKeys.map((key) => {
    const p = projectOf(bd, key)!;
    const sprints = bd.sprints.filter((s) => s.project === key && s.state !== 'closed')
      .sort((a, b) => (a.state === 'active' ? -1 : b.state === 'active' ? 1 : a.start.localeCompare(b.start)));
    const section = (title: Node[], zone: string, list: Issue[], actions: Node[], extra: Node | null = null): HTMLElement => h('section', { class: 'card backlog-section' },
      h('div', { class: 'card-head' }, title, h('div', { class: 'actions' }, actions)),
      h('ul', { class: 'list issue-list', 'data-drop': zone, 'data-list': '' },
        list.length ? list.map((i) => issueRow(bd, i)) : h('li', { class: 'empty-note' }, 'Drag issues here.')),
      extra);
    const inList = (sprintId: string | null): Issue[] => bd.issues.filter((i) => i.project === key && i.sprint === sprintId && matches(i, filter));
    const quickAdd = h('wa-input', { id: `quick-add-${key}`, size: 's', placeholder: `Add an issue to the ${p.name} backlog and press Enter`, maxlength: 200, style: 'margin-top:8px',
      'aria-label': `Add an issue to the ${p.name} backlog`,
      onkeydown: (e: KeyboardEvent) => {
        const v = valueOf(e.target).trim();
        if (e.key === 'Enter' && v) { createIssue(bd, { project: key, title: v, assignee: 'me' }, 'me'); save(); rerender(); focusById(`quick-add-${key}`); }
      } });
    return h('div', { class: 'stack project-block' },
      h('h2', { class: 'dash-section' }, p.name),
      sprints.map((s) => {
        const pts = sprintPoints(bd, s.id, key);
        return section(
          [h('h2', null, s.name), h('span', { class: 'meta' }, `${s.state === 'active' ? 'Active, ' : ''}${shortDate(s.start)} to ${shortDate(s.end)}, ${pts.count} ${pts.count === 1 ? 'issue' : 'issues'}, ${pts.total} points`)],
          `sprint:${s.id}:${key}`, inList(s.id),
          [s.state === 'planned'
            ? h('wa-button', { size: 's', variant: 'brand', appearance: 'accent', disabled: Boolean(activeSprint(bd, key)), title: activeSprint(bd, key) ? 'Complete the active sprint first' : null,
                onclick: () => { startSprint(bd, s.id, 'me'); save(); announce(`${s.name} started.`); rerender(); } }, 'Start sprint')
            : h('wa-button', { size: 's', appearance: 'outlined', onclick: () => void completeDialog(bd, s) }, 'Complete sprint'),
          h('wa-button', { size: 's', appearance: 'plain', onclick: () => void sprintDialog(s) }, icon('edit', `Edit ${s.name}`))]);
      }),
      section([h('h2', null, 'Backlog'), h('span', { class: 'meta' }, `${inList(null).length} ${inList(null).length === 1 ? 'issue' : 'issues'}`)], `sprint:backlog:${key}`, inList(null),
        [h('wa-button', { size: 's', appearance: 'outlined', onclick: () => { createSprint(bd, key, today()); save(); rerender(); } }, 'Create sprint')], quickAdd));
  }));
}

/* ---------- dialogs ---------- */
function fields(bd: Board, i: Partial<Issue> & { project: string }) {
  const epics = epicsOf(bd, i.project).filter((e) => e.id !== i.id);
  const sprints = bd.sprints.filter((s) => s.project === i.project && s.state !== 'closed');
  return {
    title: h('wa-input', { label: 'Summary', value: i.title ?? '', maxlength: 200, required: true }),
    type: h('wa-select', { label: 'Type', value: i.type ?? 'task' }, ISSUE_TYPES.map((t) => h('wa-option', { value: t.id }, t.label))),
    status: h('wa-select', { label: 'Status', value: i.status ?? 'todo' }, STATUSES.map((s) => h('wa-option', { value: s.id }, s.label))),
    priority: h('wa-select', { label: 'Priority', value: i.priority ?? 'medium' }, PRIORITIES.map((p) => h('wa-option', { value: p.id }, p.label))),
    points: h('wa-select', { label: 'Story points', value: i.points == null ? 'none' : String(i.points) }, h('wa-option', { value: 'none' }, 'Not estimated'), POINTS.map((n) => h('wa-option', { value: String(n) }, String(n)))),
    assignee: h('wa-select', { label: 'Assignee', value: i.assignee ?? 'none' }, h('wa-option', { value: 'none' }, 'Unassigned'), h('wa-option', { value: 'me' }, 'Me'), h('wa-option', { value: 'ai' }, 'AI')),
    sprint: h('wa-select', { label: 'Sprint', value: i.sprint ?? 'backlog' }, h('wa-option', { value: 'backlog' }, 'Backlog'), sprints.map((s) => h('wa-option', { value: s.id }, s.name))),
    epic: h('wa-select', { label: 'Epic', value: i.epic ?? 'none' }, h('wa-option', { value: 'none' }, 'No epic'), epics.map((e) => h('wa-option', { value: e.id }, `${e.key} ${e.title}`))),
    labels: h('wa-input', { label: 'Labels', value: (i.labels ?? []).join(', '), hint: 'Separate with commas, for example: research, gaming', maxlength: 200 }),
    description: h('wa-textarea', { label: 'Description', rows: 4, resize: 'auto', maxlength: 5000, value: i.description ?? '' })
  };
}
type Fields = ReturnType<typeof fields>;
const read = (f: Fields) => ({
  title: valueOf(f.title).trim(),
  type: valueOf(f.type) as IssueType,
  status: valueOf(f.status) as IssueStatus,
  priority: valueOf(f.priority) as IssuePriority,
  points: valueOf(f.points) === 'none' ? null : Number(valueOf(f.points)),
  assignee: valueOf(f.assignee) === 'none' ? null : valueOf(f.assignee) as Actor,
  sprint: valueOf(f.sprint) === 'backlog' ? null : valueOf(f.sprint),
  epic: valueOf(f.epic) === 'none' ? null : valueOf(f.epic),
  labels: [...new Set(valueOf(f.labels).split(',').map((l) => l.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))].slice(0, 10),
  description: valueOf(f.description)
});
const grid = (f: Fields): HTMLElement => h('div', { class: 'issue-form' },
  h('div', { class: 'span-all' }, f.title), f.type, f.status, f.priority, f.points, f.assignee, f.sprint, f.epic, f.labels,
  h('div', { class: 'span-all' }, f.description));

async function createDialog(bd: Board): Promise<void> {
  const projectKey = filter.project !== 'all' ? filter.project : bd.projects[0].key;
  const project = h('wa-select', { label: 'Project', value: projectKey }, bd.projects.map((p) => h('wa-option', { value: p.key }, p.name)));
  const f = fields(bd, { project: projectKey, assignee: 'me' });
  const body = h('div', null, h('div', { class: 'issue-form', style: 'margin-bottom:16px' }, project), grid(f));
  // Sprints and epics depend on the project, so rebuild those two lists when it changes.
  project.addEventListener('change', () => {
    const fresh = fields(bd, { project: valueOf(project) });
    f.sprint.replaceWith(fresh.sprint); f.sprint = fresh.sprint;
    f.epic.replaceWith(fresh.epic); f.epic = fresh.epic;
  });
  const result = await openDialog('Create issue', [body], [{ id: 'cancel', label: 'Cancel' }, { id: 'create', label: 'Create', variant: 'brand' }]);
  if (result !== 'create') return;
  const v = read(f);
  if (!v.title) { announce('Add a summary to create the issue.'); return; }
  const issue = createIssue(bd, { project: valueOf(project), ...v }, 'me');
  save(); announce(`Created ${issue.key}.`); rerender();
}

async function issueDialog(bd: Board, issue: Issue): Promise<void> {
  const f = fields(bd, issue);
  const comments = h('ul', { class: 'comment-list' });
  const drawComments = (): void => {
    comments.replaceChildren(...(issue.comments.length
      ? issue.comments.map((c) => h('li', null, avatar(c.by), h('div', null, h('div', { class: 'comment-meta' }, h('strong', null, ACTORS[c.by]), ' ', h('span', { class: 'muted' }, when(c.at))), h('p', null, c.text))))
      : [h('li', { class: 'empty-note' }, 'No comments yet.')]));
  };
  drawComments();
  const newComment = h('wa-textarea', { rows: 2, resize: 'auto', maxlength: 2000, placeholder: 'Add a comment', 'aria-label': 'New comment' });
  const postBtn = h('wa-button', { size: 's', appearance: 'outlined', onclick: () => { addComment(issue, valueOf(newComment), 'me'); save(); (newComment as unknown as { value: string }).value = ''; drawComments(); } }, 'Add comment');
  const history = h('ol', { class: 'history-list' }, [...issue.history].reverse().map((c) => h('li', null,
    h('span', { class: 'muted' }, when(c.at)), ' ',
    h('strong', null, ACTORS[c.by]), ' ',
    c.field === 'created' ? `created this issue${c.to ? `. ${c.to}` : ''}` : `changed ${c.field} from “${c.from}” to “${c.to}”`)));

  const body = h('div', { class: 'issue-detail' },
    h('p', { class: 'issue-key' }, typeIcon(issue.type), `${issue.key} in ${projectOf(bd, issue.project)?.name ?? issue.project}`),
    grid(f),
    h('h3', null, 'Comments'), comments, newComment, h('div', { style: 'margin-top:8px' }, postBtn),
    h('h3', null, 'History'), history);

  const result = await openDialog(issue.key, [body], [
    { id: 'delete', label: 'Delete', variant: 'danger' },
    { id: 'today', label: 'Add to today' },
    { id: 'cancel', label: 'Close' },
    { id: 'save', label: 'Save', variant: 'brand' }
  ]);
  if (result === 'today') { sendToToday(`${issue.key} ${issue.title}`); announce(`Added ${issue.key} to today’s brain dump.`); return; }
  if (result === 'delete') {
    const sure = await openDialog(`Delete ${issue.key}?`, [h('p', null, `“${issue.title}”, its comments and its history will be removed. This can’t be undone.`)],
      [{ id: 'cancel', label: 'Keep it' }, { id: 'delete', label: 'Delete issue', variant: 'danger' }]);
    if (sure === 'delete') { deleteIssue(bd, issue, 'me'); save(); announce(`Deleted ${issue.key}.`); rerender(); }
    return;
  }
  if (result !== 'save') { rerender(); return; }
  const v = read(f);
  if (!v.title) v.title = issue.title;
  (Object.keys(v) as (keyof typeof v)[]).forEach((k) => updateIssue(bd, issue, k, v[k] as never, 'me'));
  if (issue.type === 'epic') updateIssue(bd, issue, 'epic', null, 'me');
  save(); rerender();
}

async function sprintDialog(s: Sprint): Promise<void> {
  const name = h('wa-input', { label: 'Name', value: s.name, maxlength: 60 });
  const goal = h('wa-textarea', { label: 'Sprint goal', value: s.goal, rows: 2, maxlength: 300 });
  const start = h('wa-input', { label: 'Start', type: 'date', value: s.start });
  const end = h('wa-input', { label: 'End', type: 'date', value: s.end });
  const result = await openDialog('Edit sprint', [h('div', { class: 'issue-form' }, h('div', { class: 'span-all' }, name), h('div', { class: 'span-all' }, goal), start, end)],
    [{ id: 'cancel', label: 'Cancel' }, { id: 'save', label: 'Save', variant: 'brand' }]);
  if (result !== 'save') return;
  s.name = valueOf(name).trim() || s.name;
  s.goal = valueOf(goal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(valueOf(start))) s.start = valueOf(start);
  if (/^\d{4}-\d{2}-\d{2}$/.test(valueOf(end)) && valueOf(end) >= s.start) s.end = valueOf(end);
  save(); rerender();
}

async function completeDialog(bd: Board, s: Sprint): Promise<void> {
  const open = bd.issues.filter((i) => i.sprint === s.id && i.status !== 'done').length;
  const next = bd.sprints.filter((x) => x.project === s.project && x.state === 'planned');
  const target = h('wa-select', { label: 'Move unfinished issues to', value: 'backlog' }, h('wa-option', { value: 'backlog' }, 'Backlog'), next.map((x) => h('wa-option', { value: x.id }, x.name)));
  const result = await openDialog(`Complete ${s.name}?`, [
    h('p', null, open ? `${open} ${open === 1 ? 'issue isn’t' : 'issues aren’t'} done yet.` : 'Every issue in this sprint is done.'),
    open ? target : null
  ].filter(Boolean) as Node[], [{ id: 'cancel', label: 'Cancel' }, { id: 'complete', label: 'Complete sprint', variant: 'brand' }]);
  if (result !== 'complete') return;
  const { done, moved } = completeSprint(bd, s.id, valueOf(target) === 'backlog' ? null : valueOf(target), 'me');
  save();
  announce(`${s.name} completed: ${done} done${moved ? `, ${moved} moved` : ''}.`);
  rerender();
}
