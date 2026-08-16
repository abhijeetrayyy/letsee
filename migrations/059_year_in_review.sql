-- 059_year_in_review.sql
-- Per-year sharing opt-in.
--
-- Year in Review only earns its keep if people post it, and they can't post
-- what a stranger can't open. But a followers-only profile is followers-only
-- for a reason, so "make my whole account public to share one card" is not an
-- acceptable price.
--
-- Hence a row per (user, year): the user publishes one year's summary without
-- touching users.visibility or exposing the diary behind it. The page reads
-- through the admin client *after* checking this flag — the one narrow place
-- where bypassing profile_visible_to_viewer is the user's own explicit choice
-- rather than a leak.
--
-- Default false. Nothing becomes public until someone presses the button.

begin;

create table if not exists public.year_reviews (
  user_id    uuid    not null references public.users(id) on delete cascade,
  year       integer not null check (year between 1900 and 2200),
  is_public  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, year)
);

create index if not exists year_reviews_public_idx
  on public.year_reviews (year) where is_public;

alter table public.year_reviews enable row level security;

drop policy if exists "year_reviews_self" on public.year_reviews;
create policy "year_reviews_self"
  on public.year_reviews
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Anyone may read the flag itself — that is the entire point of the flag, and
-- it carries no data beyond "this person published this year".
drop policy if exists "year_reviews_public_read" on public.year_reviews;
create policy "year_reviews_public_read"
  on public.year_reviews
  for select
  using (is_public);

commit;
