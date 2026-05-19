begin;

create table if not exists public.reactions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('review', 'watched', 'rating', 'list', 'comment', 'activity')),
  target_id bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists reactions_target_idx on public.reactions (target_type, target_id);
create index if not exists reactions_user_idx on public.reactions (user_id);
create index if not exists reactions_target_count_idx on public.reactions (target_type, target_id, user_id);

alter table public.reactions enable row level security;

-- RLS: anyone can read reactions
create policy "reactions_select_all" on public.reactions
  for select using (true);

-- RLS: users can insert their own reactions
create policy "reactions_insert_self" on public.reactions
  for insert with check (auth.uid() = user_id);

-- RLS: users can delete their own reactions
create policy "reactions_delete_self" on public.reactions
  for delete using (auth.uid() = user_id);

commit;
