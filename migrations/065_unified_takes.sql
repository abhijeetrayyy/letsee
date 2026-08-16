-- 065_unified_takes.sql
-- One place to say what you thought.
--
-- A user's opinion about a single title can currently live in seven places:
-- user_ratings.score, watched_items.review_text (private),
-- watched_items.public_review_text, season_reviews (score + both texts),
-- episode_ratings (score + note), plus comments and reactions. Three tables
-- with near-identical shapes, three APIs, four components on one page.
--
-- But the scattering is not the root confusion. **review_text and
-- public_review_text are separate columns**, so a user can hold both and the
-- interface has to explain which box is which. Gathering them into one section
-- would not fix that — people would still ask "which one do I type in?"
--
-- So: one text, and visibility is a property of it rather than a second field.
--
-- ── Two design choices came from measuring, not deciding ───────────────────
--
-- 1. `is_public` is part of the uniqueness key, so a private note and a public
--    review can coexist for the same thing. That was not the plan. It changed
--    when the data was checked: exactly one row in this database holds both
--    texts, and they genuinely differ (8 characters against 13). Short enough
--    to look like test data, which is precisely the assumption that loses
--    somebody's writing. Keeping both costs one column in the key and loses
--    nothing — and it is a real habit besides, one Letterboxd supports.
--
-- 2. season_number/episode_number are NOT NULL with a -1 sentinel rather than
--    nullable. Two reasons: a nullable column cannot participate in a plain
--    unique constraint the way PostgREST's `on_conflict` needs (it names
--    columns, and will not match an expression index over coalesce), and 0 is
--    unavailable as the sentinel because season 0 is real — it is specials.
--
-- ── Scope is what makes this compose ───────────────────────────────────────
-- Today season_reviews and episode_ratings cannot see each other or the title,
-- so writing about season 4 leaves no trace anywhere a reader looks. With one
-- table and a scope column, a series page can roll up its seasons.
--
-- ── This migration is additive. Nothing is dropped. ────────────────────────
-- 36 files still read user_ratings and watched_items' text columns. The API
-- that lands with this dual-writes, so every one of those readers keeps
-- working unchanged. Migrating readers, and eventually dropping the legacy
-- columns, are separate decisions for later.

begin;

create table if not exists public.takes (
  user_id        uuid not null references public.users(id) on delete cascade,
  item_id        text not null,
  item_type      text not null check (item_type in ('movie', 'tv')),

  -- What this take is *about*.
  scope          text not null default 'title'
                 check (scope in ('title', 'season', 'episode')),
  -- -1 means "not applicable at this scope". Not 0 — season 0 is specials.
  season_number  integer not null default -1,
  episode_number integer not null default -1,

  score          smallint check (score between 1 and 10),
  body           text,
  /**
   * Governs `body` only.
   *
   * A score's visibility still follows users.profile_show_ratings, exactly as
   * it does today — rating_distribution aggregates scores across everyone, and
   * changing that here would silently alter what the community sees.
   */
  is_public      boolean not null default false,

  watched_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint takes_identity_key
    unique (user_id, item_id, item_type, scope, season_number, episode_number, is_public),

  -- A season take must name its season; an episode take both. A title take
  -- must name neither. Without this the sentinels drift and the key stops
  -- meaning anything.
  constraint takes_scope_shape check (
    (scope = 'title'   and season_number = -1 and episode_number = -1) or
    (scope = 'season'  and season_number >= 0 and episode_number = -1) or
    (scope = 'episode' and season_number >= 0 and episode_number >= 1)
  ),

  -- A row with neither a score nor text is not an opinion.
  constraint takes_not_empty check (score is not null or nullif(btrim(body), '') is not null)
);

create index if not exists takes_user_idx on public.takes (user_id, updated_at desc);
create index if not exists takes_item_idx on public.takes (item_id, item_type, scope);
create index if not exists takes_public_idx
  on public.takes (item_id, item_type, scope) where is_public;

-- drop-then-create: a bare CREATE TRIGGER errors on a second run, which is a
-- nasty way to fail halfway through a batch (see 060).
drop trigger if exists set_takes_updated_at on public.takes;
create trigger set_takes_updated_at
before update on public.takes
for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.takes enable row level security;

drop policy if exists "takes_self" on public.takes;
create policy "takes_self"
  on public.takes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

/**
 * Public takes, subject to the same profile gate as everything else.
 *
 * Note what this does NOT do: it does not hide `body` on a row where
 * is_public is false, because RLS filters rows and not columns. A private
 * take simply never matches. That is the safe direction — but it also means
 * the API must still be careful never to select another user's row by id
 * alone. 060 has the same shape and the same caveat.
 */
drop policy if exists "takes_public_read" on public.takes;
create policy "takes_public_read"
  on public.takes for select
  using (is_public and public.profile_visible_to_viewer(user_id));

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Order matters: scores first, then merge private text onto those rows, then
-- public text as its own row carrying the same score.

-- 1. Ratings become score-only private takes.
insert into public.takes (user_id, item_id, item_type, scope, score, is_public, created_at)
select r.user_id, r.item_id, r.item_type, 'title', r.score, false, coalesce(r.created_at, now())
  from public.user_ratings r
 where r.score is not null
on conflict on constraint takes_identity_key do nothing;

-- 2. Private diary text merges onto the score row where one exists.
insert into public.takes (user_id, item_id, item_type, scope, body, is_public, watched_at, created_at)
select w.user_id, w.item_id, w.item_type, 'title', w.review_text, false, w.watched_at, coalesce(w.watched_at, now())
  from public.watched_items w
 where nullif(btrim(w.review_text), '') is not null
on conflict on constraint takes_identity_key
  do update set body = excluded.body,
                watched_at = coalesce(public.takes.watched_at, excluded.watched_at);

-- 3. Public reviews become their own row, carrying the same score so the two
--    rows agree about how the person rated the thing.
insert into public.takes (user_id, item_id, item_type, scope, score, body, is_public, watched_at, created_at)
select w.user_id, w.item_id, w.item_type, 'title',
       (select r.score from public.user_ratings r
         where r.user_id = w.user_id and r.item_id = w.item_id and r.item_type = w.item_type),
       w.public_review_text, true, w.watched_at, coalesce(w.watched_at, now())
  from public.watched_items w
 where nullif(btrim(w.public_review_text), '') is not null
on conflict on constraint takes_identity_key
  do update set body = excluded.body;

-- 4/5. Season and episode opinions. Both tables are empty in this database, so
--      these are no-ops here — they exist so the migration is correct anywhere
--      the features were actually used before consolidation.
insert into public.takes (user_id, item_id, item_type, scope, season_number, score, body, is_public, created_at)
select s.user_id, s.show_id, 'tv', 'season', s.season_number, s.score,
       coalesce(nullif(btrim(s.public_review_text), ''), s.review_text),
       nullif(btrim(s.public_review_text), '') is not null,
       coalesce(s.created_at, now())
  from public.season_reviews s
 where s.score is not null
    or nullif(btrim(s.review_text), '') is not null
    or nullif(btrim(s.public_review_text), '') is not null
on conflict on constraint takes_identity_key do nothing;

insert into public.takes (user_id, item_id, item_type, scope, season_number, episode_number, score, body, is_public, created_at)
select e.user_id, e.show_id, 'tv', 'episode', e.season_number, e.episode_number, e.score, e.note, false,
       coalesce(e.created_at, now())
  from public.episode_ratings e
 where e.score is not null or nullif(btrim(e.note), '') is not null
on conflict on constraint takes_identity_key do nothing;

commit;
