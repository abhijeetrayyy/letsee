-- Episode-level TV tracking: which episodes a user has watched
-- Used for "Mark episode watched" and "Continue watching"

begin;

create table if not exists public.watched_episodes (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  show_id text not null,
  season_number smallint not null check (season_number >= 0),
  episode_number smallint not null check (episode_number >= 1),
  watched_at timestamptz not null default now(),
  unique (user_id, show_id, season_number, episode_number)
);

create index if not exists watched_episodes_user_id_idx on public.watched_episodes (user_id);
create index if not exists watched_episodes_show_id_idx on public.watched_episodes (show_id);
create index if not exists watched_episodes_user_show_idx on public.watched_episodes (user_id, show_id);

alter table public.watched_episodes enable row level security;

create policy "watched_episodes_self" on public.watched_episodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
