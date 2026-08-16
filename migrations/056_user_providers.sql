-- 056_user_providers.sql
-- Which services a user actually has, and where.
--
-- Tonight's whole premise is that the answer is watchable *right now*, which
-- means the availability gate is a hard filter, not a ranking signal. Without
-- this table the engine recommends titles nobody in the room can play, and a
-- recommendation you can't act on is worse than none — it costs the same
-- attention and returns nothing.
--
-- provider_id is TMDB's. Those ids are stable; the names are not guaranteed to
-- be (providers rebrand — HBO Max → Max → HBO Max), so the name is stored
-- denormalised purely for display and is refreshed opportunistically whenever
-- the user re-saves. Never join on it.
--
-- Region lives on `users` rather than here because it is a property of the
-- person, not of one service: TMDB availability is queried per region, and a
-- user in IN and a user in US will get different answers for the same
-- provider_id. Defaulting to 'US' matches /api/watch-providers, which has
-- always used US as its fallback.

begin;

create table if not exists public.user_providers (
  user_id       uuid    not null references public.users(id) on delete cascade,
  provider_id   integer not null,
  provider_name text    not null default '',
  created_at    timestamptz not null default now(),
  primary key (user_id, provider_id)
);

create index if not exists user_providers_user_idx
  on public.user_providers (user_id);

alter table public.users
  add column if not exists watch_region text not null default 'US';

comment on column public.users.watch_region is
  'ISO 3166-1 alpha-2. Which country''s streaming availability applies to this user.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.user_providers enable row level security;

drop policy if exists "user_providers_self" on public.user_providers;
create policy "user_providers_self"
  on public.user_providers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A group session has to read the other participants' services to compute the
-- union. profile_visible_to_viewer is the same gate every other cross-user
-- read in this schema uses (018), so a private profile stays private here too:
-- their services simply don't contribute to the union, and the resolver treats
-- that participant as "any provider" rather than failing.
drop policy if exists "user_providers_select_profile_visible" on public.user_providers;
create policy "user_providers_select_profile_visible"
  on public.user_providers
  for select
  using (public.profile_visible_to_viewer(user_id));

commit;
