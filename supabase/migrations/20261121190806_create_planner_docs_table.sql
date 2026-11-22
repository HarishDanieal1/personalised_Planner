-- Planner stores each part of a user's planner (settings, board, one document
-- per day, week and month, trackers, reset log) as one JSON document.
-- Row-level security makes every row visible only to the user who owns it.

create table if not exists public.planner_docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key        text        not null check (key ~ '^[a-z0-9:-]{1,64}$'),
  data       jsonb       not null check (pg_column_size(data) <= 262144),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.planner_docs enable row level security;

create policy "Users read their own documents" on public.planner_docs
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own documents" on public.planner_docs
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users change their own documents" on public.planner_docs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users remove their own documents" on public.planner_docs
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.planner_docs from anon;
grant select, insert, update, delete on public.planner_docs to authenticated;
