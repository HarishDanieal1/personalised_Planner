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
export type Column = 'backlog' | 'todo' | 'doing' | 'done';
export interface Card { id: string; title: string; col: Column; tag: string; est: number; notes: string }
export interface Board { cards: Card[] }
export interface Urge { t: number; tr: string[]; out: 'rode' | 'slip'; swap: string | null }
export interface Reset { streakStart: string | null; best: number; slips: string[]; urges: Urge[] }
