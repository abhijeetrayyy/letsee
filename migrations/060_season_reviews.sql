-- 060_season_reviews.sql
-- A review anchored to a season.
--
-- There are already two places to write about TV and neither fits how people
-- actually talk about it. `watched_items.review_text` covers a whole series,
-- which is useless for anything long-running — nobody has one opinion about
-- twelve years of a show. `episode_ratings.note` covers a single episode,
-- which is too fine for everything except a standout hour.
--
-- The season is the unit people argue about: "season 4 is where it turns",
-- "the second season is the only good one". Nobody does this well, which is
-- part of why it's worth doing.
--
-- Mirrors the diary/public split from 009 rather than inventing a new one:
--   review_text        private, yours
--   public_review_text shown on the season page to anyone allowed to see it
--
-- score is nullable because a season review without a rating is a legitimate
-- thing to write, and forcing a number would make people invent one.

begin;

create table if not exists public.season_reviews (
  user_id            uuid not null references public.users(id) on delete cascade,
  show_id            text not null,
  season_number      integer not null check (season_number >= 0),
  score              smallint check (score between 1 and 10),
  review_text        text,
  public_review_text text,
  show_name          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (user_id, show_id, season_number)
);

create index if not exists season_reviews_show_idx
  on public.season_reviews (show_id, season_number);

create trigger set_season_reviews_updated_at
before update on public.season_reviews
for each row
execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.season_reviews enable row level security;

drop policy if exists "season_reviews_self" on public.season_reviews;
create policy "season_reviews_self"
  on public.season_reviews
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public reviews follow the same gate as everything else cross-user, so a
-- private profile's season reviews stay private. Note this exposes the whole
-- row to a permitted viewer, including review_text — so the API must select
-- only public_review_text for anyone who isn't the author. Same shape as the
-- watched_items policy from 009, and the same caveat.
drop policy if exists "season_reviews_public_read" on public.season_reviews;
create policy "season_reviews_public_read"
  on public.season_reviews
  for select
  using (
    public_review_text is not null
    and public.profile_visible_to_viewer(user_id)
  );

commit;
