// Mirrors locally saved documents to the planner_docs table in Supabase and pulls
// newer copies from other devices. The newest change wins, per document.
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { store } from './store';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export type SyncStatus = 'not-configured' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';
export interface SyncState { status: SyncStatus; email: string | null; message: string }

const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

let session: Session | null = null;
const state: SyncState = { status: supabase ? 'signed-out' : 'not-configured', email: null, message: '' };
const listeners = new Set<(s: SyncState) => void>();
const timers = new Map<string, number>();
const busy = new Set<string>();
const again = new Set<string>();

function set(patch: Partial<SyncState>): void {
  Object.assign(state, patch);
  for (const fn of listeners) fn({ ...state });
}
export const syncState = (): SyncState => ({ ...state });
export const onSyncChange = (fn: (s: SyncState) => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const cloudConfigured = (): boolean => supabase !== null;

async function push(key: string): Promise<void> {
  if (!supabase || !session) return;
  if (busy.has(key)) { again.add(key); return; }
  busy.add(key);
  set({ status: 'syncing' });
  const { error } = await supabase.from('planner_docs').upsert(
    { user_id: session.user.id, key, data: store.get(key), updated_at: new Date(store.stamp(key)).toISOString() },
    { onConflict: 'user_id,key' }
  );
  busy.delete(key);
  if (error) set({ status: navigator.onLine ? 'error' : 'offline', message: error.message });
  else if (!busy.size) set({ status: 'synced', message: '' });
  if (again.delete(key)) void push(key);
}

function schedule(key: string): void {
  if (!session) return;
  window.clearTimeout(timers.get(key));
  timers.set(key, window.setTimeout(() => void push(key), 800));
}

/** Pull every document for this user; keep whichever copy changed last. Returns true if anything local changed. */
export async function pullAll(): Promise<boolean> {
  if (!supabase || !session) return false;
  set({ status: 'syncing' });
  const { data, error } = await supabase.from('planner_docs').select('key, data, updated_at');
  if (error) { set({ status: navigator.onLine ? 'error' : 'offline', message: error.message }); return false; }
  let changed = false;
  const remote = new Map<string, number>();
  for (const row of data ?? []) {
    const stamp = Date.parse(row.updated_at as string);
    remote.set(row.key as string, stamp);
    if (stamp > store.stamp(row.key as string)) { store.replace(row.key as string, row.data as object, stamp); changed = true; }
  }
  for (const key of store.keys()) {
    const local = store.stamp(key);
    if (local > (remote.get(key) ?? 0)) await push(key);
  }
  set({ status: 'synced', message: '' });
  return changed;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Cloud sync is not set up for this copy of Planner.';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}
export async function signUp(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Cloud sync is not set up for this copy of Planner.';
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
  if (error) return error.message;
  return data.session ? null : 'check-email';
}
export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Start listening for sign-in changes. `onPulled` runs when cloud data replaced local data. */
export function startSync(onPulled: () => void): void {
  store.onLocalSave = schedule;
  if (!supabase) return;
  supabase.auth.onAuthStateChange((_event, s) => {
    const wasSignedIn = Boolean(session);
    session = s;
    if (!s) { set({ status: 'signed-out', email: null }); return; }
    set({ email: s.user.email ?? null });
    if (!wasSignedIn) void pullAll().then((changed) => { if (changed) onPulled(); });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session) void pullAll().then((changed) => { if (changed) onPulled(); });
  });
  window.addEventListener('online', () => { if (session) void pullAll().then((c) => { if (c) onPulled(); }); });
}
