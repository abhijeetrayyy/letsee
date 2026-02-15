-- Migration 020: Currently Watching table
-- Allows users to mark movies/TV shows as "currently watching" (in-progress).

-- 1. Create currently_watching table
create table if not exists public.currently_watching (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  image_url text,
  item_adult boolean not null default false,
  genres text[],
  started_at timestamptz not null default now(),
  unique (user_id, item_id)
);

-- 2. Indexes
create index if not exists currently_watching_user_id_idx on public.currently_watching (user_id);
create index if not exists currently_watching_item_id_idx on public.currently_watching (item_id, item_type);

-- 3. Add watching_count to user_cout_stats
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cout_stats' and column_name = 'watching_count'
  ) then
    alter table public.user_cout_stats add column watching_count integer not null default 0;
  end if;
end $$;

-- 4. Increment / decrement helpers
create or replace function public.increment_watching_count(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watching_count = watching_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.decrement_watching_count(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watching_count = greatest(watching_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- 5. RLS
alter table public.currently_watching enable row level security;

create policy "currently_watching_self" on public.currently_watching
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "currently_watching_select_profile_visible" on public.currently_watching
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
