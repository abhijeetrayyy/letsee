-- TV list status (Watching / Completed / On Hold / Dropped / Plan to Watch) per user per show.
-- Used on profile TV section, TV detail page, and when adding TV to watched (default status).

-- User preference: default status when adding a TV show to watched
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'default_tv_status'
  ) then
    alter table public.users add column default_tv_status text not null default 'watching'
      check (default_tv_status in ('watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'));
  end if;
end $$;

-- Per-show TV list status (MAL/AniList style)
create table if not exists public.user_tv_list (
  user_id uuid not null references public.users(id) on delete cascade,
  show_id text not null,
  status text not null check (status in ('watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch')),
  updated_at timestamptz not null default now(),
  primary key (user_id, show_id)
);

create index if not exists user_tv_list_user_id_idx on public.user_tv_list (user_id);
create index if not exists user_tv_list_show_id_idx on public.user_tv_list (show_id);

alter table public.user_tv_list enable row level security;

create policy "user_tv_list_self" on public.user_tv_list
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Profile visibility: allow reading other users' TV list status when profile is visible (for profile TV section)
create policy "user_tv_list_select_profile_visible" on public.user_tv_list
  for select using (public.profile_visible_to_viewer(user_id));
