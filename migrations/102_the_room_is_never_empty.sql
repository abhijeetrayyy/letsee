-- 102_the_room_is_never_empty.sql
-- What people near you are watching this week, for a feed that has nobody in
-- it yet.
--
-- ── Why ────────────────────────────────────────────────────────────────────
-- A new account with no follows sees "No activity to show yet." Untappd
-- designed three feeds so a brand-new user never saw an empty room; Slack's
-- stable network is three people. Until somebody has three follows, the home
-- feed shows what people in their region logged this week instead — a fact
-- about the place, not a recommendation (docs/WHY_PEOPLE_COME_BACK.md §9
-- Bet 11).
--
-- ── The floor ──────────────────────────────────────────────────────────────
-- Counts only, never names, and only titles at least `p_floor` distinct
-- people logged — the same k-anonymity rule 066 applied to `title_audience`,
-- for the same reason: at three users a title with one viewer is a person.
-- On this database it returns nothing today, which is the floor doing its job.
--
-- Callable signed out: the empty-room state is exactly where a signed-out
-- visitor lands too.
--
-- Idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION public.regional_watching(
  p_region text,
  p_days integer DEFAULT 7,
  p_floor integer DEFAULT 3,
  p_limit integer DEFAULT 12
)
RETURNS TABLE(item_id text, item_type text, item_name text, image_url text, viewers integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  WITH recent AS (
    SELECT v.item_id, v.item_type, v.user_id
      FROM public.viewings v
      JOIN public.users u ON u.id = v.user_id AND u.deleted_at IS NULL
     WHERE upper(u.watch_region) = upper(p_region)
       AND v.watched_on >= CURRENT_DATE - GREATEST(1, LEAST(p_days, 90))
  ),
  counted AS (
    SELECT r.item_id, r.item_type, count(DISTINCT r.user_id)::integer AS viewers
      FROM recent r
     GROUP BY r.item_id, r.item_type
    HAVING count(DISTINCT r.user_id) >= GREATEST(2, p_floor)
  )
  SELECT c.item_id, c.item_type,
         (SELECT s.item_name FROM public.user_media_status s
           WHERE s.item_id = c.item_id AND s.item_type = c.item_type AND s.item_name <> ''
           ORDER BY s.updated_at DESC LIMIT 1) AS item_name,
         (SELECT s.image_url FROM public.user_media_status s
           WHERE s.item_id = c.item_id AND s.item_type = c.item_type AND s.image_url IS NOT NULL
           ORDER BY s.updated_at DESC LIMIT 1) AS image_url,
         c.viewers
    FROM counted c
   ORDER BY c.viewers DESC, c.item_id
   LIMIT GREATEST(1, LEAST(p_limit, 48));
$$;

GRANT EXECUTE ON FUNCTION public.regional_watching(text, integer, integer, integer) TO anon, authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.regional_watching(text, integer, integer, integer)') IS NULL THEN
    RAISE EXCEPTION 'regional_watching is missing';
  END IF;
  RAISE NOTICE 'verified: regional_watching in place (returns nothing until %s people log a title)', 3;
END $$;

COMMIT;
