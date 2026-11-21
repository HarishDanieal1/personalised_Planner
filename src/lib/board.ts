// Board rules, Jira-style, with no UI. Work is split into projects (Personal and Work),
// each with its own issue keys, backlog and sprints. Every change records who made it,
// you or the AI, so the history shows when and why something went off track.
import type { Actor, Board, Issue, IssuePriority, IssueStatus, IssueType, Project, Sprint } from './types';

export const ISSUE_TYPES: { id: IssueType; label: string; icon: string }[] = [
  { id: 'task', label: 'Task', icon: 'check_box' },
  { id: 'story', label: 'Story', icon: 'bookmark' },
  { id: 'bug', label: 'Bug', icon: 'bug_report' },
  { id: 'epic', label: 'Epic', icon: 'bolt' }
];
export const PRIORITIES: { id: IssuePriority; label: string; icon: string }[] = [
  { id: 'highest', label: 'Highest', icon: 'keyboard_double_arrow_up' },
  { id: 'high', label: 'High', icon: 'keyboard_arrow_up' },
  { id: 'medium', label: 'Medium', icon: 'drag_handle' },
  { id: 'low', label: 'Low', icon: 'keyboard_arrow_down' },
  { id: 'lowest', label: 'Lowest', icon: 'keyboard_double_arrow_down' }
];
export const STATUSES: { id: IssueStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'review', label: 'In review' },
  { id: 'done', label: 'Done' }
];
export const ACTORS: Record<Actor, string> = { me: 'Me', ai: 'AI' };
export const POINTS = [1, 2, 3, 5, 8, 13];

const id = (): string => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const isoDay = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDays = (date: string, n: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + n).getTime());
};

export function emptyBoard(): Board {
  return {
    projects: [
      { key: 'PER', name: 'Personal', kind: 'personal', next: 1 },
      { key: 'WORK', name: 'Work', kind: 'work', next: 1 }
    ],
    sprints: [],
    issues: [],
    cards: []
  };
}

/** Make sure a board loaded from storage has every list, and copy v0.0.2 cards into issues once. Returns true if it changed. */
export function upgradeBoard(bd: Board, now = Date.now()): boolean {
  let changed = false;
  if (!Array.isArray(bd.projects) || !bd.projects.length) { bd.projects = emptyBoard().projects; changed = true; }
  if (!Array.isArray(bd.sprints)) { bd.sprints = []; changed = true; }
  if (!Array.isArray(bd.issues)) { bd.issues = []; changed = true; }
  if (!Array.isArray(bd.cards)) { bd.cards = []; changed = true; }
  if (bd.cards.length && !bd.cardsMigrated) {
    for (const c of bd.cards) {
      const project = c.tag === 'Work' ? 'WORK' : 'PER';
      let sprint: string | null = null;
      if (c.col !== 'backlog') sprint = activeSprint(bd, project)?.id ?? startSprint(bd, createSprint(bd, project, isoDay(now)).id, 'me', now)!.id;
      const issue = createIssue(bd, {
        project,
        title: c.title,
        description: [c.notes, c.est ? `Estimate: ${c.est} minutes` : ''].filter(Boolean).join('\n\n'),
        labels: c.tag && c.tag !== 'Work' && c.tag !== 'Personal' ? [c.tag] : [],
        sprint,
        status: c.col === 'doing' ? 'doing' : c.col === 'done' ? 'done' : 'todo'
      }, 'me', now);
      issue.history[0].to = 'Moved from the old board';
    }
    bd.cardsMigrated = true;
    changed = true;
  }
  return changed;
}

export const projectOf = (bd: Board, key: string): Project | undefined => bd.projects.find((p) => p.key === key);
export const activeSprint = (bd: Board, project: string): Sprint | undefined => bd.sprints.find((s) => s.project === project && s.state === 'active');
export const epicsOf = (bd: Board, project: string): Issue[] => bd.issues.filter((i) => i.project === project && i.type === 'epic');

export interface NewIssue {
  project: string;
  title: string;
  type?: IssueType;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  points?: number | null;
  assignee?: Actor | null;
  sprint?: string | null;
  epic?: string | null;
  labels?: string[];
}

export function createIssue(bd: Board, n: NewIssue, by: Actor, now = Date.now()): Issue {
  const project = projectOf(bd, n.project) ?? bd.projects[0];
  const issue: Issue = {
    id: id(),
    key: `${project.key}-${project.next++}`,
    project: project.key,
    type: n.type ?? 'task',
    title: n.title.trim().slice(0, 200) || 'Untitled',
    description: (n.description ?? '').slice(0, 5000),
    status: n.status ?? 'todo',
    priority: n.priority ?? 'medium',
    points: n.points ?? null,
    assignee: n.assignee ?? null,
    sprint: n.sprint ?? null,
    epic: n.type === 'epic' ? null : n.epic ?? null,
    labels: n.labels ?? [],
    created: now,
    updated: now,
    comments: [],
    history: [{ at: now, by, field: 'created', from: '', to: '' }]
  };
  bd.issues.push(issue);
  return issue;
}

/** Readable value of an issue field, for the history log. */
export function describe(bd: Board, field: string, value: unknown): string {
  if (field === 'sprint' && value === null) return 'Backlog';
  if (value === null || value === undefined || value === '') return 'None';
  switch (field) {
    case 'status': return STATUSES.find((s) => s.id === value)?.label ?? String(value);
    case 'priority': return PRIORITIES.find((p) => p.id === value)?.label ?? String(value);
    case 'type': return ISSUE_TYPES.find((t) => t.id === value)?.label ?? String(value);
    case 'assignee': return ACTORS[value as Actor] ?? String(value);
    case 'sprint': return bd.sprints.find((s) => s.id === value)?.name ?? 'Backlog';
    case 'epic': return bd.issues.find((i) => i.id === value)?.title ?? 'None';
    case 'labels': return (value as string[]).join(', ') || 'None';
    case 'description': return String(value).length > 60 ? `${String(value).slice(0, 60)}…` : String(value);
    default: return String(value);
  }
}

type Editable = 'title' | 'description' | 'type' | 'status' | 'priority' | 'points' | 'assignee' | 'sprint' | 'epic' | 'labels';

/** Change one field and log it. No-op (and no log) when the value is the same. */
export function updateIssue<K extends Editable>(bd: Board, issue: Issue, field: K, value: Issue[K], by: Actor, now = Date.now()): boolean {
  const before = issue[field];
  if (JSON.stringify(before) === JSON.stringify(value)) return false;
  issue.history.push({ at: now, by, field, from: describe(bd, field, before), to: describe(bd, field, value) });
  issue[field] = value;
  issue.updated = now;
  return true;
}

export function addComment(issue: Issue, text: string, by: Actor, now = Date.now()): void {
  const t = text.trim().slice(0, 2000);
  if (!t) return;
  issue.comments.push({ id: id(), by, at: now, text: t });
  issue.updated = now;
}

/** Delete an issue. Issues that pointed at it (an epic) lose the link, with a log entry. */
export function deleteIssue(bd: Board, issue: Issue, by: Actor, now = Date.now()): void {
  for (const other of bd.issues) if (other.epic === issue.id) updateIssue(bd, other, 'epic', null, by, now);
  bd.issues = bd.issues.filter((i) => i !== issue);
}

/* ---------- sprints ---------- */
export function createSprint(bd: Board, project: string, startDate: string): Sprint {
  const n = bd.sprints.filter((s) => s.project === project).length + 1;
  const sprint: Sprint = { id: id(), project, name: `${project} Sprint ${n}`, goal: '', start: startDate, end: addDays(startDate, 13), state: 'planned' };
  bd.sprints.push(sprint);
  return sprint;
}

/** Start a planned sprint. Only one sprint per project can be active; returns null if another is. */
export function startSprint(bd: Board, sprintId: string, _by: Actor, now = Date.now()): Sprint | null {
  const s = bd.sprints.find((x) => x.id === sprintId);
  if (!s || s.state !== 'planned' || activeSprint(bd, s.project)) return null;
  const length = Math.max(1, Math.round((Date.parse(s.end) - Date.parse(s.start)) / 864e5));
  s.state = 'active';
  s.start = isoDay(now);
  s.end = addDays(s.start, length);
  return s;
}

/** Close a sprint. Unfinished issues move to the backlog or to another sprint, with a log entry each. */
export function completeSprint(bd: Board, sprintId: string, moveTo: string | null, by: Actor, now = Date.now()): { done: number; moved: number } {
  const s = bd.sprints.find((x) => x.id === sprintId);
  if (!s || s.state !== 'active') return { done: 0, moved: 0 };
  const target = moveTo && bd.sprints.find((x) => x.id === moveTo && x.state !== 'closed' && x.project === s.project) ? moveTo : null;
  let done = 0, moved = 0;
  for (const i of bd.issues.filter((x) => x.sprint === s.id)) {
    if (i.status === 'done') done++;
    else { updateIssue(bd, i, 'sprint', target, by, now); moved++; }
  }
  s.state = 'closed';
  return { done, moved };
}

export function sprintPoints(bd: Board, sprintId: string | null, project?: string): { total: number; done: number; count: number } {
  const list = bd.issues.filter((i) => i.sprint === sprintId && i.type !== 'epic' && (!project || i.project === project));
  const sum = (xs: Issue[]): number => xs.reduce((a, i) => a + (i.points ?? 0), 0);
  return { total: sum(list), done: sum(list.filter((i) => i.status === 'done')), count: list.length };
}

/* ---------- filters ---------- */
export interface IssueFilter { project: string | 'all'; text: string; assignee: Actor | 'none' | 'any'; type: IssueType | 'any'; priority: IssuePriority | 'any' }
export const NO_FILTER: IssueFilter = { project: 'all', text: '', assignee: 'any', type: 'any', priority: 'any' };

export function matches(i: Issue, f: IssueFilter): boolean {
  if (f.project !== 'all' && i.project !== f.project) return false;
  if (f.assignee === 'none' ? i.assignee !== null : f.assignee !== 'any' && i.assignee !== f.assignee) return false;
  if (f.type !== 'any' && i.type !== f.type) return false;
  if (f.priority !== 'any' && i.priority !== f.priority) return false;
  const q = f.text.trim().toLowerCase();
  if (q && !`${i.key} ${i.title} ${i.description} ${i.labels.join(' ')}`.toLowerCase().includes(q)) return false;
  return true;
}

/* ---------- AI activity ---------- */
/** Record a day plan the AI made, as a done task assigned to the AI in Personal, so its decisions stay traceable. */
export function logAiPlan(bd: Board, date: string, blocks: { time: string; text: string }[], note: string, now = Date.now()): Issue {
  const issue = createIssue(bd, {
    project: 'PER',
    type: 'task',
    title: `Day plan for ${date}`,
    description: [note, ...blocks.map((b) => `${b.time}  ${b.text}`)].filter(Boolean).join('\n'),
    assignee: 'ai',
    labels: ['ai-plan'],
    status: 'done',
    priority: 'low'
  }, 'ai', now);
  issue.history[0].to = `${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'} added to the day`;
  return issue;
}
