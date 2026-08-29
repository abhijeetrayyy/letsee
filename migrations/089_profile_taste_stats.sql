-- 089_profile_taste_stats.sql
-- Everything the profile's Stats section shows, as two RPCs.
--
-- ── What this replaces ─────────────────────────────────────────────────────
-- Three API routes (`/api/profile/stats/{ratings,genres,years}`) that each did
-- `select <column> from <table> where user_id = ?` with no aggregation and no
-- bound, shipped every row to Node or the browser, and counted there. Two
-- consequences, one of them a live bug:
--
--   1. PostgREST caps a result set at 1000 rows by default. A user past 1000
--      ratings or 1000 watched titles got a *silently truncated* chart — no
--      error, just wrong numbers. Aggregating in SQL returns ~60 rows however
--      large the library is, so the cap stops being reachable.
--   2. The profile page separately pulled the whole of watched_items and the
--      whole of user_ratings for the taste blurb, and StatsSection then pulled
--      both again over HTTP. Four full-library transfers per profile view, by
--      every visitor, to compute counts.
--
-- One STABLE function, one round trip, arithmetic where the rows already are.
-- This is the shape `get_user_stats` already established.
--
-- ── Two ratings, not one ───────────────────────────────────────────────────
-- The point of the section is the comparison: what *you* gave a title against
-- what everybody else gave it. So every distribution comes in two flavours —
-- `you` from user_ratings, `crowd` from title_metadata.tmdb_vote_average (088)
-- — over the same library, split by movie and TV.
--
-- Titles TMDB has no votes for are excluded from the crowd figures rather than
-- counted as zero. TMDB returns vote_average 0.0 for an unrated title, and
-- averaging that in would drag every crowd number down and invent a fake mass
-- of "0-rated" films. `coverage` reports how much of the library the crowd
-- numbers actually speak for, and the UI says so.
--
-- Idempotent. Safe to re-run. Depends on 088.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- Which of the ten buckets a TMDB score falls in.
--
-- Rounds, so 6.8 lands with the 7s — a user's 7 and TMDB's 6.8 mean the same
-- thing and belong in the same column. Clamped into 1–10 because the user
-- scale has no zero, and a lone 0.4 would otherwise open an eleventh bucket
-- that exists for nobody's ratings.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tmdb_score_bucket(p_score real)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_score IS NULL THEN NULL
    ELSE GREATEST(1, LEAST(10, round(p_score)::int))
  END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- profile_taste_stats(user_id) -> jsonb
--
-- NULL when the profile is not visible to the caller. `profile_visible_to_viewer`
-- (081) is the single gate — it already folds in deleted accounts, private and
-- followers-only visibility, and blocks in both directions — so this does not
-- re-implement any of that and cannot drift from it.
--
-- `profile_show_ratings` is honoured separately: a visitor to a profile with
-- ratings hidden gets the library shape (genres, decades, activity) and no
-- scores at all, while the owner always sees their own.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profile_taste_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner    boolean;
  v_show_scores boolean;
  v_result      jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- `profile_visible_to_viewer` answers *true* for an id that does not exist:
  -- it selects visibility and deleted_at into locals, finds no row, leaves both
  -- NULL, and NULL visibility means public. Harmless there — there are no rows
  -- behind the predicate to leak — but here it would return a complete,
  -- all-zero stats object with a 200 for any UUID at all. Ask first.
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.deleted_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  IF NOT public.profile_visible_to_viewer(p_user_id) THEN
    RETURN NULL;
  END IF;

  v_is_owner := (auth.uid() IS NOT NULL AND auth.uid() = p_user_id);

  SELECT v_is_owner OR coalesce(u.profile_show_ratings, true)
    INTO v_show_scores
    FROM public.users u
   WHERE u.id = p_user_id;

  v_show_scores := coalesce(v_show_scores, v_is_owner);

  WITH
  -- The real diary date, where there is one. user_media_status.updated_at
  -- moves whenever the row is touched; watched_items.watched_at is when the
  -- person says they watched it, and that is what an activity chart means.
  wi_dates AS (
    SELECT wi.item_id, wi.item_type, max(wi.watched_at) AS watched_at
    FROM public.watched_items wi
    WHERE wi.user_id = p_user_id AND wi.is_watched
    GROUP BY wi.item_id, wi.item_type
  ),

  -- The library. user_media_status/'watched' — the same definition the profile
  -- header counts, so the charts cannot disagree with the number above them.
  watched AS (
    SELECT
      ums.item_id,
      ums.item_type,
      coalesce(tm.title, nullif(ums.item_name, '')) AS title,
      -- TMDB's genre list beats the snapshot taken at save time: it is
      -- canonical, and it fills in rows saved before genres were captured.
      coalesce(tm.genres, ums.genres, '{}'::text[])  AS genres,
      CASE
        WHEN tm.fetch_state = 'ok'
         AND tm.tmdb_vote_count IS NOT NULL AND tm.tmdb_vote_count > 0
         AND tm.tmdb_vote_average IS NOT NULL AND tm.tmdb_vote_average > 0
        THEN tm.tmdb_vote_average
      END                                            AS crowd,
      tm.fetch_state,
      tm.release_year,
      coalesce(d.watched_at, ums.updated_at)         AS watched_at
    FROM public.user_media_status ums
    LEFT JOIN public.title_metadata tm
      ON tm.item_id = ums.item_id AND tm.item_type = ums.item_type
    LEFT JOIN wi_dates d
      ON d.item_id = ums.item_id AND d.item_type = ums.item_type
    WHERE ums.user_id = p_user_id
      AND ums.status = 'watched'
  ),

  -- Every rating, whether or not the title is still in the library above. A
  -- rating is a judgement the person made; unmarking something watched does
  -- not retract it.
  rated AS (
    SELECT
      r.item_id,
      r.item_type,
      r.score,
      r.created_at,
      coalesce(tm.title, w.title)                    AS title,
      coalesce(tm.genres, w.genres, '{}'::text[])    AS genres,
      CASE
        WHEN tm.fetch_state = 'ok'
         AND tm.tmdb_vote_count IS NOT NULL AND tm.tmdb_vote_count > 0
         AND tm.tmdb_vote_average IS NOT NULL AND tm.tmdb_vote_average > 0
        THEN tm.tmdb_vote_average
      END                                            AS crowd,
      tm.release_year
    FROM public.user_ratings r
    LEFT JOIN public.title_metadata tm
      ON tm.item_id = r.item_id AND tm.item_type = r.item_type
    LEFT JOIN watched w
      ON w.item_id = r.item_id AND w.item_type = r.item_type
    WHERE r.user_id = p_user_id
  ),

  -- ── Your distribution, 1–10, split by kind ──────────────────────────────
  you_counts AS (
    SELECT
      score,
      count(*)::int                                        AS c_all,
      count(*) FILTER (WHERE item_type = 'movie')::int      AS c_movie,
      count(*) FILTER (WHERE item_type = 'tv')::int         AS c_tv
    FROM rated
    GROUP BY score
  ),
  you_hist AS (
    SELECT coalesce(jsonb_agg(
             jsonb_build_object(
               'score', b.score,
               'all',   coalesce(c.c_all, 0),
               'movie', coalesce(c.c_movie, 0),
               'tv',    coalesce(c.c_tv, 0)
             ) ORDER BY b.score
           ), '[]'::jsonb) AS j
    FROM generate_series(1, 10) AS b(score)
    LEFT JOIN you_counts c ON c.score = b.score
  ),

  -- ── The crowd's distribution over the same library ──────────────────────
  crowd_counts AS (
    SELECT
      public.tmdb_score_bucket(crowd)                       AS score,
      count(*)::int                                         AS c_all,
      count(*) FILTER (WHERE item_type = 'movie')::int       AS c_movie,
      count(*) FILTER (WHERE item_type = 'tv')::int          AS c_tv
    FROM watched
    WHERE crowd IS NOT NULL
    GROUP BY 1
  ),
  crowd_hist AS (
    SELECT coalesce(jsonb_agg(
             jsonb_build_object(
               'score', b.score,
               'all',   coalesce(c.c_all, 0),
               'movie', coalesce(c.c_movie, 0),
               'tv',    coalesce(c.c_tv, 0)
             ) ORDER BY b.score
           ), '[]'::jsonb) AS j
    FROM generate_series(1, 10) AS b(score)
    LEFT JOIN crowd_counts c ON c.score = b.score
  ),

  -- ── You against the crowd, title by title ───────────────────────────────
  compared AS (
    SELECT
      item_id, item_type, title,
      score::real                    AS you,
      crowd,
      (score::real - crowd)          AS delta
    FROM rated
    WHERE crowd IS NOT NULL
  ),
  compared_summary AS (
    SELECT
      count(*)::int                                          AS n,
      round(avg(you)::numeric, 2)                            AS avg_you,
      round(avg(crowd)::numeric, 2)                          AS avg_crowd,
      round(avg(delta)::numeric, 2)                          AS avg_delta,
      count(*) FILTER (WHERE delta >= 1)::int                 AS kinder,
      count(*) FILTER (WHERE delta <= -1)::int                AS harsher,
      count(*) FILTER (WHERE abs(delta) < 1)::int             AS agrees
    FROM compared
  ),
  -- Titles you rate far above the crowd, and far below. Ties broken by the
  -- larger absolute score so the list is stable rather than arbitrary.
  champions AS (
    SELECT coalesce(jsonb_agg(x ORDER BY (x->>'delta')::real DESC), '[]'::jsonb) AS j
    FROM (
      SELECT jsonb_build_object(
               'item_id', item_id, 'item_type', item_type, 'title', title,
               'you', you, 'crowd', round(crowd::numeric, 1), 'delta', round(delta::numeric, 1)
             ) AS x, delta, you
      -- 0.1, not 0: the delta is displayed to one decimal place, and a title
      -- you rated 0.04 below the crowd renders in the "everyone else loved
      -- this more" list as "-0.0", which reads as a bug rather than as
      -- agreement. Anything that rounds to zero belongs in neither list.
      FROM compared WHERE delta >= 0.1 ORDER BY delta DESC, you DESC LIMIT 6
    ) s
  ),
  disappointments AS (
    SELECT coalesce(jsonb_agg(x ORDER BY (x->>'delta')::real ASC), '[]'::jsonb) AS j
    FROM (
      SELECT jsonb_build_object(
               'item_id', item_id, 'item_type', item_type, 'title', title,
               'you', you, 'crowd', round(crowd::numeric, 1), 'delta', round(delta::numeric, 1)
             ) AS x, delta, you
      FROM compared WHERE delta <= -0.1 ORDER BY delta ASC, you ASC LIMIT 6
    ) s
  ),

  -- ── Genres: how much, and how you score it against the crowd ────────────
  genre_rows AS (
    SELECT g.genre, w.item_id, w.item_type, w.crowd, r.score
    FROM watched w
    CROSS JOIN LATERAL unnest(w.genres) AS g(genre)
    LEFT JOIN rated r ON r.item_id = w.item_id AND r.item_type = w.item_type
    WHERE g.genre IS NOT NULL AND g.genre <> ''
  ),
  genre_stats AS (
    SELECT coalesce(jsonb_agg(x ORDER BY (x->>'count')::int DESC, x->>'genre'), '[]'::jsonb) AS j
    FROM (
      SELECT jsonb_build_object(
               'genre',        genre,
               'count',        count(*)::int,
               'rated_count',  count(score)::int,
               'your_avg',     round(avg(score)::numeric, 2),
               'crowd_avg',    round(avg(crowd)::numeric, 2),
               -- The delta is an average of per-title differences, not a
               -- difference of two averages. Those are not the same number:
               -- your_avg is over the films you rated and crowd_avg is over
               -- the films TMDB has votes for, and subtracting one from the
               -- other produces a figure that describes no film at all. An
               -- earlier draft did exactly that and reported "you: 8.0,
               -- crowd: 6.73, delta +3.0" on one screen.
               --
               -- avg(score - crowd) skips any row missing either side, so this
               -- is exactly the paired comparison it claims to be.
               'paired_count', count(*) FILTER (WHERE score IS NOT NULL AND crowd IS NOT NULL)::int,
               'delta',        round(avg(score::real - crowd)::numeric, 2)
             ) AS x
      FROM genre_rows
      GROUP BY genre
      HAVING count(*) > 0
      ORDER BY count(*) DESC
      LIMIT 20
    ) s
  ),

  -- ── Decades of release ──────────────────────────────────────────────────
  decade_stats AS (
    SELECT coalesce(jsonb_agg(x ORDER BY (x->>'decade')::int), '[]'::jsonb) AS j
    FROM (
      SELECT jsonb_build_object(
               'decade',    (w.release_year / 10) * 10,
               'count',     count(*)::int,
               'your_avg',  round(avg(r.score)::numeric, 2),
               'crowd_avg', round(avg(w.crowd)::numeric, 2)
             ) AS x
      FROM watched w
      LEFT JOIN rated r ON r.item_id = w.item_id AND r.item_type = w.item_type
      WHERE w.release_year IS NOT NULL AND w.release_year BETWEEN 1870 AND 2100
      GROUP BY (w.release_year / 10) * 10
    ) s
  ),

  -- ── Are you getting harsher? Averages by the year you rated ─────────────
  drift AS (
    SELECT coalesce(jsonb_agg(x ORDER BY (x->>'year')::int), '[]'::jsonb) AS j
    FROM (
      SELECT jsonb_build_object(
               'year',      extract(year FROM created_at)::int,
               'count',     count(*)::int,
               'your_avg',  round(avg(score)::numeric, 2),
               'crowd_avg', round(avg(crowd)::numeric, 2)
             ) AS x
      FROM rated
      GROUP BY extract(year FROM created_at)::int
    ) s
  ),

  -- ── How much you watched, by year ───────────────────────────────────────
  activity AS (
    SELECT coalesce(jsonb_agg(x ORDER BY (x->>'year')::int), '[]'::jsonb) AS j
    FROM (
      SELECT jsonb_build_object(
               'year',  extract(year FROM watched_at)::int,
               'count', count(*)::int,
               'movie', count(*) FILTER (WHERE item_type = 'movie')::int,
               'tv',    count(*) FILTER (WHERE item_type = 'tv')::int
             ) AS x
      FROM watched
      WHERE watched_at IS NOT NULL
      GROUP BY extract(year FROM watched_at)::int
    ) s
  ),

  -- ── How much of the library the crowd numbers actually cover ────────────
  coverage AS (
    SELECT
      count(*)::int                                       AS watched_total,
      count(crowd)::int                                   AS crowd_known,
      -- Three states, not two. "No crowd score" collapses two very different
      -- situations, and telling a user both are "waiting on TMDB" produces a
      -- progress bar that never reaches 100% — which is a bug report waiting
      -- to happen.
      --
      --   pending  — the backfill has genuinely not asked yet. This will move.
      --   unrated  — TMDB answered and there is no score to have: zero votes,
      --              a dead id (404), or an id that is not a TMDB id at all.
      --              This will never move, and saying so is the honest answer.
      count(*) FILTER (
        WHERE crowd IS NULL
          AND (fetch_state IS NULL OR fetch_state = 'pending')
      )::int                                              AS crowd_pending,
      count(*) FILTER (
        WHERE crowd IS NULL
          AND fetch_state IS NOT NULL AND fetch_state <> 'pending'
      )::int                                              AS crowd_unrated
    FROM watched
  ),
  rating_totals AS (
    SELECT
      count(*)::int                     AS n,
      round(avg(score)::numeric, 2)     AS avg_score,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY score)::numeric AS median_score,
      count(*) FILTER (WHERE item_type = 'movie')::int AS n_movie,
      count(*) FILTER (WHERE item_type = 'tv')::int    AS n_tv
    FROM rated
  ),
  crowd_totals AS (
    SELECT
      count(*)::int                     AS n,
      round(avg(crowd)::numeric, 2)     AS avg_score
    FROM watched WHERE crowd IS NOT NULL
  )

  SELECT jsonb_build_object(
    'show_scores', v_show_scores,
    'is_owner',    v_is_owner,
    'coverage', jsonb_build_object(
      'watched_total', cov.watched_total,
      'crowd_known',   cov.crowd_known,
      'crowd_pending', cov.crowd_pending,
      'crowd_unrated', cov.crowd_unrated,
      -- Out of what *can* carry a score. A library where every remaining title
      -- is genuinely unrated by TMDB reads as complete, because it is.
      'crowd_pct',     CASE WHEN (cov.crowd_known + cov.crowd_pending) > 0
                            THEN round(100.0 * cov.crowd_known
                                       / (cov.crowd_known + cov.crowd_pending))::int
                            ELSE 100 END
    ),
    'you', CASE WHEN v_show_scores THEN jsonb_build_object(
      'histogram', yh.j,
      'count',     rt.n,
      'movie_count', rt.n_movie,
      'tv_count',    rt.n_tv,
      'average',   rt.avg_score,
      'median',    rt.median_score
    ) END,
    'crowd', jsonb_build_object(
      'histogram', ch.j,
      'count',     ct.n,
      'average',   ct.avg_score
    ),
    'comparison', CASE WHEN v_show_scores THEN jsonb_build_object(
      'count',      cs.n,
      'avg_you',    cs.avg_you,
      'avg_crowd',  cs.avg_crowd,
      'avg_delta',  cs.avg_delta,
      'kinder',     cs.kinder,
      'harsher',    cs.harsher,
      'agrees',     cs.agrees,
      'champions',       ch2.j,
      'disappointments', dis.j
    ) END,
    'genres',   gs.j,
    'decades',  ds.j,
    'drift',    CASE WHEN v_show_scores THEN dr.j ELSE '[]'::jsonb END,
    'activity', act.j
  )
  INTO v_result
  FROM you_hist yh, crowd_hist ch, compared_summary cs, champions ch2,
       disappointments dis, genre_stats gs, decade_stats ds, drift dr,
       activity act, coverage cov, rating_totals rt, crowd_totals ct;

  RETURN v_result;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- profile_taste_titles(...) -> the titles behind one bar.
--
-- A chart nobody can open is a chart people look at once. Every bar in the
-- section — a score bucket on either scale, a genre, a decade — resolves to
-- the same call, so there is one query to keep correct and one to keep guarded
-- rather than six.
--
-- Bounded at 100 rows per call and paged, so this can never become the
-- unbounded select it replaces.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profile_taste_titles(
  p_user_id   uuid,
  p_source    text    DEFAULT 'you',   -- 'you' | 'crowd'
  p_bucket    integer DEFAULT NULL,    -- 1–10, or NULL for "any score"
  p_item_type text    DEFAULT NULL,    -- 'movie' | 'tv' | NULL for both
  p_genre     text    DEFAULT NULL,
  p_decade    integer DEFAULT NULL,
  p_limit     integer DEFAULT 30,
  p_offset    integer DEFAULT 0
)
RETURNS TABLE(
  item_id     text,
  item_type   text,
  title       text,
  image_url   text,
  your_score  smallint,
  crowd_score real,
  release_year smallint,
  watched_at  timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner    boolean;
  v_show_scores boolean;
  v_limit       integer := LEAST(GREATEST(coalesce(p_limit, 30), 1), 100);
  v_offset      integer := GREATEST(coalesce(p_offset, 0), 0);
  v_source      text    := lower(coalesce(p_source, 'you'));
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- `profile_visible_to_viewer` answers *true* for an id that does not exist:
  -- it selects visibility and deleted_at into locals, finds no row, leaves both
  -- NULL, and NULL visibility means public. Harmless there — there are no rows
  -- behind the predicate to leak — but here it would return a complete,
  -- all-zero stats object with a 200 for any UUID at all. Ask first.
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  IF NOT public.profile_visible_to_viewer(p_user_id) THEN
    RETURN;
  END IF;

  v_is_owner := (auth.uid() IS NOT NULL AND auth.uid() = p_user_id);

  SELECT v_is_owner OR coalesce(u.profile_show_ratings, true)
    INTO v_show_scores FROM public.users u WHERE u.id = p_user_id;
  v_show_scores := coalesce(v_show_scores, v_is_owner);

  -- Asking for a bucket of somebody's own scores when they have chosen not to
  -- show scores is not an error to explain, it is a question that has no
  -- answer. Return nothing.
  IF v_source = 'you' AND NOT v_show_scores THEN
    RETURN;
  END IF;

  IF v_source NOT IN ('you', 'crowd') THEN
    v_source := 'you';
  END IF;

  RETURN QUERY
  WITH wi_dates AS (
    SELECT wi.item_id, wi.item_type, max(wi.watched_at) AS watched_at
    FROM public.watched_items wi
    WHERE wi.user_id = p_user_id AND wi.is_watched
    GROUP BY wi.item_id, wi.item_type
  ),
  base AS (
    SELECT
      ums.item_id,
      ums.item_type,
      coalesce(tm.title, nullif(ums.item_name, ''), ums.item_id) AS title,
      ums.image_url,
      r.score AS your_score,
      CASE
        WHEN tm.fetch_state = 'ok'
         AND coalesce(tm.tmdb_vote_count, 0) > 0
         AND coalesce(tm.tmdb_vote_average, 0) > 0
        THEN tm.tmdb_vote_average
      END AS crowd_score,
      tm.release_year,
      coalesce(tm.genres, ums.genres, '{}'::text[]) AS genres,
      coalesce(d.watched_at, ums.updated_at) AS watched_at
    FROM public.user_media_status ums
    LEFT JOIN public.title_metadata tm
      ON tm.item_id = ums.item_id AND tm.item_type = ums.item_type
    LEFT JOIN public.user_ratings r
      ON r.user_id = p_user_id AND r.item_id = ums.item_id AND r.item_type = ums.item_type
    LEFT JOIN wi_dates d
      ON d.item_id = ums.item_id AND d.item_type = ums.item_type
    WHERE ums.user_id = p_user_id
      AND ums.status = 'watched'
  ),
  filtered AS (
    SELECT * FROM base b
    WHERE (p_item_type IS NULL OR b.item_type = p_item_type)
      AND (p_genre IS NULL OR p_genre = ANY (b.genres))
      AND (p_decade IS NULL OR (b.release_year IS NOT NULL
                                AND (b.release_year / 10) * 10 = p_decade))
      AND (
        p_bucket IS NULL
        OR (v_source = 'you'   AND b.your_score = p_bucket)
        OR (v_source = 'crowd' AND public.tmdb_score_bucket(b.crowd_score) = p_bucket)
      )
  )
  SELECT
    f.item_id, f.item_type, f.title, f.image_url,
    CASE WHEN v_show_scores THEN f.your_score END,
    f.crowd_score, f.release_year, f.watched_at,
    count(*) OVER ()
  FROM filtered f
  ORDER BY
    CASE WHEN v_source = 'crowd' THEN f.crowd_score END DESC NULLS LAST,
    f.watched_at DESC NULLS LAST,
    f.item_id
  LIMIT v_limit OFFSET v_offset;
END;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────
-- REVOKE FROM PUBLIC, not FROM anon — 077's finding: anon is a member of
-- PUBLIC, so revoking from anon by name has never taken a privilege away.
--
-- Then granted back to anon deliberately. Signed-out visitors can already
-- browse public profiles (get_user_stats and title_rating_histogram both
-- answer anon, and 077 left that surface alone on purpose), and these two are
-- gated by profile_visible_to_viewer, which returns false for private,
-- followers-only, deleted and blocked without ever consulting the caller's
-- claim about who they are.
REVOKE ALL ON FUNCTION public.profile_taste_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_taste_titles(uuid, text, integer, text, text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tmdb_score_bucket(real) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.profile_taste_stats(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.profile_taste_titles(uuid, text, integer, text, text, integer, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tmdb_score_bucket(real) TO anon, authenticated, service_role;

COMMIT;
