-- 066_related_by_audience.sql
--
-- "People here who watched this also watched…" — the one related-titles signal
-- a TMDB-backed competitor cannot copy, because it is this community's data
-- rather than the provider's.
--
-- 043 built `user_title_affinity` to match *people* to each other. The same
-- rows answer item-to-item similarity and nothing was using them for it. This
-- adds one function; it creates no table and alters no existing object.
--
-- ── NOT YET APPLIED ─────────────────────────────────────────────────────────
-- Written without database access, so it has never been executed and its query
-- plan has never been measured. The application degrades cleanly without it:
-- `relatedData.ts` swallows the "function does not exist" error and the
-- ranking renormalises the community term away, which is the path that runs
-- today. Do not tick D5's community box on the strength of this file — a
-- criterion nobody re-checks is a claim, not a test.
--
-- ── Privacy ─────────────────────────────────────────────────────────────────
-- This reads across users by design, so three gates, and the third is the one
-- that is easy to get wrong.
--
-- 1. Only public profiles contribute. Written as
--    `lower(trim(coalesce(u.visibility::text, 'public'))) = 'public'` to match
--    062:187 and 018:16. A bare `u.visibility = 'public'` would be wrong twice
--    over: NULL = 'public' is NULL, so every user predating the column would
--    be silently dropped and the function would return nothing forever.
--
-- 2. `co_watchers >= MIN_CO_WATCHERS`, so an output row is always a count
--    rather than a disclosure about one identifiable person.
--
-- 3. `seed_watchers >= MIN_SEED_WATCHERS`, which (2) alone does not give you.
--    The detail page also renders `title_audience` — up to five *named*, linked
--    profiles who watched this title. If the seed had two watchers and both are
--    named on that page, then "2 co-watchers" on title Y publishes that those
--    two specific, named people watched Y. The floor has to be on the seed's
--    audience, not only on the co-watch count, or the two features leak in
--    combination while each looks safe alone.
--
-- Returns counts only — no user ids, no usernames, no timestamps. The return
-- type is the guarantee: there is no column here that could carry an identity,
-- so "does it leak the wrong users" narrows to "does it leak any user", which
-- is answerable by reading the signature.

BEGIN;

-- The seed's audience must be at least this large before any co-watch count is
-- reported. Five is chosen against `title_audience`, which samples five names.
CREATE OR REPLACE FUNCTION public.related_by_audience(
  p_item_id   text,
  p_item_type text,
  p_limit     integer DEFAULT 200
)
RETURNS TABLE (
  item_id       text,
  item_type     text,
  co_watchers   integer,
  seed_watchers integer,
  score         numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH seed AS (
    -- Who engaged with the title being viewed, public profiles only.
    SELECT a.user_id, a.weight
      FROM public.user_title_affinity a
      JOIN public.users u ON u.id = a.user_id
     WHERE a.item_id = p_item_id
       AND a.item_type = p_item_type
       AND lower(trim(coalesce(u.visibility::text, 'public'))) = 'public'
  ),
  gate AS (
    -- One row iff the seed's audience clears the k-anonymity floor. Joining
    -- against this is what makes the floor unskippable rather than advisory.
    SELECT count(*)::int AS n FROM seed HAVING count(*) >= 5
  )
  SELECT
    o.item_id                                            AS item_id,
    o.item_type                                          AS item_type,
    count(*)::int                                        AS co_watchers,
    (SELECT n FROM gate)                                 AS seed_watchers,
    -- Shrunk toward zero so one co-watcher out of forty is not ranked as
    -- confidently as twenty are, the same instinct as 043's |S|/(|S|+3).
    round(
      (count(*)::numeric / (SELECT n FROM gate))
      * (count(*)::numeric / (count(*)::numeric + 2)),
      4
    )                                                    AS score
    FROM public.user_title_affinity o
    JOIN seed s ON s.user_id = o.user_id
   CROSS JOIN gate
   WHERE NOT (o.item_id = p_item_id AND o.item_type = p_item_type)
   GROUP BY o.item_id, o.item_type
  HAVING count(*) >= 2
   -- Aliased above so these names resolve to the select list rather than to
   -- the RETURNS TABLE output parameters, which is the difference between
   -- sorting on what you meant and failing at CREATE FUNCTION time.
   ORDER BY score DESC, co_watchers DESC, o.item_id
   LIMIT greatest(1, least(coalesce(p_limit, 200), 500));
$$;

COMMENT ON FUNCTION public.related_by_audience(text, text, integer) IS
  'Co-engagement counts for one title, public profiles only, floored at 5 seed watchers and 2 co-watchers. Returns counts, never identities.';

-- The view itself stays revoked (043:60) — only this function may read it.
REVOKE ALL ON FUNCTION public.related_by_audience(text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.related_by_audience(text, text, integer) TO authenticated, anon;

COMMIT;
