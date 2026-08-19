-- 074_taste_compatibility_respects_privacy.sql
-- taste_compatibility() was a hole straight through the privacy model.
--
-- 043 does the right thing twice and the wrong thing once. It REVOKEs ALL on
-- user_title_affinity from anon and authenticated, because the view spans every
-- user's library. It gates taste_matches() on
--   u.visibility = 'public' AND NOT public.is_blocked(p_user, u.id)
-- And then it bolts taste_compatibility() to the side of the revoked view as
--   SECURITY DEFINER ... GRANT EXECUTE ... TO authenticated, anon
-- taking two caller-supplied uuids, with no visibility test, no block test, and
-- no relationship between p_a and whoever is actually calling. The only
-- predicates in its body are `x.user_id = p_a` and `y.user_id = p_b`.
--
-- So: anyone holding the anon key — which ships in the client bundle — could
-- call rpc('taste_compatibility', {p_a: <any uuid>, p_b: <any uuid>}) and get
-- back up to three named titles out of a private profile's library plus the
-- size of it. A blocked user could run it against the person who blocked them.
-- Setting a profile to private did nothing.
--
-- This replaces the function with the same maths behind three guards, and
-- withdraws the anon grant. The guards live inside the function rather than in
-- /api/compatibility because the anon key can reach the RPC directly and never
-- has to go through the route.
--
--   1. p_a must be the caller. The function answers questions about YOUR
--      overlap with someone, not about an arbitrary pair of strangers.
--   2. p_b must be visible to the caller, by the same predicate every RLS
--      policy in this schema already uses.
--   3. Neither party may have blocked the other. is_blocked() is already
--      symmetric (032:38-42), so one call covers both directions.
--
-- A failed guard returns zero rows, which /api/compatibility already handles as
-- "no overlap to show" — it never distinguished an empty result from a refused
-- one, so no caller changes.
--
-- Idempotent: CREATE OR REPLACE, and a REVOKE of a grant that is already gone
-- is a no-op.

BEGIN;

CREATE OR REPLACE FUNCTION public.taste_compatibility(p_a uuid, p_b uuid)
RETURNS TABLE (score numeric, shared_count int, top_shared jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
-- (The pragma is first because plpgsql only accepts it ahead of the body.)
-- RETURNS TABLE declares OUT variables named score/shared_count/top_shared, and
-- the final SELECT aliases three columns to those same names. Nothing below
-- references the variables, so make columns win explicitly rather than relying
-- on every reference staying qualified forever.
BEGIN
  -- 1. Only ever about the caller.
  IF auth.uid() IS NULL OR p_a IS DISTINCT FROM auth.uid() THEN
    RETURN;
  END IF;

  -- 2. The other profile has to be one the caller may see at all.
  IF p_a IS DISTINCT FROM p_b AND NOT public.profile_visible_to_viewer(p_b) THEN
    RETURN;
  END IF;

  -- 3. A block in either direction ends the conversation.
  IF public.is_blocked(p_a, p_b) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH totals AS (
    SELECT count(DISTINCT a.user_id)::numeric AS n_users FROM user_title_affinity a
  ),
  idf AS (
    SELECT a.item_type, a.item_id,
           ln(1 + (SELECT n_users FROM totals) / count(DISTINCT a.user_id)::numeric) AS idf,
           count(DISTINCT a.user_id)::int AS viewers
    FROM user_title_affinity a
    GROUP BY a.item_type, a.item_id
  ),
  norms AS (
    SELECT a.user_id, sqrt(sum((a.weight * i.idf) ^ 2)) AS nrm
    FROM user_title_affinity a
    JOIN idf i ON i.item_type = a.item_type AND i.item_id = a.item_id
    WHERE a.user_id IN (p_a, p_b)
    GROUP BY a.user_id
  ),
  pairs AS (
    SELECT
      x.weight * y.weight * i.idf * i.idf
        * COALESCE(1 - abs(rx.score - ry.score) / 9.0, 1) AS contrib,
      i.idf,
      i.viewers,
      COALESCE(x.item_name, y.item_name, '') AS item_name,
      x.item_type, x.item_id
    FROM user_title_affinity x
    JOIN user_title_affinity y
      ON y.item_type = x.item_type AND y.item_id = x.item_id AND y.user_id = p_b
    JOIN idf i ON i.item_type = x.item_type AND i.item_id = x.item_id
    LEFT JOIN user_ratings rx
      ON rx.user_id = p_a AND rx.item_type = x.item_type AND rx.item_id = x.item_id
    LEFT JOIN user_ratings ry
      ON ry.user_id = p_b AND ry.item_type = x.item_type AND ry.item_id = x.item_id
    WHERE x.user_id = p_a
  )
  SELECT
    round(
      (COALESCE(sum(p.contrib), 0)
        / NULLIF(
            (SELECT nrm FROM norms WHERE norms.user_id = p_a)
            * (SELECT nrm FROM norms WHERE norms.user_id = p_b), 0))
        * (count(*)::numeric / (count(*) + 3)),
      4
    ) AS score,
    count(*)::int AS shared_count,
    to_jsonb((array_agg(
      jsonb_build_object(
        'itemId', p.item_id,
        'itemType', p.item_type,
        'name', p.item_name,
        'rarity', round(p.idf, 3),
        'viewers', p.viewers,
        'totalUsers', (SELECT n_users::int FROM totals)
      ) ORDER BY p.idf DESC, p.item_name
    ))[1:3]) AS top_shared
  FROM pairs p;
END;
$$;

-- The anon key has no business asking who overlaps with whom.
-- CORRECTION (077): the REVOKE below removes a grant that was never the
-- one letting anon in. PostgreSQL grants EXECUTE to PUBLIC by default and
-- anon is a member of PUBLIC, so this line is a no-op on its own.
-- migrations/077_rpcs_are_not_public.sql revokes from PUBLIC and is what
-- actually closes it. Verified against the live database.
REVOKE EXECUTE ON FUNCTION public.taste_compatibility(uuid, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.taste_compatibility(uuid, uuid) TO authenticated;

COMMIT;
