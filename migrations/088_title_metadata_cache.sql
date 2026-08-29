-- 088_title_metadata_cache.sql
-- A shared, per-title cache of TMDB's own numbers — so a profile can show what
-- the crowd thought next to what you thought.
--
-- ── Why a title table and not a column ──────────────────────────────────────
-- The obvious move is `watched_items.tmdb_vote_average`. It is wrong twice.
-- TMDB's score belongs to the *title*, not to a person's row about the title,
-- so a column duplicates it once per user who watched it and gives three users
-- three chances to disagree about what Interstellar scored. And the backfill
-- that fills it would then be O(rows) instead of O(distinct titles) — 718
-- status rows on this database collapse to a few hundred films, and the gap
-- widens with every user who joins.
--
-- One row per (item_id, item_type). Every user's stats read the same row.
--
-- ── Why it carries a queue in the same table ────────────────────────────────
-- `background_jobs` (024) is the natural home and does not work: nothing calls
-- registerJobHandler and no cron invokes the runner, so anything scheduled on
-- it silently never runs (see docs/AGENT_DB_AND_MIGRATIONS.md). The pattern
-- that demonstrably works here is a plain function a cron route calls
-- directly, which is what `newEpisodeNotifier` and `availabilityChecker` do.
--
-- So the work list *is* the cache: a row exists for every title anyone has
-- touched, and `fetch_state` says whether TMDB has answered for it yet. There
-- is no second table to keep in step with this one, and a partially-filled
-- cache is a normal state rather than a failure — the stats RPC reports
-- coverage and the UI says so out loud.
--
-- Idempotent. Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.title_metadata (
  item_id            text        NOT NULL,
  item_type          text        NOT NULL,

  -- TMDB payload. All nullable: a row exists from the moment a title is
  -- *known*, and is filled in later by the backfill. Never read these without
  -- checking fetch_state = 'ok'.
  title              text,
  tmdb_vote_average  real,
  tmdb_vote_count    integer,
  release_year       smallint,
  runtime_minutes    integer,
  original_language  text,
  popularity         real,
  genres             text[],
  adult              boolean,

  -- Queue state.
  --   pending  — eligible for a fetch attempt at/after next_attempt_at
  --   ok       — TMDB answered; the columns above are trustworthy
  --   missing  — TMDB returned 404. The id is dead; stop asking.
  --   failed   — attempts exhausted. Requires a deliberate re-queue.
  fetch_state        text        NOT NULL DEFAULT 'pending',
  attempts           smallint    NOT NULL DEFAULT 0,
  last_error         text,
  -- Doubles as the claim lease: claiming pushes this forward, so a second
  -- overlapping run skips the row, and a run that dies mid-flight releases it
  -- automatically when the lease expires. No stuck 'running' state to clean up.
  next_attempt_at    timestamptz NOT NULL DEFAULT now(),
  fetched_at         timestamptz,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT title_metadata_pkey PRIMARY KEY (item_id, item_type),
  CONSTRAINT title_metadata_item_type_check
    CHECK (item_type = ANY (ARRAY['movie'::text, 'tv'::text])),
  CONSTRAINT title_metadata_fetch_state_check
    CHECK (fetch_state = ANY (ARRAY['pending'::text, 'ok'::text, 'missing'::text, 'failed'::text])),
  -- TMDB's scale is 0–10. A value outside it means we parsed the wrong field.
  CONSTRAINT title_metadata_vote_average_check
    CHECK (tmdb_vote_average IS NULL OR (tmdb_vote_average >= 0 AND tmdb_vote_average <= 10)),
  CONSTRAINT title_metadata_vote_count_check
    CHECK (tmdb_vote_count IS NULL OR tmdb_vote_count >= 0)
);

COMMENT ON TABLE public.title_metadata IS
  'One row per TMDB title: the crowd''s score, plus the backfill queue state that filled it. Shared across all users.';
COMMENT ON COLUMN public.title_metadata.tmdb_vote_average IS
  'TMDB vote_average, 0–10. Only meaningful when fetch_state = ''ok''.';
COMMENT ON COLUMN public.title_metadata.next_attempt_at IS
  'Earliest next fetch attempt. Claiming pushes it forward as a lease, so overlapping cron runs cannot fetch the same title twice.';

-- The queue read: "what should this run fetch?" Partial, so it stays small
-- however large the cache grows — once a title is 'ok' it leaves the index.
CREATE INDEX IF NOT EXISTS title_metadata_queue_idx
  ON public.title_metadata (next_attempt_at)
  WHERE fetch_state = 'pending';

-- The refresh read: "which 'ok' rows have gone stale?" Same reasoning.
CREATE INDEX IF NOT EXISTS title_metadata_stale_idx
  ON public.title_metadata (fetched_at)
  WHERE fetch_state = 'ok';

DROP TRIGGER IF EXISTS set_title_metadata_updated_at ON public.title_metadata;
CREATE TRIGGER set_title_metadata_updated_at
BEFORE UPDATE ON public.title_metadata
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
-- This table holds no user data — it is a cache of public TMDB facts, and two
-- users watching the same film share the row. So SELECT is open and there is
-- deliberately no write policy: only service_role (which bypasses RLS) writes,
-- which is exactly the backfill and nothing else. A signed-in user cannot
-- claim a lease or poison a score.
ALTER TABLE public.title_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS title_metadata_select_all ON public.title_metadata;
CREATE POLICY title_metadata_select_all ON public.title_metadata
  FOR SELECT USING (true);

GRANT SELECT ON public.title_metadata TO anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- enqueue_missing_title_metadata(limit)
--
-- Adds a 'pending' row for every title anyone has engaged with that the cache
-- has never heard of. Called at the top of each backfill run, so the queue
-- fills itself and no write path in the app has to remember to register a
-- title. That matters: 069's post-mortem is exactly what happens when a
-- denormalised table depends on every caller remembering.
--
-- The union is over all four tables that name a title, because a rating can
-- outlive its watched row and a favourite need not be in user_media_status.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_missing_title_metadata(p_limit integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  WITH known AS (
    SELECT item_id, item_type FROM public.user_media_status
    UNION
    SELECT item_id, item_type FROM public.watched_items
    UNION
    SELECT item_id, item_type FROM public.user_ratings
    UNION
    SELECT item_id, item_type FROM public.favorite_items
  ),
  fresh AS (
    SELECT k.item_id, k.item_type
    FROM known k
    LEFT JOIN public.title_metadata t
      ON t.item_id = k.item_id AND t.item_type = k.item_type
    WHERE t.item_id IS NULL
      AND k.item_id IS NOT NULL
      AND k.item_id <> ''
      -- TMDB ids are integers. Anything else came from an import and would
      -- burn an API call to learn that it is still not a TMDB id.
      AND k.item_id ~ '^[0-9]+$'
      AND k.item_type IN ('movie', 'tv')
    LIMIT GREATEST(0, p_limit)
  )
  INSERT INTO public.title_metadata (item_id, item_type)
  SELECT item_id, item_type FROM fresh
  ON CONFLICT (item_id, item_type) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- enqueue_stale_title_metadata(max_age_days, limit)
--
-- TMDB's vote_average moves. A film seen the week it released and rated by 200
-- people is not the same number a year later, and "you vs the crowd" is a lie
-- if our copy of the crowd is frozen. Re-queues 'ok' rows older than the
-- window, oldest first, bounded so a refresh can never become a stampede.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_stale_title_metadata(
  p_max_age_days integer DEFAULT 30,
  p_limit integer DEFAULT 200
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  WITH stale AS (
    SELECT item_id, item_type
    FROM public.title_metadata
    WHERE fetch_state = 'ok'
      AND fetched_at IS NOT NULL
      AND fetched_at < now() - make_interval(days => GREATEST(1, p_max_age_days))
    ORDER BY fetched_at
    LIMIT GREATEST(0, p_limit)
  )
  UPDATE public.title_metadata m
     SET fetch_state = 'pending',
         attempts = 0,
         next_attempt_at = now()
    FROM stale s
   WHERE m.item_id = s.item_id AND m.item_type = s.item_type;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- claim_title_metadata(limit, lease_seconds)
--
-- Hand a run a batch of titles to fetch, and make them invisible to any other
-- run for the length of the lease.
--
-- FOR UPDATE SKIP LOCKED is what makes two cron invocations overlapping — a
-- retry, a manual trigger while the schedule fires — cost nothing instead of
-- doubling the TMDB traffic. The lease is a timestamp rather than a 'running'
-- state because a serverless function that is killed mid-run cannot clean up
-- after itself; a state would stick forever, a lease just expires.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_title_metadata(
  p_limit integer DEFAULT 100,
  p_lease_seconds integer DEFAULT 600
)
RETURNS TABLE(item_id text, item_type text, attempts smallint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT t.item_id, t.item_type
    FROM public.title_metadata t
    WHERE t.fetch_state = 'pending'
      AND t.next_attempt_at <= now()
    ORDER BY t.next_attempt_at, t.created_at
    LIMIT LEAST(GREATEST(1, p_limit), 500)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.title_metadata m
     SET next_attempt_at = now() + make_interval(secs => GREATEST(60, p_lease_seconds))
    FROM claimed c
   WHERE m.item_id = c.item_id AND m.item_type = c.item_type
  RETURNING m.item_id, m.item_type, m.attempts;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- record_title_metadata_failure(item_id, item_type, error, max_attempts)
--
-- Exponential backoff in the database rather than in the job, so a run that
-- dies before it can record the outcome still leaves the row correctly
-- scheduled — the lease it took at claim time is the floor.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_title_metadata_failure(
  p_item_id text,
  p_item_type text,
  p_error text,
  p_max_attempts integer DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.title_metadata
     SET attempts = attempts + 1,
         last_error = left(coalesce(p_error, 'unknown'), 500),
         fetch_state = CASE
           WHEN attempts + 1 >= GREATEST(1, p_max_attempts) THEN 'failed'
           ELSE 'pending'
         END,
         -- 2^attempts minutes, capped at a day. A title TMDB is currently
         -- unhappy about should not be retried every ten minutes forever.
         next_attempt_at = now() + make_interval(
           secs => LEAST(86400, 60 * power(2, LEAST(attempts + 1, 10))::int)
         )
   WHERE item_id = p_item_id AND item_type = p_item_type;
END;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────
-- None of these four are for users. They mutate the queue, and a caller who
-- could reach claim_title_metadata could starve the backfill by leasing every
-- pending row. service_role only.
--
-- **PUBLIC *and* anon *and* authenticated, all three.** Two separate grants
-- exist on a function born in this schema: the implicit one Postgres gives to
-- PUBLIC, and an explicit one Supabase's default ACL on `public` gives to anon
-- and authenticated. Revoking from PUBLIC alone removes the first and leaves
-- the second, which is precisely the bug this file shipped and 090 had to fix
-- on the live database. 077 wrote `FROM PUBLIC, anon` for the same reason.
REVOKE ALL ON FUNCTION public.enqueue_missing_title_metadata(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_stale_title_metadata(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_title_metadata(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_title_metadata_failure(text, text, text, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_missing_title_metadata(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_stale_title_metadata(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_title_metadata(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_title_metadata_failure(text, text, text, integer) TO service_role;

-- Seed the queue with everything already in the database, so the first cron
-- run has work to do rather than discovering it a run later.
SELECT public.enqueue_missing_title_metadata(20000);

COMMIT;
