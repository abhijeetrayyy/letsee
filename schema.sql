-- App database schema for letsee (Supabase/Postgres)
-- Note: Supabase-managed schemas (auth, storage, realtime, vault) are not defined here.

begin;

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'visibility_level') then
    create type public.visibility_level as enum ('public', 'followers', 'private');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_type') then
    create type public.message_type as enum ('text', 'cardmix');
  end if;
  if not exists (select 1 from pg_type where typname = 'follow_request_status') then
    create type public.follow_request_status as enum ('pending', 'accepted', 'rejected');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Users profile table (linked to auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text unique,
  about text,
  visibility public.visibility_level not null default 'public',
  profile_show_diary boolean not null default true,
  profile_show_ratings boolean not null default true,
  profile_show_public_reviews boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Aggregate counters used in HomeDiscover/profile sorting
create table if not exists public.user_cout_stats (
  user_id uuid primary key references public.users(id) on delete cascade,
  watched_count integer not null default 0,
  favorites_count integer not null default 0,
  watchlist_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create trigger set_user_cout_stats_updated_at
before update on public.user_cout_stats
for each row
execute function public.set_updated_at();

create or replace function public.ensure_user_cout_stats()
returns trigger
language plpgsql
as $$
begin
  insert into public.user_cout_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger create_user_cout_stats
after insert on public.users
for each row
execute function public.ensure_user_cout_stats();

-- Media interaction tables
create table if not exists public.watched_items (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  image_url text,
  item_adult boolean not null default false,
  genres text[],
  watched_at timestamptz not null default now(),
  review_text text,
  is_watched boolean not null default true,
  unique (user_id, item_id)
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'watched_items' and column_name = 'review_text'
  ) then
    alter table public.watched_items add column review_text text;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'watched_items' and column_name = 'public_review_text'
  ) then
    alter table public.watched_items add column public_review_text text;
  end if;
end $$;

create table if not exists public.favorite_items (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  image_url text,
  item_adult boolean not null default false,
  genres text[],
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.user_watchlist (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  image_url text,
  item_adult boolean not null default false,
  genres text[],
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

-- User ratings (1-10 per movie/TV)
create table if not exists public.user_ratings (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  score smallint not null check (score >= 1 and score <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create trigger set_user_ratings_updated_at
before update on public.user_ratings
for each row
execute function public.set_updated_at();

create index if not exists user_ratings_user_id_idx on public.user_ratings (user_id);

-- Direct messages between users
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  message_type public.message_type not null default 'text',
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Followers
create table if not exists public.user_connections (
  id bigserial primary key,
  follower_id uuid not null references public.users(id) on delete cascade,
  followed_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);

-- Follow requests
create table if not exists public.user_follow_requests (
  id bigserial primary key,
  sender_id uuid not null references public.users(id) on delete cascade,
  receiver_id uuid not null references public.users(id) on delete cascade,
  status public.follow_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

-- Recommendations created by user action
create table if not exists public.recommendation (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null,
  name text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  image text,
  adult boolean not null default false,
  recommended_at timestamptz not null default now()
);

-- Custom lists (user-created named lists)
create table if not exists public.user_lists (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  visibility public.visibility_level not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_user_lists_updated_at
before update on public.user_lists
for each row
execute function public.set_updated_at();

create table if not exists public.user_list_items (
  id bigserial primary key,
  list_id bigint not null references public.user_lists(id) on delete cascade,
  item_id text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  item_name text not null,
  image_url text,
  item_adult boolean not null default false,
  genres text[],
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, item_id)
);

create index if not exists user_lists_user_id_idx on public.user_lists (user_id);
create index if not exists user_list_items_list_id_idx on public.user_list_items (list_id);

-- Profile hero / Taste in 4 (migration 011): users columns + user_favorite_display
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'avatar_url') then
    alter table public.users add column avatar_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'banner_url') then
    alter table public.users add column banner_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'tagline') then
    alter table public.users add column tagline text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'featured_list_id') then
    alter table public.users add column featured_list_id bigint references public.user_lists(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'pinned_review_id') then
    alter table public.users add column pinned_review_id bigint;
    comment on column public.users.pinned_review_id is 'watched_items.id; app must ensure it belongs to this user';
  end if;
end $$;

create table if not exists public.user_favorite_display (
  user_id uuid not null references public.users(id) on delete cascade,
  position smallint not null check (position >= 1 and position <= 4),
  item_id text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  image_url text,
  item_name text not null,
  primary key (user_id, position)
);
create index if not exists user_favorite_display_user_id_idx on public.user_favorite_display (user_id);

-- Episode-level TV tracking (for "Mark episode watched" and "Continue watching")
create table if not exists public.watched_episodes (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  show_id text not null,
  season_number smallint not null check (season_number >= 0),
  episode_number smallint not null check (episode_number >= 1),
  watched_at timestamptz not null default now(),
  unique (user_id, show_id, season_number, episode_number)
);

-- Indexes
create index if not exists watched_episodes_user_id_idx on public.watched_episodes (user_id);
create index if not exists watched_episodes_show_id_idx on public.watched_episodes (show_id);
create index if not exists watched_episodes_user_show_idx on public.watched_episodes (user_id, show_id);

-- TV list status (migration 021): users.default_tv_status + user_tv_list (Watching / Completed / On hold / Dropped / Plan to watch)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'default_tv_status') then
    alter table public.users add column default_tv_status text not null default 'watching'
      check (default_tv_status in ('watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'));
  end if;
end $$;
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
create policy "user_tv_list_self" on public.user_tv_list for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_tv_list_select_profile_visible" on public.user_tv_list for select using (public.profile_visible_to_viewer(user_id));

create index if not exists watched_items_user_id_idx on public.watched_items (user_id);
create index if not exists watched_items_item_id_item_type_idx on public.watched_items (item_id, item_type);
create index if not exists favorite_items_user_id_idx on public.favorite_items (user_id);
create index if not exists user_watchlist_user_id_idx on public.user_watchlist (user_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_recipient_id_idx on public.messages (recipient_id);
create index if not exists messages_is_read_idx on public.messages (is_read);
create index if not exists user_connections_follower_id_idx on public.user_connections (follower_id);
create index if not exists user_connections_followed_id_idx on public.user_connections (followed_id);
create index if not exists user_follow_requests_sender_id_idx on public.user_follow_requests (sender_id);
create index if not exists user_follow_requests_receiver_id_idx on public.user_follow_requests (receiver_id);
create index if not exists recommendation_user_id_idx on public.recommendation (user_id);

-- RPC helpers for count stats
create or replace function public.increment_watchlist_count(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watchlist_count = watchlist_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.decrement_watchlist_count(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watchlist_count = greatest(watchlist_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.increment_watched_count(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watched_count = watched_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.decrement_watched_count(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watched_count = greatest(watched_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.increment_favorites_count(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set favorites_count = favorites_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.decrement_favorites_count(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set favorites_count = greatest(favorites_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- Backfill watched_episodes for users who had TV in watched_items before episode tracking
create or replace function public.backfill_watched_episodes_for_show(
  p_user_id uuid,
  p_show_id text,
  p_episodes jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  ep jsonb;
  inserted integer := 0;
  s smallint;
  e smallint;
begin
  if p_episodes is null or jsonb_array_length(p_episodes) = 0 then
    return 0;
  end if;
  for ep in select * from jsonb_array_elements(p_episodes)
  loop
    s := (ep->>'season_number')::smallint;
    e := (ep->>'episode_number')::smallint;
    if s is not null and e is not null and s >= 0 and e >= 1 then
      insert into public.watched_episodes (user_id, show_id, season_number, episode_number)
      values (p_user_id, p_show_id, s, e)
      on conflict (user_id, show_id, season_number, episode_number) do nothing;
      inserted := inserted + 1;
    end if;
  end loop;
  return inserted;
end;
$$;

-- RLS policies
alter table public.users enable row level security;
alter table public.user_cout_stats enable row level security;
alter table public.watched_items enable row level security;
alter table public.favorite_items enable row level security;
alter table public.user_watchlist enable row level security;
alter table public.messages enable row level security;
alter table public.user_connections enable row level security;
alter table public.user_follow_requests enable row level security;
alter table public.recommendation enable row level security;
alter table public.user_ratings enable row level security;
alter table public.user_lists enable row level security;
alter table public.user_list_items enable row level security;
alter table public.user_favorite_display enable row level security;
alter table public.watched_episodes enable row level security;

-- Users
create policy "users_select_public" on public.users
  for select using (true);
create policy "users_insert_self" on public.users
  for insert with check (auth.uid() = id);
create policy "users_update_self" on public.users
  for update using (auth.uid() = id);

-- User counts
create policy "user_cout_stats_select_public" on public.user_cout_stats
  for select using (true);
create policy "user_cout_stats_modify_self" on public.user_cout_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helper: true when the profile owner allows the current viewer to see their content (public or followers + follow).
-- Visibility compared case-insensitively; null treated as public so public profiles always show.
create or replace function public.profile_visible_to_viewer(owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = owner_user_id
    and (
      (u.visibility is null or lower(trim(u.visibility::text)) = 'public')
      or (
        auth.uid() is not null
        and lower(trim(u.visibility::text)) = 'followers'
        and exists (
          select 1 from public.user_connections c
          where c.followed_id = u.id and c.follower_id = auth.uid()
        )
      )
    )
  );
$$;
grant execute on function public.profile_visible_to_viewer(uuid) to anon;
grant execute on function public.profile_visible_to_viewer(uuid) to authenticated;

-- Media tables
create policy "watched_items_self" on public.watched_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Public reviews: anyone can read rows that have public_review_text set (diary = review_text is private)
create policy "watched_items_select_public_reviews" on public.watched_items
  for select using (public_review_text is not null);
create policy "watched_items_select_profile_visible" on public.watched_items
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
create policy "favorite_items_self" on public.favorite_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorite_items_select_profile_visible" on public.favorite_items
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
create policy "user_watchlist_self" on public.user_watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_watchlist_select_profile_visible" on public.user_watchlist
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- Messages
create policy "messages_select_participants" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "messages_insert_sender" on public.messages
  for insert with check (auth.uid() = sender_id);
create policy "messages_update_recipient" on public.messages
  for update using (auth.uid() = recipient_id);
create policy "messages_delete_participants" on public.messages
  for delete using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Connections
create policy "user_connections_select_public" on public.user_connections
  for select using (true);
create policy "user_connections_insert_self" on public.user_connections
  for insert with check (auth.uid() = follower_id);
create policy "user_connections_delete_self" on public.user_connections
  for delete using (auth.uid() = follower_id);

-- Follow requests
create policy "user_follow_requests_select_participants" on public.user_follow_requests
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "user_follow_requests_insert_sender" on public.user_follow_requests
  for insert with check (auth.uid() = sender_id);
create policy "user_follow_requests_update_receiver" on public.user_follow_requests
  for update using (auth.uid() = receiver_id);
create policy "user_follow_requests_delete_participants" on public.user_follow_requests
  for delete using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Recommendations
create policy "recommendation_self" on public.recommendation
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recommendation_select_profile_visible" on public.recommendation
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- User ratings
create policy "user_ratings_self" on public.user_ratings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_ratings_select_profile_visible" on public.user_ratings
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- Custom lists: full access for owner; select for others based on list visibility
create policy "user_lists_select_own" on public.user_lists
  for select using (auth.uid() = user_id);
create policy "user_lists_select_public" on public.user_lists
  for select using (visibility = 'public');
create policy "user_lists_select_followers" on public.user_lists
  for select using (
    visibility = 'followers'
    and user_id in (select followed_id from public.user_connections where follower_id = auth.uid())
  );
create policy "user_lists_insert_self" on public.user_lists
  for insert with check (auth.uid() = user_id);
create policy "user_lists_update_self" on public.user_lists
  for update using (auth.uid() = user_id);
create policy "user_lists_delete_self" on public.user_lists
  for delete using (auth.uid() = user_id);

-- List items: access follows list ownership/visibility (select via list; modify only owner)
create policy "user_list_items_select" on public.user_list_items
  for select using (
    exists (
      select 1 from public.user_lists l
      where l.id = list_id
      and (
        l.user_id = auth.uid()
        or l.visibility = 'public'
        or (l.visibility = 'followers' and l.user_id in (select followed_id from public.user_connections where follower_id = auth.uid()))
      )
    )
  );
create policy "user_list_items_insert_owner" on public.user_list_items
  for insert with check (
    exists (select 1 from public.user_lists l where l.id = list_id and l.user_id = auth.uid())
  );
create policy "user_list_items_update_owner" on public.user_list_items
  for update using (
    exists (select 1 from public.user_lists l where l.id = list_id and l.user_id = auth.uid())
  );
create policy "user_list_items_delete_owner" on public.user_list_items
  for delete using (
    exists (select 1 from public.user_lists l where l.id = list_id and l.user_id = auth.uid())
  );

-- Taste in 4 (user_favorite_display): anyone can read; only owner can modify
create policy "user_favorite_display_select" on public.user_favorite_display
  for select using (true);
create policy "user_favorite_display_insert_self" on public.user_favorite_display
  for insert with check (auth.uid() = user_id);
create policy "user_favorite_display_update_self" on public.user_favorite_display
  for update using (auth.uid() = user_id);
create policy "user_favorite_display_delete_self" on public.user_favorite_display
  for delete using (auth.uid() = user_id);

-- Watched episodes (TV): user can modify own rows; anyone can read (for profile progress)
create policy "watched_episodes_self" on public.watched_episodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watched_episodes_select_public" on public.watched_episodes
  for select using (true);

commit;
