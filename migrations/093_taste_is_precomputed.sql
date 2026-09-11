-- 093_taste_is_precomputed.sql
-- Stop rebuilding the whole community every time somebody opens a profile.
--
-- ── What is wrong today ────────────────────────────────────────────────────
-- `taste_compatibility(a, b)` — the function behind the compatibility panel on
-- every profile — begins like this (043):
--
--   totals AS ( count(DISTINCT user_id) FROM user_title_affinity )
--   idf    AS ( GROUP BY item_type, item_id FROM user_title_affinity )
--   norms  AS ( sqrt(sum(...))            FROM user_title_affinity )
--
-- and `user_title_affinity` is not a table. It is a view: a three-way UNION ALL
-- over the whole of user_media_status, the whole of favorite_items and the
-- whole of user_ratings, then a GROUP BY.
--
-- So looking at one person's profile scans three tables end to end and
-- aggregates the entire community twice, to produce one number about two
-- people. `taste_matches` does the same and then computes a norm for every user
-- in the system. `title_audience` scans it again on every title page.
--
-- At three users this is instant, which is why it shipped. At three thousand it
-- is a multi-million-row scan on the two busiest page types on the site — and
-- this application has already been taken off the air once by its own hosting
-- bill (docs/incident-2026-08-23-deployment-paused.md).
--
-- ── The decomposition ──────────────────────────────────────────────────────
-- Nothing here changes the maths. 043's formula is reproduced exactly. What
-- changes is *when each part of it runs*, split by how often each part actually
-- changes:
--
--   corpus  — how many people are here.        Changes daily.   Cached.
--   rarity  — how rare each title is.          Changes daily.   Cached.
--   norm    — the length of one person's       Changes when     Cached, keyed
--             rarity-weighted library.         they log.        on a counter.
--   pair    — the overlap of two people.       Derived.         Cached on read.
--
-- The per-title *count* is deliberately NOT cached: `(item_id, item_type)` is
-- indexed on all three source tables (043), so counting the watchers of one
-- title is already a cheap indexed read. It was never the expensive part. The
-- expensive part was the community-wide GROUP BY, and that is what moves.
--
-- ── The staleness rule, which is the whole saving ──────────────────────────
-- A cached pair is served even when a version has moved on, unless it is also
-- more than a week old. Taste does not change fast enough for anyone to notice,
-- and this is what turns a repeat profile view into one indexed row read
-- forever rather than a recomputation.
--
-- ── What this migration does NOT do ────────────────────────────────────────
-- It does not touch the affinity weights. Giving hand-picked favourites a
-- weight (they currently count for nothing) is a product change and belongs in
-- its own migration, not smuggled into a performance one.
--
-- Idempotent. Safe to re-run.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Layer 0 — the corpus
--
-- One row, one number: how many people have any tracked title at all. It is
-- the U in ln(1 + U / n_t), and it is the "of N people here" in every rarity
-- sentence the product shows. A `count(DISTINCT user_id)` over every library
-- to render one line of copy is precisely the shape being removed.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.taste_corpus (
  only_row     boolean PRIMARY KEY DEFAULT true,
  total_users  integer NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT taste_corpus_single_row CHECK (only_row)
);

INSERT INTO public.taste_corpus (only_row, total_users)
VALUES (true, 0)
ON CONFLICT (only_row) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Layer 1 — rarity, one row per title
--
-- A table rather than a materialized view on purpose. A matview must be
-- rebuilt whole; a table can later be touched per-title when the nightly
-- rebuild stops being cheap. Start with the full rebuild because it is simple
-- and obviously correct, and leave the door open.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.title_reach (
  item_type    text NOT NULL,
  item_id      text NOT NULL,
  viewers      integer NOT NULL DEFAULT 0,
  idf          numeric NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_type, item_id),
  CONSTRAINT title_reach_item_type_check CHECK (item_type IN ('movie', 'tv'))
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Layer 2 — one row per person
--
-- `library_version` is bumped by a trigger whenever anything that feeds the
-- affinity view changes for that user. `norm_version` and `neighbours_version`
-- record which version each cached artefact was computed against, so staleness
-- is an integer comparison and there is no invalidation job that can be wrong.
--
-- The counter lives here rather than on `users` deliberately. `users` is read
-- on nearly every request; making every log, rating and like UPDATE that row
-- would put a hot row under write contention and bloat it for no reason.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_taste (
  user_id            uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  library_version    integer NOT NULL DEFAULT 1,
  norm               numeric NOT NULL DEFAULT 0,
  title_count        integer NOT NULL DEFAULT 0,
  norm_version       integer NOT NULL DEFAULT 0,
  neighbours_version integer NOT NULL DEFAULT 0,
  computed_at        timestamptz
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Layer 3 — the pair, cached on first read
--
-- `user_a < user_b` is enforced rather than merely intended: without it the
-- same pair can be stored twice under two orderings, and the second copy is
-- the one that goes stale silently.
--
-- Rows exist only for pairs somebody actually looked at, so this grows with
-- real traffic and never with n².
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.taste_pair (
  user_a       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score        numeric NOT NULL DEFAULT 0,
  shared_count integer NOT NULL DEFAULT 0,
  top_shared   jsonb   NOT NULL DEFAULT '[]'::jsonb,
  version_a    integer NOT NULL DEFAULT 0,
  version_b    integer NOT NULL DEFAULT 0,
  computed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CONSTRAINT taste_pair_ordered CHECK (user_a < user_b)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Layer 4 — "people like you", precomputed
--
-- The most expensive of the three surfaces, because it scores one person
-- against everybody. It is also the one nobody is waiting on: a directory of
-- people whose taste resembles yours is not less true for having been computed
-- last night. So it is never computed on a request.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.taste_neighbours (
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rank         smallint NOT NULL,
  other_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score        numeric NOT NULL DEFAULT 0,
  shared_count integer NOT NULL DEFAULT 0,
  top_shared   jsonb   NOT NULL DEFAULT '[]'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rank)
);

-- ── Nothing here is client-readable ────────────────────────────────────────
-- Every one of these spans users other than the caller, exactly as
-- user_title_affinity does. They are reached only through the SECURITY DEFINER
-- functions below, which carry the visibility and block checks.
ALTER TABLE public.taste_corpus     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_reach      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_taste       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taste_pair       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taste_neighbours ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.taste_corpus     FROM anon, authenticated;
REVOKE ALL ON public.title_reach      FROM anon, authenticated;
REVOKE ALL ON public.user_taste       FROM anon, authenticated;
REVOKE ALL ON public.taste_pair       FROM anon, authenticated;
REVOKE ALL ON public.taste_neighbours FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- The version counter
--
-- STATEMENT level with transition tables, following 069. The import applies
-- rows in chunks and the episode modal marks a whole series at once; a per-row
-- trigger would issue one UPDATE per row in the batch. Per statement it runs
-- once per affected user however large the batch — which for a 1,000-title
-- Letterboxd import is the difference between 1,000 writes and one.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.bump_library_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  /**
   * The join to `users` is load-bearing, not defensive tidiness.
   *
   * Deleting an account cascades into user_media_status, favorite_items and
   * user_ratings, and each of those cascaded deletes fires this trigger. By
   * then the `users` row is already gone, so an unguarded INSERT would try to
   * create a user_taste row pointing at it, violate the foreign key, and abort
   * the whole delete — turning /api/cron/purge-deleted into a route that can
   * never finish. Bumping a version counter for somebody who no longer exists
   * is meaningless anyway; the join makes it a no-op.
   */
  INSERT INTO public.user_taste (user_id, library_version)
  SELECT DISTINCT a.user_id, 1
    FROM affected_users a
    JOIN public.users u ON u.id = a.user_id
   WHERE a.user_id IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE
    SET library_version = public.user_taste.library_version + 1;
  RETURN NULL;
END;
$$;

-- Two transition tables cannot be referenced by one trigger, so arrivals and
-- departures get their own — the same shape 069 uses, and for the same reason:
-- an UPDATE that moves a row between users must bump both.
DROP TRIGGER IF EXISTS bump_taste_ums_ins ON public.user_media_status;
CREATE TRIGGER bump_taste_ums_ins
AFTER INSERT ON public.user_media_status
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.bump_library_version();

DROP TRIGGER IF EXISTS bump_taste_ums_upd ON public.user_media_status;
CREATE TRIGGER bump_taste_ums_upd
AFTER UPDATE ON public.user_media_status
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.bump_library_version();

DROP TRIGGER IF EXISTS bump_taste_ums_del ON public.user_media_status;
CREATE TRIGGER bump_taste_ums_del
AFTER DELETE ON public.user_media_status
REFERENCING OLD TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.bump_library_version();

DROP TRIGGER IF EXISTS bump_taste_fav_ins ON public.favorite_items;
CREATE TRIGGER bump_taste_fav_ins
AFTER INSERT ON public.favorite_items
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.bump_library_version();

DROP TRIGGER IF EXISTS bump_taste_fav_del ON public.favorite_items;
CREATE TRIGGER bump_taste_fav_del
AFTER DELETE ON public.favorite_items
REFERENCING OLD TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.bump_library_version();

DROP TRIGGER IF EXISTS bump_taste_rat_ins ON public.user_ratings;
CREATE TRIGGER bump_taste_rat_ins
AFTER INSERT ON public.user_ratings
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.bump_library_version();

DROP TRIGGER IF EXISTS bump_taste_rat_upd ON public.user_ratings;
CREATE TRIGGER bump_taste_rat_upd
AFTER UPDATE ON public.user_ratings
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.bump_library_version();

DROP TRIGGER IF EXISTS bump_taste_rat_del ON public.user_ratings;
CREATE TRIGGER bump_taste_rat_del
AFTER DELETE ON public.user_ratings
REFERENCING OLD TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.bump_library_version();

-- ═══════════════════════════════════════════════════════════════════════════
-- Nightly: rebuild the corpus and the rarity table
--
-- One full scan a day, in place of one full scan per page view.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.refresh_title_reach()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users integer;
  v_rows  integer;
  -- One timestamp for the whole pass. Every row this run touches gets exactly
  -- this value, which is what makes the sweep at the bottom unambiguous:
  -- anything still carrying an older stamp is a title nobody engages with any
  -- more. Comparing against a relative window instead would either spare stale
  -- rows or delete live ones depending on how long the run took.
  v_now   timestamptz := now();
BEGIN
  SELECT count(DISTINCT user_id)::int INTO v_users FROM public.user_title_affinity;

  UPDATE public.taste_corpus
     SET total_users = GREATEST(v_users, 0), refreshed_at = v_now
   WHERE only_row;

  -- No users, no rarity. Returning early rather than dividing by zero.
  IF v_users = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.title_reach (item_type, item_id, viewers, idf, refreshed_at)
  SELECT
    a.item_type,
    a.item_id,
    count(DISTINCT a.user_id)::int,
    ln(1 + v_users::numeric / count(DISTINCT a.user_id)::numeric),
    v_now
  FROM public.user_title_affinity a
  GROUP BY a.item_type, a.item_id
  ON CONFLICT (item_type, item_id) DO UPDATE
    SET viewers      = EXCLUDED.viewers,
        idf          = EXCLUDED.idf,
        refreshed_at = EXCLUDED.refreshed_at;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- A title everybody removed still has a row, and it would keep a stale
  -- rarity that no longer matches anything. Cheap to sweep in the same pass.
  DELETE FROM public.title_reach r WHERE r.refreshed_at < v_now;

  RETURN v_rows;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- The norm of one person's rarity-weighted library
--
-- Bounded by that person's library, and it reads rarity from layer 1 rather
-- than deriving it. Called for one user at a time.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.recompute_user_taste(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm  numeric;
  v_count integer;
  v_ver   integer;
BEGIN
  SELECT library_version INTO v_ver FROM public.user_taste WHERE user_id = p_user;
  IF v_ver IS NULL THEN v_ver := 1; END IF;

  SELECT COALESCE(sqrt(sum((a.weight * r.idf) ^ 2)), 0), count(*)::int
    INTO v_norm, v_count
    FROM public.user_title_affinity a
    JOIN public.title_reach r
      ON r.item_type = a.item_type AND r.item_id = a.item_id
   WHERE a.user_id = p_user;

  INSERT INTO public.user_taste (user_id, library_version, norm, title_count, norm_version, computed_at)
  VALUES (p_user, v_ver, COALESCE(v_norm, 0), COALESCE(v_count, 0), v_ver, now())
  ON CONFLICT (user_id) DO UPDATE
    SET norm         = EXCLUDED.norm,
        title_count  = EXCLUDED.title_count,
        norm_version = EXCLUDED.norm_version,
        computed_at  = now();
END;
$$;

/** Nightly sweep: bring every stale norm up to date, newest churn first. */
CREATE OR REPLACE FUNCTION public.refresh_user_taste(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT user_id FROM public.user_taste
     WHERE norm_version IS DISTINCT FROM library_version
     ORDER BY library_version DESC
     LIMIT GREATEST(p_limit, 1)
  LOOP
    PERFORM public.recompute_user_taste(r.user_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- The pair, computed
--
-- 043's arithmetic, unchanged — but rarity comes from layer 1 and the two
-- norms come from layer 2, so what remains is a join of user A's rows to user
-- B's rows on an indexed key. Both sides of that join push their `user_id`
-- predicate down through the affinity view's UNION ALL into three indexes.
--
-- Internal. It carries no guards, because the only caller that reaches it from
-- outside is taste_pair_get(), which carries all of them.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.taste_pair_compute(p_a uuid, p_b uuid)
RETURNS TABLE (score numeric, shared_count integer, top_shared jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH corpus AS (
    SELECT total_users FROM public.taste_corpus WHERE only_row
  ),
  shared AS (
    SELECT
      x.item_type,
      x.item_id,
      COALESCE(x.item_name, y.item_name, '') AS item_name,
      r.idf,
      r.viewers,
      x.weight * y.weight * r.idf * r.idf
        * COALESCE(1 - abs(rx.score - ry.score) / 9.0, 1) AS contrib
    FROM public.user_title_affinity x
    JOIN public.user_title_affinity y
      ON y.item_type = x.item_type AND y.item_id = x.item_id AND y.user_id = p_b
    JOIN public.title_reach r
      ON r.item_type = x.item_type AND r.item_id = x.item_id
    LEFT JOIN public.user_ratings rx
      ON rx.user_id = p_a AND rx.item_type = x.item_type AND rx.item_id = x.item_id
    LEFT JOIN public.user_ratings ry
      ON ry.user_id = p_b AND ry.item_type = x.item_type AND ry.item_id = x.item_id
    WHERE x.user_id = p_a
  ),
  norms AS (
    SELECT
      (SELECT norm FROM public.user_taste WHERE user_id = p_a) AS na,
      (SELECT norm FROM public.user_taste WHERE user_id = p_b) AS nb
  )
  SELECT
    round(
      COALESCE(
        (SELECT sum(s.contrib) FROM shared s)
          / NULLIF((SELECT na FROM norms) * (SELECT nb FROM norms), 0),
        0)
      * ((SELECT count(*) FROM shared)::numeric / ((SELECT count(*) FROM shared) + 3)),
      4
    ),
    (SELECT count(*)::int FROM shared),
    COALESCE(
      (SELECT jsonb_agg(t)
         FROM (
           SELECT jsonb_build_object(
                    'itemId',     s.item_id,
                    'itemType',   s.item_type,
                    'name',       s.item_name,
                    'rarity',     round(s.idf, 3),
                    'viewers',    s.viewers,
                    'totalUsers', (SELECT total_users FROM corpus)
                  ) AS t
             FROM shared s
            WHERE s.item_name <> ''
            ORDER BY s.idf DESC, s.item_name
            LIMIT 3
         ) q),
      '[]'::jsonb
    );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- taste_pair_get(p_other) — what the profile actually calls
--
-- Read-through cache. The normal case is one indexed row and no arithmetic.
--
-- ── The guards, carried over from 074 verbatim in intent ───────────────────
-- 074 exists because 043 shipped taste_compatibility() as SECURITY DEFINER
-- taking two caller-supplied uuids with no visibility test, no block test, and
-- no relationship between p_a and the caller — so anyone holding the anon key
-- could read three titles out of any private library. That must not be
-- reintroduced here, so this function takes ONE argument and pins the other
-- side to auth.uid(). There is no parameter to point at a stranger.
--
-- ── Why a stale answer is served ───────────────────────────────────────────
-- A cached row is returned even when a version has moved on, unless it is also
-- older than a week. This is the saving. Somebody logging a film does not
-- change how much their taste resembles yours by an amount anybody can
-- perceive, and recomputing on every version bump would put the cost straight
-- back where it was.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.taste_pair_get(p_other uuid)
RETURNS TABLE (score numeric, shared_count integer, top_shared jsonb)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me    uuid := auth.uid();
  v_a     uuid;
  v_b     uuid;
  v_va    integer;
  v_vb    integer;
  v_row   public.taste_pair%ROWTYPE;
  v_fresh record;
BEGIN
  IF v_me IS NULL OR p_other IS NULL OR v_me = p_other THEN
    RETURN;
  END IF;

  -- The same predicate every RLS policy in this schema uses, and the same
  -- symmetric block test. A failed guard returns zero rows, which every caller
  -- already renders as "nothing to show".
  IF NOT public.profile_visible_to_viewer(p_other) THEN
    RETURN;
  END IF;
  IF public.is_blocked(v_me, p_other) THEN
    RETURN;
  END IF;

  v_a := LEAST(v_me, p_other);
  v_b := GREATEST(v_me, p_other);

  SELECT COALESCE((SELECT library_version FROM public.user_taste WHERE user_id = v_a), 0),
         COALESCE((SELECT library_version FROM public.user_taste WHERE user_id = v_b), 0)
    INTO v_va, v_vb;

  SELECT * INTO v_row FROM public.taste_pair WHERE user_a = v_a AND user_b = v_b;

  IF FOUND
     AND ( (v_row.version_a = v_va AND v_row.version_b = v_vb)
           OR v_row.computed_at > now() - interval '7 days' )
  THEN
    RETURN QUERY SELECT v_row.score, v_row.shared_count, v_row.top_shared;
    RETURN;
  END IF;

  SELECT * INTO v_fresh FROM public.taste_pair_compute(v_a, v_b);

  INSERT INTO public.taste_pair AS tp
    (user_a, user_b, score, shared_count, top_shared, version_a, version_b, computed_at)
  VALUES
    (v_a, v_b, COALESCE(v_fresh.score, 0), COALESCE(v_fresh.shared_count, 0),
     COALESCE(v_fresh.top_shared, '[]'::jsonb), v_va, v_vb, now())
  ON CONFLICT (user_a, user_b) DO UPDATE
    SET score        = EXCLUDED.score,
        shared_count = EXCLUDED.shared_count,
        top_shared   = EXCLUDED.top_shared,
        version_a    = EXCLUDED.version_a,
        version_b    = EXCLUDED.version_b,
        computed_at  = now();

  RETURN QUERY SELECT COALESCE(v_fresh.score, 0),
                      COALESCE(v_fresh.shared_count, 0),
                      COALESCE(v_fresh.top_shared, '[]'::jsonb);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Nightly: who is like each person
--
-- The one genuinely expensive computation left, and it now runs at most once
-- per user per night, and only for users whose library actually moved.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.recompute_taste_neighbours(p_user uuid, p_limit integer DEFAULT 20)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ver integer;
BEGIN
  SELECT library_version INTO v_ver FROM public.user_taste WHERE user_id = p_user;
  IF v_ver IS NULL THEN v_ver := 1; END IF;

  DELETE FROM public.taste_neighbours WHERE user_id = p_user;

  INSERT INTO public.taste_neighbours (user_id, rank, other_id, score, shared_count, top_shared, refreshed_at)
  WITH corpus AS (
    SELECT total_users FROM public.taste_corpus WHERE only_row
  ),
  mine AS (
    SELECT a.item_type, a.item_id, a.item_name, a.weight, r.idf, r.viewers
      FROM public.user_title_affinity a
      JOIN public.title_reach r
        ON r.item_type = a.item_type AND r.item_id = a.item_id
     WHERE a.user_id = p_user
  ),
  pairs AS (
    SELECT
      t.user_id,
      m.weight * t.weight * m.idf * m.idf
        * COALESCE(1 - abs(mr.score - tr.score) / 9.0, 1) AS contrib,
      m.idf,
      m.viewers,
      COALESCE(m.item_name, t.item_name, '') AS item_name,
      m.item_type,
      m.item_id
    FROM mine m
    JOIN public.user_title_affinity t
      ON t.item_type = m.item_type AND t.item_id = m.item_id AND t.user_id <> p_user
    JOIN public.users u
      ON u.id = t.user_id
     AND u.visibility = 'public'
     AND u.username IS NOT NULL AND u.username <> ''
     AND u.deleted_at IS NULL
     AND NOT public.is_blocked(p_user, u.id)
    LEFT JOIN public.user_ratings mr
      ON mr.user_id = p_user AND mr.item_type = m.item_type AND mr.item_id = m.item_id
    LEFT JOIN public.user_ratings tr
      ON tr.user_id = t.user_id AND tr.item_type = m.item_type AND tr.item_id = m.item_id
  ),
  agg AS (
    SELECT
      p.user_id,
      sum(p.contrib) AS raw,
      count(*)::int  AS shared_count,
      (array_agg(
        jsonb_build_object(
          'itemId',     p.item_id,
          'itemType',   p.item_type,
          'name',       p.item_name,
          'rarity',     round(p.idf, 3),
          'viewers',    p.viewers,
          'totalUsers', (SELECT total_users FROM corpus)
        ) ORDER BY p.idf DESC, p.item_name
      ) FILTER (WHERE p.item_name <> ''))[1:3] AS top3
    FROM pairs p
    GROUP BY p.user_id
  ),
  scored AS (
    SELECT
      a.user_id,
      round(
        (a.raw / NULLIF(
           (SELECT norm FROM public.user_taste WHERE user_id = p_user)
           * (SELECT norm FROM public.user_taste WHERE user_id = a.user_id), 0))
        * (a.shared_count::numeric / (a.shared_count + 3)),
        4) AS score,
      a.shared_count,
      COALESCE(to_jsonb(a.top3), '[]'::jsonb) AS top_shared
    FROM agg a
    WHERE a.raw > 0
  )
  SELECT
    p_user,
    (row_number() OVER (ORDER BY s.score DESC NULLS LAST, s.shared_count DESC))::smallint,
    s.user_id,
    COALESCE(s.score, 0),
    s.shared_count,
    s.top_shared,
    now()
  FROM scored s
  ORDER BY s.score DESC NULLS LAST, s.shared_count DESC
  LIMIT GREATEST(p_limit, 1);

  UPDATE public.user_taste
     SET neighbours_version = v_ver
   WHERE user_id = p_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_taste_neighbours(p_limit integer DEFAULT 200)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT user_id FROM public.user_taste
     WHERE neighbours_version IS DISTINCT FROM library_version
     ORDER BY library_version DESC
     LIMIT GREATEST(p_limit, 1)
  LOOP
    PERFORM public.recompute_taste_neighbours(r.user_id, 20);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

/**
 * The directory read. Pinned to auth.uid() for the reason 074 gives, and 077's
 * open item #3 records against `taste_matches`: a SECURITY DEFINER function
 * that accepts a caller-supplied uuid is a function anyone with the anon key
 * can aim at anybody.
 */
CREATE OR REPLACE FUNCTION public.my_taste_neighbours(p_limit integer DEFAULT 10)
RETURNS TABLE (
  user_id      uuid,
  username     text,
  avatar_url   text,
  about        text,
  score        numeric,
  shared_count integer,
  top_shared   jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.other_id, u.username, u.avatar_url, u.about,
         n.score, n.shared_count, n.top_shared
    FROM public.taste_neighbours n
    JOIN public.users u ON u.id = n.other_id
   WHERE n.user_id = auth.uid()
     AND u.visibility = 'public'
     AND u.deleted_at IS NULL
     -- Recomputed nightly, but a block placed since then must take effect now.
     AND NOT public.is_blocked(auth.uid(), n.other_id)
   ORDER BY n.rank
   LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- title_audience, without the community scan
--
-- ── What changed and what deliberately did not ─────────────────────────────
-- The per-title watcher count stays live. `(item_id, item_type)` is indexed on
-- all three source tables (043) precisely so this is a cheap indexed read, and
-- it was never the expensive part. It also matters that it is exact: on a small
-- community the rarity signal is the product, and "2 people here have seen
-- this" reading 0 until a nightly job catches up would break the one thing this
-- function exists to say.
--
-- What moves to the cache is `total_users` — a count(DISTINCT user_id) over
-- every library, run to render one line of copy.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.title_audience(
  p_item_id   text,
  p_item_type text,
  p_viewer    uuid DEFAULT NULL
)
RETURNS TABLE (
  viewers     int,
  total_users int,
  sample      jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH watchers AS (
    SELECT a.user_id
      FROM public.user_title_affinity a
     WHERE a.item_id = p_item_id
       AND a.item_type = p_item_type
       AND (p_viewer IS NULL OR a.user_id <> p_viewer)
       AND NOT public.is_blocked(COALESCE(p_viewer, a.user_id), a.user_id)
  ),
  visible AS (
    SELECT u.id, u.username, u.avatar_url
      FROM watchers w
      JOIN public.users u ON u.id = w.user_id
     WHERE u.visibility = 'public'
       AND u.username IS NOT NULL AND u.username <> ''
       AND u.deleted_at IS NULL
     LIMIT 5
  )
  SELECT
    (SELECT count(*)::int FROM watchers),
    COALESCE((SELECT total_users FROM public.taste_corpus WHERE only_row), 0),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'userId',   v.id,
                'username', v.username,
                'avatarUrl', v.avatar_url))
         FROM visible v),
      '[]'::jsonb
    );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- The two functions this replaces
--
-- `taste_compatibility` and `taste_matches` recompute the community on every
-- call. Nothing in the application will reference them after this change, and
-- leaving a SECURITY DEFINER function that scans every library reachable by
-- anyone holding the anon key is the exact shape 074 and 077 spent two
-- migrations closing.
-- ═══════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.taste_compatibility(uuid, uuid);
DROP FUNCTION IF EXISTS public.taste_matches(uuid, int);
DROP FUNCTION IF EXISTS public.taste_matches(uuid, integer);

-- ── Grants ─────────────────────────────────────────────────────────────────
-- Only the two read-through entry points are callable, and both are pinned to
-- auth.uid(). The refresh functions belong to the cron, which holds
-- service_role. The compute helpers are internal.
REVOKE EXECUTE ON FUNCTION public.taste_pair_get(uuid)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_taste_neighbours(integer)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.taste_pair_get(uuid)          TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.my_taste_neighbours(integer)  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.taste_pair_compute(uuid, uuid)                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_taste(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_taste_neighbours(uuid, integer)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_title_reach()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_user_taste(integer)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_taste_neighbours(integer)             FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.taste_pair_compute(uuid, uuid)                TO service_role;
GRANT  EXECUTE ON FUNCTION public.recompute_user_taste(uuid)                    TO service_role;
GRANT  EXECUTE ON FUNCTION public.recompute_taste_neighbours(uuid, integer)     TO service_role;
GRANT  EXECUTE ON FUNCTION public.refresh_title_reach()                         TO service_role;
GRANT  EXECUTE ON FUNCTION public.refresh_user_taste(integer)                   TO service_role;
GRANT  EXECUTE ON FUNCTION public.refresh_taste_neighbours(integer)             TO service_role;

-- title_audience keeps the grants it already had — it is read by signed-out
-- visitors on every title page.
REVOKE EXECUTE ON FUNCTION public.title_audience(text, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.title_audience(text, text, uuid) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Seed
--
-- Every existing user gets a row at library_version 1 and norm_version 0, so
-- the first nightly run treats the whole population as stale and computes it
-- once. Without this, a user who never logs anything again would never get a
-- norm, and every pair involving them would score zero forever.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.user_taste (user_id, library_version, norm_version, neighbours_version)
SELECT id, 1, 0, 0 FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- Build the caches now rather than leaving the product wrong until the first
-- cron fires. On a database this size it is instant; on a large one this is the
-- one slow statement in the migration, and it is a one-off.
SELECT public.refresh_title_reach();
SELECT public.refresh_user_taste(100000);
SELECT public.refresh_taste_neighbours(100000);

-- ═══════════════════════════════════════════════════════════════════════════
-- Verify
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t, ', ') INTO v_missing
  FROM unnest(ARRAY['taste_corpus','title_reach','user_taste','taste_pair','taste_neighbours']) AS t
  WHERE to_regclass('public.' || t) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'missing table(s): %', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname IN ('taste_compatibility', 'taste_matches')
  ) THEN
    RAISE EXCEPTION 'a per-request community scan survived';
  END IF;

  IF (SELECT count(*) FROM public.taste_corpus) <> 1 THEN
    RAISE EXCEPTION 'taste_corpus must hold exactly one row';
  END IF;

  RAISE NOTICE 'verified: taste is precomputed — corpus %, titles %, users %',
    (SELECT total_users FROM public.taste_corpus WHERE only_row),
    (SELECT count(*) FROM public.title_reach),
    (SELECT count(*) FROM public.user_taste);
END $$;

COMMIT;
