-- 048_title_audience.sql
-- "N people here have seen this" — the zero-cost belonging signal.
--
-- Every other social affordance asks the user to do something: follow, wave,
-- comment, message. This one asks for nothing. It just tells you that you are
-- not alone on a title, and when the number is small it says so in a way that
-- makes the overlap feel like a find rather than a statistic.
--
-- Reads user_title_affinity (043), which is REVOKEd from clients, so this has
-- to be SECURITY DEFINER. It returns only aggregate counts plus the usernames
-- of *public* profiles — never anything private.

BEGIN;

CREATE OR REPLACE FUNCTION public.title_audience(
  p_item_id text,
  p_item_type text,
  p_viewer uuid DEFAULT NULL
)
RETURNS TABLE (
  viewers int,
  total_users int,
  sample jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH watchers AS (
    SELECT a.user_id
    FROM user_title_affinity a
    WHERE a.item_id = p_item_id
      AND a.item_type = p_item_type
      AND (p_viewer IS NULL OR a.user_id <> p_viewer)
      AND NOT public.is_blocked(COALESCE(p_viewer, a.user_id), a.user_id)
  ),
  visible AS (
    SELECT u.id, u.username, u.avatar_url
    FROM watchers w
    JOIN users u ON u.id = w.user_id
    WHERE u.visibility = 'public' AND u.username IS NOT NULL AND u.username <> ''
  )
  SELECT
    (SELECT count(*)::int FROM watchers),
    (SELECT count(DISTINCT a.user_id)::int FROM user_title_affinity a),
    COALESCE(
      (SELECT jsonb_agg(x) FROM (
        SELECT id AS "userId", username, avatar_url AS "avatarUrl"
        FROM visible
        LIMIT 5
      ) x),
      '[]'::jsonb
    );
$$;

GRANT EXECUTE ON FUNCTION public.title_audience(text, text, uuid) TO authenticated, anon;

COMMIT;
