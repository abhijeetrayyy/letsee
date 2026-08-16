-- ============================================================================
-- LetSee — migrations 056 through 062, in order, as one script.
--
-- Generated from migrations/056_*.sql .. 062_*.sql. The individual files
-- remain the source of truth; this is purely a convenience so the batch can be
-- pasted into the Supabase SQL Editor in a single run.
--
-- Every file is additive: new tables, functions, policies and one constraint
-- widening. Nothing drops a column or deletes a row.
--
-- Each file carries its own BEGIN/COMMIT, so they commit independently — if
-- one fails, the ones before it stay applied and you can resume from the
-- failure. Re-running the whole script is safe.
--
-- Verified against the live database before generating:
--   * none of the seven new tables exist yet
--   * no notifications row has a type outside 061's new allowlist, so the
--     constraint recreate cannot abort
--   * public.set_updated_at() exists, which 060's trigger depends on
-- ============================================================================


-- ==========================================================================
-- 056_user_providers.sql
-- ==========================================================================

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

-- ==========================================================================
-- 057_watch_sessions.sql
-- ==========================================================================

-- 057_watch_sessions.sql
-- A Tonight session: who's watching, under what constraints, and what they
-- decided.
--
-- Deliberately small, and deliberately *persisted* rather than held in the
-- client. Three reasons it can't be ephemeral state:
--
--   1. "Next" has to not repeat, across a reload and across participants.
--   2. The verdict has to write `watching` for everyone in the room, which
--      means the server needs an authoritative participant list it can trust
--      — not one posted by the client at decide time.
--   3. The votes are the only honest training signal this product will ever
--      get. A rejection at the moment of choosing, with the alternatives
--      known, is worth far more than a rating given a week later.
--
-- Sessions are not cleaned up on a schedule. They're small, they're the record
-- of how a decision was made, and `decided_item_id` makes an abandoned session
-- distinguishable from a completed one without a status column.

begin;

create table if not exists public.watch_sessions (
  id            bigserial primary key,
  created_by    uuid not null references public.users(id) on delete cascade,
  region        text not null default 'US',
  max_runtime   integer,
  media_type    text not null default 'any'
                check (media_type in ('any', 'movie', 'tv')),
  moods         text[] not null default '{}',
  allow_rewatch boolean not null default false,
  decided_item_id   text,
  decided_item_type text check (decided_item_type in ('movie', 'tv')),
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists watch_sessions_creator_idx
  on public.watch_sessions (created_by, created_at desc);

create table if not exists public.watch_session_participants (
  session_id bigint not null references public.watch_sessions(id) on delete cascade,
  user_id    uuid   not null references public.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists watch_session_participants_user_idx
  on public.watch_session_participants (user_id);

-- One row per (participant, candidate). 'out' is what drives "Next" — a
-- rejected title is filtered from every later resolve in the same session, for
-- everyone, because one veto is enough.
create table if not exists public.watch_session_votes (
  session_id bigint not null references public.watch_sessions(id) on delete cascade,
  user_id    uuid   not null references public.users(id) on delete cascade,
  item_id    text   not null,
  item_type  text   not null check (item_type in ('movie', 'tv')),
  vote       text   not null check (vote in ('in', 'out')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, item_id)
);

create index if not exists watch_session_votes_session_idx
  on public.watch_session_votes (session_id);

-- ── Membership helper ───────────────────────────────────────────────────────
-- A policy on watch_session_participants that itself selects from
-- watch_session_participants recurses forever. Same SECURITY DEFINER escape
-- hatch this codebase already uses for is_blocked(), is_club_member() and
-- profile_visible_to_viewer().
create or replace function public.is_session_participant(p_session bigint, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.watch_session_participants
     where session_id = p_session
       and user_id    = p_user
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.watch_sessions enable row level security;
alter table public.watch_session_participants enable row level security;
alter table public.watch_session_votes enable row level security;

drop policy if exists "watch_sessions_participant_read" on public.watch_sessions;
create policy "watch_sessions_participant_read"
  on public.watch_sessions
  for select
  using (public.is_session_participant(id, auth.uid()));

-- Only the creator mutates the session itself (constraints, verdict).
-- Participants read it and vote; they don't get to change the runtime limit
-- out from under whoever set it up.
drop policy if exists "watch_sessions_owner_write" on public.watch_sessions;
create policy "watch_sessions_owner_write"
  on public.watch_sessions
  for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "watch_session_participants_read" on public.watch_session_participants;
create policy "watch_session_participants_read"
  on public.watch_session_participants
  for select
  using (public.is_session_participant(session_id, auth.uid()));

drop policy if exists "watch_session_participants_owner_write" on public.watch_session_participants;
create policy "watch_session_participants_owner_write"
  on public.watch_session_participants
  for all
  using (
    exists (
      select 1 from public.watch_sessions s
       where s.id = session_id and s.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.watch_sessions s
       where s.id = session_id and s.created_by = auth.uid()
    )
  );

drop policy if exists "watch_session_votes_read" on public.watch_session_votes;
create policy "watch_session_votes_read"
  on public.watch_session_votes
  for select
  using (public.is_session_participant(session_id, auth.uid()));

-- You vote as yourself, in a session you're actually in.
drop policy if exists "watch_session_votes_self_write" on public.watch_session_votes;
create policy "watch_session_votes_self_write"
  on public.watch_session_votes
  for all
  using (auth.uid() = user_id and public.is_session_participant(session_id, auth.uid()))
  with check (auth.uid() = user_id and public.is_session_participant(session_id, auth.uid()));

commit;

-- ==========================================================================
-- 058_letterboxd_import.sql
-- ==========================================================================

-- 058_letterboxd_import.sql
-- Importing a Letterboxd history.
--
-- Export already exists (/api/account/export); this is the other half. Export
-- removes the reason not to try us, import removes the cost of switching, and
-- neither is worth much without the other.
--
-- ── Why not background_jobs (024) ───────────────────────────────────────────
-- The plan called for running this on the existing job queue. That queue is a
-- shell: nothing anywhere calls registerJobHandler, so dispatchJob always fails
-- with "No handler registered", and vercel.json declares no crons, so
-- /api/cron/run-jobs is never invoked. Even fixed, cron granularity means an
-- import that starts "sometime later" — which is the wrong shape for the one
-- moment it matters, a new user with an empty profile deciding whether to stay.
--
-- So the work is chunked and client-driven: the browser posts the file once,
-- then calls /process repeatedly until done, with a real progress bar. That
-- also keeps each request inside serverless time limits without a queue.
--
-- ── Why one row per film, not per CSV line ──────────────────────────────────
-- watched.csv, ratings.csv, reviews.csv and likes/films.csv all name the same
-- films. Deduping on (title, year) at insert time means a film costs ONE TMDB
-- lookup instead of four, which is the difference between a 500-film import
-- being pleasant and being a rate-limit problem.

begin;

create table if not exists public.import_jobs (
  id             bigserial primary key,
  user_id        uuid not null references public.users(id) on delete cascade,
  source         text not null default 'letterboxd',
  status         text not null default 'pending'
                 check (status in ('pending', 'processing', 'completed', 'failed')),
  total_rows     integer not null default 0,
  processed_rows integer not null default 0,
  resolved_rows  integer not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists import_jobs_user_idx
  on public.import_jobs (user_id, created_at desc);

create table if not exists public.import_rows (
  id       bigserial primary key,
  job_id   bigint not null references public.import_jobs(id) on delete cascade,

  -- What Letterboxd said. Kept verbatim so an unresolved row can be shown to
  -- the user as they wrote it, and re-matched by hand.
  title          text not null,
  year           integer,
  letterboxd_uri text,

  -- Accumulated intent across the export's several files.
  watched      boolean not null default false,
  watchlist    boolean not null default false,
  favorite     boolean not null default false,
  rating       smallint check (rating between 1 and 10),
  review_text  text,
  watched_date date,

  -- Resolution. 'unresolved' is a first-class outcome, not a failure: guessing
  -- silently would put films in someone's history that they never saw.
  status        text not null default 'pending'
                check (status in ('pending', 'applied', 'unresolved', 'skipped')),
  tmdb_id       text,
  tmdb_type     text check (tmdb_type in ('movie', 'tv')),
  matched_title text
);

create index if not exists import_rows_job_status_idx
  on public.import_rows (job_id, status);

-- Postgres treats NULLs as distinct in a unique constraint, so a film with no
-- year would dedupe against nothing. coalesce in an expression index fixes it.
create unique index if not exists import_rows_job_title_year_idx
  on public.import_rows (job_id, lower(title), coalesce(year, 0));

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Self-only, both tables. Deliberately NOT the service_role-only policy that
-- background_jobs uses: the whole point is that the importing user polls their
-- own progress, which a service_role-gated table can't serve without routing
-- every poll through an admin client.
alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;

drop policy if exists "import_jobs_self" on public.import_jobs;
create policy "import_jobs_self"
  on public.import_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.owns_import_job(p_job bigint)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.import_jobs j
     where j.id = p_job and j.user_id = auth.uid()
  );
$$;

drop policy if exists "import_rows_self" on public.import_rows;
create policy "import_rows_self"
  on public.import_rows
  for all
  using (public.owns_import_job(job_id))
  with check (public.owns_import_job(job_id));

commit;

-- ==========================================================================
-- 059_year_in_review.sql
-- ==========================================================================

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

-- ==========================================================================
-- 060_season_reviews.sql
-- ==========================================================================

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

-- drop-then-create so re-running the file is safe, matching 062. A bare
-- CREATE TRIGGER errors on the second run, which is a nasty way to fail
-- halfway through a batch of migrations.
drop trigger if exists set_season_reviews_updated_at on public.season_reviews;
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

-- ==========================================================================
-- 061_new_episode_notification.sql
-- ==========================================================================

-- 061_new_episode_notification.sql
-- "There's a new episode of something you're watching."
--
-- The one notification in this app that is genuinely useful rather than
-- merely social: it tells you about something that happened in the world,
-- not about something another user did to your profile.
--
-- Two supporting pieces:
--
--   1. A new notification_type. Same drop-and-recreate dance as 041/047,
--      minus the ones the product no longer has — 'wave' and
--      'achievement_unlocked' stay in the constraint so existing rows remain
--      valid (the notifications page still renders them; see its comment),
--      but nothing creates them any more.
--
--   2. `notified_episodes`, so a daily job can be honest about what it has
--      already announced. Without it, every run re-notifies every show with a
--      recent episode, and the feature becomes the reason people turn
--      notifications off.

begin;

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type = any (array[
    'follow_request', 'follow_accepted', 'like', 'friend_watched',
    'friend_reviewed', 'friend_rated', 'comment_reply', 'dm_received',
    'new_follower', 'friend_started_watching', 'achievement_unlocked',
    'wave', 'new_episode'
  ]));

create table if not exists public.notified_episodes (
  user_id        uuid not null references public.users(id) on delete cascade,
  show_id        text not null,
  season_number  integer not null,
  episode_number integer not null,
  notified_at    timestamptz not null default now(),
  primary key (user_id, show_id, season_number, episode_number)
);

create index if not exists notified_episodes_user_idx
  on public.notified_episodes (user_id, notified_at desc);

alter table public.notified_episodes enable row level security;

-- Written by the cron job through the service role, read by nobody but the
-- job. Users never query this; it exists purely as the job's memory.
drop policy if exists "notified_episodes_self_read" on public.notified_episodes;
create policy "notified_episodes_self_read"
  on public.notified_episodes
  for select
  using (auth.uid() = user_id);

commit;

-- ==========================================================================
-- 062_reviews_get_an_audience.sql
-- ==========================================================================

-- 062_reviews_get_an_audience.sql
--
-- The gap this closes is the first one in SURPASSING_LETTERBOXD.md §1: on
-- Letterboxd a review is a *publication* — it gets likes, it surfaces on the
-- film page, people gain followers by writing. Here it has been a text column
-- nobody will ever read, so nobody writes one. That isn't a missing feature,
-- it's a missing loop.
--
-- Three parts, all small, because the pieces already existed and were simply
-- never connected:
--
--   1. Liking a review notified nobody. `reactions` (026) has no trigger and
--      the toggle route sends nothing — so the 'like' notification type has
--      been in the enum since 027 with nothing on earth creating it. Writing
--      into a void is the whole problem; this is the cheapest possible fix.
--
--   2. `/api/reviews` sorted by recency, which ranks the newest review above
--      the best one and guarantees that good writing sinks. Popularity needs
--      an aggregate over `reactions`, which PostgREST can't order by — hence
--      an RPC.
--
--   3. Nothing surfaced reviews outside the title they were about, so a good
--      one could only be found by someone already on that page.

begin;

-- ── 1. Liking notifies the author ───────────────────────────────────────────
create or replace function public.notify_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_owner uuid;
  item_name_val text;
  item_id_val text;
  item_type_val text;
begin
  -- Only the target types that belong to a person who'd want to know. A
  -- reaction on a comment or an activity row is noise, not applause.
  if new.target_type in ('review', 'watched') then
    select user_id, item_name, item_id, item_type
      into target_owner, item_name_val, item_id_val, item_type_val
      from public.watched_items where id = new.target_id;
  elsif new.target_type = 'list' then
    select user_id, name, null, 'list'
      into target_owner, item_name_val, item_id_val, item_type_val
      from public.user_lists where id = new.target_id;
  else
    return new;
  end if;

  -- Liking your own thing is not news.
  if target_owner is null or target_owner = new.user_id then
    return new;
  end if;

  -- Blocked either way means no notification. is_blocked already exists for
  -- exactly this and is used by the other notify_* triggers.
  if public.is_blocked(target_owner, new.user_id) then
    return new;
  end if;

  insert into public.notifications
    (user_id, actor_id, notification_type, target_type, target_id, metadata)
  values (
    target_owner, new.user_id, 'like', new.target_type, new.target_id,
    jsonb_build_object(
      'target_type', new.target_type,
      'item_name', item_name_val,
      'item_id', item_id_val,
      'item_type', item_type_val
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_reaction_trigger on public.reactions;
create trigger notify_reaction_trigger
after insert on public.reactions
for each row
execute function public.notify_reaction();

-- ── 2. Reviews for a title, ranked by reactions ─────────────────────────────
-- SECURITY DEFINER so the reaction counts can be aggregated across users;
-- visibility is therefore enforced explicitly below rather than by RLS.
create or replace function public.reviews_for_title(
  p_item_id   text,
  p_item_type text,
  p_viewer    uuid,
  p_limit     int default 10,
  p_offset    int default 0
)
returns table (
  id             bigint,
  user_id        uuid,
  username       text,
  avatar_url     text,
  review_text    text,
  watched_at     timestamptz,
  score          smallint,
  reaction_count bigint,
  viewer_reacted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id,
    w.user_id,
    u.username,
    u.avatar_url,
    w.public_review_text,
    w.watched_at,
    r.score,
    coalesce(rx.count, 0) as reaction_count,
    p_viewer is not null and exists (
      select 1 from public.reactions
       where target_type = 'review' and target_id = w.id and user_id = p_viewer
    ) as viewer_reacted
  from public.watched_items w
  join public.users u on u.id = w.user_id
  left join public.user_ratings r
    on r.user_id = w.user_id and r.item_id = w.item_id
  left join lateral (
    select count(*) as count
      from public.reactions
     where target_type = 'review' and target_id = w.id
  ) rx on true
  where w.item_id = p_item_id
    and w.item_type = p_item_type
    and w.public_review_text is not null
    and coalesce(u.profile_show_public_reviews, true)
    and public.profile_visible_to_viewer(w.user_id)
    and not public.is_blocked(coalesce(p_viewer, w.user_id), w.user_id)
  -- Reactions first, recency only to break ties. A unique id last so the sort
  -- is total and pages can't reshuffle — the same reason /api/reviews already
  -- tiebreaks on id.
  order by coalesce(rx.count, 0) desc, w.watched_at desc, w.id desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

grant execute on function public.reviews_for_title(text, text, uuid, int, int)
  to authenticated, anon;

-- ── 3. Popular reviews, across everything ───────────────────────────────────
-- Deliberately public-profiles-only. This is a discovery surface shown to
-- strangers and signed-out visitors, so "followers-only" must not leak into it
-- — profile_visible_to_viewer would admit a followers-only profile for a
-- follower, and a row that appears for some viewers and not others is the
-- wrong shape for a shared "popular this week" list.
create or replace function public.popular_reviews(
  p_days  int default 7,
  p_limit int default 6
)
returns table (
  id             bigint,
  username       text,
  avatar_url     text,
  review_text    text,
  item_id        text,
  item_type      text,
  item_name      text,
  image_url      text,
  reaction_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id, u.username, u.avatar_url, w.public_review_text,
    w.item_id, w.item_type, w.item_name, w.image_url,
    count(rx.id) as reaction_count
  from public.watched_items w
  join public.users u on u.id = w.user_id
  join public.reactions rx
    on rx.target_type = 'review' and rx.target_id = w.id
  where w.public_review_text is not null
    and coalesce(u.profile_show_public_reviews, true)
    and lower(trim(coalesce(u.visibility::text, 'public'))) = 'public'
    and rx.created_at >= now() - make_interval(days => greatest(p_days, 1))
  group by w.id, u.username, u.avatar_url, w.public_review_text,
           w.item_id, w.item_type, w.item_name, w.image_url
  order by count(rx.id) desc, w.watched_at desc, w.id desc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.popular_reviews(int, int) to authenticated, anon;

-- The aggregate above scans reactions by recency within a target type.
create index if not exists reactions_review_recent_idx
  on public.reactions (target_type, created_at desc)
  where target_type = 'review';

commit;
