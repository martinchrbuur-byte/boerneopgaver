create table if not exists public.checklists (
  id text primary key,
  user_id text not null references auth.users(id) on delete cascade,
  date_iso date not null,
  items jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, date_iso)
);

alter table public.checklists enable row level security;
create policy "checklists_select_own" on public.checklists for select using (auth.uid()::text = user_id);
create policy "checklists_insert_own" on public.checklists for insert with check (auth.uid()::text = user_id);
create policy "checklists_update_own" on public.checklists for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "checklists_delete_own" on public.checklists for delete using (auth.uid()::text = user_id);
