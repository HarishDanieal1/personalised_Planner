// Local-first document store. Every part of the planner is one JSON document kept
// in localStorage; the sync module mirrors changed documents to Supabase.
import { defaultFor } from './defaults';

const DOC = 'planner:doc:';
const STAMP = 'planner:stamp:';
type Listener = (key: string) => void;

function readJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

class DocumentStore {
  private cache = new Map<string, object>();
  private listeners = new Set<Listener>();
  /** Set by the sync module: called after each local save. */
  onLocalSave: ((key: string) => void) | null = null;

  get<T extends object>(key: string): T {
    let doc = this.cache.get(key);
    if (!doc) {
      const saved = readJson(localStorage.getItem(DOC + key));
      doc = Object.assign(defaultFor(key), saved && typeof saved === 'object' ? saved : {});
      this.cache.set(key, doc);
    }
    return doc as T;
  }

  /** Persist a document after changing it in place. */
  save(key: string): void {
    const doc = this.cache.get(key);
    if (!doc) return;
    const stamp = Date.now();
    this.write(key, doc, stamp);
    this.emit(key);
    this.onLocalSave?.(key);
  }

  /** Replace a document with a newer copy from the cloud. */
  replace(key: string, data: object, stamp: number): void {
    const doc = Object.assign(defaultFor(key), data);
    this.cache.set(key, doc);
    this.write(key, doc, stamp);
    this.emit(key);
  }

  /** When the document last changed on this device, in ms; 0 if never saved. */
  stamp(key: string): number {
    return Number(localStorage.getItem(STAMP + key)) || 0;
  }

  /** Keys of every document saved on this device. */
  keys(): string[] {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(DOC)) out.push(k.slice(DOC.length));
    }
    return out.sort();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private write(key: string, doc: object, stamp: number): void {
    try {
      localStorage.setItem(DOC + key, JSON.stringify(doc));
      localStorage.setItem(STAMP + key, String(stamp));
    } catch {
      /* storage full or blocked: the in-memory copy still works for this visit */
    }
  }

  private emit(key: string): void {
    for (const fn of this.listeners) fn(key);
  }
}

export const store = new DocumentStore();

export const dayKey = (date: string): string => `day:${date}`;
export const weekKey = (monday: string): string => `week:${monday}`;
export const monthKey = (yyyyMm: string): string => `month:${yyyyMm}`;
