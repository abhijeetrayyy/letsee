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
  unique (user_id, item_id)
);

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

-- Indexes
create index if not exists watched_items_user_id_idx on public.watched_items (user_id);
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

-- Media tables
create policy "watched_items_self" on public.watched_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorite_items_self" on public.favorite_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_watchlist_self" on public.user_watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

commit;
