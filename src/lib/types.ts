export interface Habit { id: string; name: string }
/** `slot` is the tracker's fixed position (1-8) in the chart colour palette. */
export interface Tracker { id: string; name: string; kind: 'target' | 'limit'; goal: number; slot: number }
export interface RunningTimer { tid: string; start: number; date: string }
export interface Settings {
  dayStart: number;
  dayEnd: number;
  habits: Habit[];
  trackers: Tracker[];
  running: RunningTimer | null;
}
export interface Priority { text: string; done: boolean }
export interface DumpItem { id: string; text: string; done: boolean; blocked?: boolean }
export interface Block { id: string; start: number; dur: number; text: string; done: boolean; tracker: string | null }
export interface Day {
  priorities: Priority[];
  dump: DumpItem[];
  blocks: Block[];
  time: Record<string, number>;
  habits: Record<string, boolean>;
}
export interface MatrixItem { id: string; text: string; done: boolean }
export type Quadrant = 'q1' | 'q2' | 'q3' | 'q4';
export interface Week { notes: string; matrix: Record<Quadrant, MatrixItem[]>; selfCare: string }
export interface Goal { text: string; done: boolean }
export interface Month { theme: string; goals: Goal[]; cells: Record<string, string> }
export interface Year { theme: string; goals: Goal[] }

/** v0.0.2 board card, kept so older saved boards can be migrated. */
export type Column = 'backlog' | 'todo' | 'doing' | 'done';
export interface Card { id: string; title: string; col: Column; tag: string; est: number; notes: string }

/* ---------- board (Jira-style) ---------- */
export type Actor = 'me' | 'ai';
export type IssueType = 'epic' | 'story' | 'task' | 'bug';
export type IssuePriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';
export type IssueStatus = 'todo' | 'doing' | 'review' | 'done';
export interface Project { key: string; name: string; kind: 'personal' | 'work'; next: number }
export interface Sprint { id: string; project: string; name: string; goal: string; start: string; end: string; state: 'planned' | 'active' | 'closed' }
export interface IssueComment { id: string; by: Actor; at: number; text: string }
export interface IssueChange { at: number; by: Actor; field: string; from: string; to: string }
export interface Issue {
  id: string;
  key: string;              // e.g. "WORK-12"
  project: string;          // project key
  type: IssueType;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  points: number | null;
  assignee: Actor | null;
  sprint: string | null;    // null means the backlog
  epic: string | null;      // id of an epic in the same project
  labels: string[];
  created: number;
  updated: number;
  comments: IssueComment[];
  history: IssueChange[];
}
/** `cards` holds v0.0.2 cards untouched; `cardsMigrated` marks that they were copied into issues. */
export interface Board { projects: Project[]; sprints: Sprint[]; issues: Issue[]; cards: Card[]; cardsMigrated?: boolean }
export interface Urge { t: number; tr: string[]; out: 'rode' | 'slip'; swap: string | null }
export interface Reset { streakStart: string | null; best: number; slips: string[]; urges: Urge[] }
