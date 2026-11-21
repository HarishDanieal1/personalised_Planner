import { describe, expect, it } from 'vitest';
import {
  activeSprint, addComment, completeSprint, createIssue, createSprint, deleteIssue, emptyBoard,
  logAiPlan, matches, NO_FILTER, sprintPoints, startSprint, updateIssue, upgradeBoard
} from '../../src/lib/board';
import { scoreLevel } from '../../src/lib/planner';
import { defaultFor } from '../../src/lib/defaults';
import type { Board } from '../../src/lib/types';

const T = new Date(2026, 10, 21, 9, 0).getTime();

describe('issues', () => {
  it('numbers issues per project and logs who created them', () => {
    const bd = emptyBoard();
    const a = createIssue(bd, { project: 'WORK', title: 'Write report' }, 'me', T);
    const b = createIssue(bd, { project: 'WORK', title: 'Review PR' }, 'ai', T);
    const c = createIssue(bd, { project: 'PER', title: 'Gym' }, 'me', T);
    expect([a.key, b.key, c.key]).toEqual(['WORK-1', 'WORK-2', 'PER-1']);
    expect(b.history[0]).toMatchObject({ by: 'ai', field: 'created' });
    expect(a).toMatchObject({ type: 'task', status: 'todo', priority: 'medium', sprint: null, assignee: null });
  });

  it('logs each change with readable values, and skips no-op changes', () => {
    const bd = emptyBoard();
    const i = createIssue(bd, { project: 'PER', title: 'Read' }, 'me', T);
    expect(updateIssue(bd, i, 'status', 'doing', 'ai', T + 1)).toBe(true);
    expect(updateIssue(bd, i, 'status', 'doing', 'ai', T + 2)).toBe(false);
    updateIssue(bd, i, 'assignee', 'ai', 'me', T + 3);
    expect(i.history.slice(1)).toEqual([
      { at: T + 1, by: 'ai', field: 'status', from: 'To do', to: 'In progress' },
      { at: T + 3, by: 'me', field: 'assignee', from: 'None', to: 'AI' }
    ]);
    expect(i.updated).toBe(T + 3);
  });

  it('ignores empty comments and trims long ones', () => {
    const bd = emptyBoard();
    const i = createIssue(bd, { project: 'PER', title: 'x' }, 'me', T);
    addComment(i, '   ', 'me', T);
    addComment(i, 'a'.repeat(3000), 'ai', T);
    expect(i.comments).toHaveLength(1);
    expect(i.comments[0].text).toHaveLength(2000);
  });

  it('epics never belong to another epic, and deleting an epic unlinks its issues', () => {
    const bd = emptyBoard();
    const epic = createIssue(bd, { project: 'WORK', title: 'Launch', type: 'epic', epic: 'x' }, 'me', T);
    expect(epic.epic).toBeNull();
    const child = createIssue(bd, { project: 'WORK', title: 'Docs', epic: epic.id }, 'me', T);
    deleteIssue(bd, epic, 'me', T + 5);
    expect(bd.issues).toEqual([child]);
    expect(child.epic).toBeNull();
    expect(child.history.at(-1)).toMatchObject({ field: 'epic', from: 'Launch', to: 'None' });
  });
});

describe('sprints', () => {
  it('allows one active sprint per project', () => {
    const bd = emptyBoard();
    const s1 = createSprint(bd, 'WORK', '2026-11-21');
    const s2 = createSprint(bd, 'WORK', '2026-12-05');
    const p1 = createSprint(bd, 'PER', '2026-11-21');
    expect(s1).toMatchObject({ name: 'WORK Sprint 1', end: '2026-12-04', state: 'planned' });
    expect(s2.name).toBe('WORK Sprint 2');
    expect(startSprint(bd, s1.id, 'me', T)?.state).toBe('active');
    expect(startSprint(bd, s2.id, 'me', T)).toBeNull();
    expect(startSprint(bd, p1.id, 'me', T)?.state).toBe('active');
    expect(activeSprint(bd, 'WORK')).toBe(s1);
  });

  it('completing a sprint moves unfinished issues and logs the move', () => {
    const bd = emptyBoard();
    const s1 = createSprint(bd, 'WORK', '2026-11-21');
    const s2 = createSprint(bd, 'WORK', '2026-12-05');
    startSprint(bd, s1.id, 'me', T);
    const done = createIssue(bd, { project: 'WORK', title: 'a', sprint: s1.id, status: 'done', points: 3 }, 'me', T);
    const open = createIssue(bd, { project: 'WORK', title: 'b', sprint: s1.id, points: 5 }, 'me', T);
    expect(sprintPoints(bd, s1.id)).toEqual({ total: 8, done: 3, count: 2 });
    expect(completeSprint(bd, s1.id, s2.id, 'me', T + 9)).toEqual({ done: 1, moved: 1 });
    expect(s1.state).toBe('closed');
    expect(done.sprint).toBe(s1.id);
    expect(open.sprint).toBe(s2.id);
    expect(open.history.at(-1)).toMatchObject({ field: 'sprint', from: 'WORK Sprint 1', to: 'WORK Sprint 2' });
  });

  it('moves unfinished issues to the backlog when the target is in another project', () => {
    const bd = emptyBoard();
    const s1 = createSprint(bd, 'WORK', '2026-11-21');
    const other = createSprint(bd, 'PER', '2026-11-21');
    startSprint(bd, s1.id, 'me', T);
    const open = createIssue(bd, { project: 'WORK', title: 'b', sprint: s1.id }, 'me', T);
    completeSprint(bd, s1.id, other.id, 'me', T);
    expect(open.sprint).toBeNull();
  });
});

describe('filters', () => {
  it('matches by project, assignee, type, priority and text', () => {
    const bd = emptyBoard();
    const i = createIssue(bd, { project: 'WORK', title: 'Fix login', type: 'bug', priority: 'high', assignee: 'ai', labels: ['auth'] }, 'me', T);
    expect(matches(i, NO_FILTER)).toBe(true);
    expect(matches(i, { ...NO_FILTER, project: 'PER' })).toBe(false);
    expect(matches(i, { ...NO_FILTER, assignee: 'ai', type: 'bug', priority: 'high' })).toBe(true);
    expect(matches(i, { ...NO_FILTER, assignee: 'none' })).toBe(false);
    expect(matches(i, { ...NO_FILTER, text: 'AUTH' })).toBe(true);
    expect(matches(i, { ...NO_FILTER, text: 'work-1' })).toBe(true);
    expect(matches(i, { ...NO_FILTER, text: 'gym' })).toBe(false);
  });
});

describe('upgrading a v0.0.2 board', () => {
  it('copies old cards into issues once and keeps the old cards', () => {
    const bd = defaultFor('board') as Board;
    Object.assign(bd, { cards: [
      { id: '1', title: 'Report', col: 'doing', tag: 'Work', est: 45, notes: 'Due Friday' },
      { id: '2', title: 'Someday idea', col: 'backlog', tag: 'Learning', est: 0, notes: '' },
      { id: '3', title: 'Groceries', col: 'done', tag: '', est: 0, notes: '' }
    ] });
    expect(upgradeBoard(bd, T)).toBe(true);
    expect(bd.cards).toHaveLength(3);
    expect(bd.issues.map((i) => [i.key, i.status, i.sprint === null])).toEqual([['WORK-1', 'doing', false], ['PER-1', 'todo', true], ['PER-2', 'done', false]]);
    expect(bd.issues[0].description).toBe('Due Friday\n\nEstimate: 45 minutes');
    expect(bd.issues[1].labels).toEqual(['Learning']);
    expect(activeSprint(bd, 'WORK')).toBeDefined();
    expect(activeSprint(bd, 'PER')).toBeDefined();
    expect(upgradeBoard(bd, T)).toBe(false);
    expect(bd.issues).toHaveLength(3);
  });
});

describe('AI plans', () => {
  it('records an accepted plan as a done task by the AI', () => {
    const bd = emptyBoard();
    const i = logAiPlan(bd, '2026-11-21', [{ time: '9am to 10am', text: 'Deep work' }], 'Hardest first.', T);
    expect(i).toMatchObject({ key: 'PER-1', assignee: 'ai', status: 'done', labels: ['ai-plan'] });
    expect(i.description).toBe('Hardest first.\n9am to 10am  Deep work');
    expect(i.history[0]).toMatchObject({ by: 'ai', to: '1 block added to the day' });
  });
});

describe('scoreLevel', () => {
  it('shades by quarter, with no plan apart from a low score', () => {
    expect([null, 0, 24, 25, 49, 50, 74, 75, 100].map(scoreLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
