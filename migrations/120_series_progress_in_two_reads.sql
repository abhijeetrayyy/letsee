-- 120_series_progress_in_two_reads.sql
--
-- A profile's Series progress (api/profile/tv-progress) read every watched
-- episode an account had — 9,012 rows for one account, fetched a thousand at
-- a time, in order — only to learn which shows it had, on every page. Then it
-- read each show's episodes separately, three shows at a time with a pause in
-- between. With the database in Seoul and the function elsewhere, each of
-- those reads is a round trip: 4.5 s before the first show, 7–12 s a page.
--
-- Two reads replace them, both answered from the (user_id, show_id) indexes:
--
-- - tv_progress_shows: every show the account has, once — its status row if
--   there is one, else a show it only has episodes of.
-- - tv_progress_episodes: for the shows on one page, the episodes watched,
--   one row per season.
--
-- SECURITY INVOKER (the default), so the caller's RLS decides what comes back
-- exactly as it did for the table reads they replace. Nothing is stored or
-- changed.

BEGIN;

CREATE OR REPLACE FUNCTION public.tv_progress_shows(p_user uuid)
RETURNS TABLE (show_id text, status text, updated_at timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.item_id, s.status, s.updated_at
    FROM public.user_media_status s
   WHERE s.user_id = p_user AND s.item_type = 'tv'
  UNION ALL
  SELECT DISTINCT e.show_id, NULL::text, NULL::timestamptz
    FROM public.watched_episodes e
   WHERE e.user_id = p_user
     AND NOT EXISTS (
       SELECT 1 FROM public.user_media_status s
        WHERE s.user_id = p_user AND s.item_type = 'tv' AND s.item_id = e.show_id);
$$;

CREATE OR REPLACE FUNCTION public.tv_progress_episodes(p_user uuid, p_shows text[])
RETURNS TABLE (show_id text, season_number smallint, episodes smallint[])
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT e.show_id, e.season_number, array_agg(e.episode_number ORDER BY e.episode_number)
    FROM public.watched_episodes e
   WHERE e.user_id = p_user AND e.show_id = ANY (p_shows)
   GROUP BY e.show_id, e.season_number;
$$;

REVOKE ALL ON FUNCTION public.tv_progress_shows(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tv_progress_episodes(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tv_progress_shows(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tv_progress_episodes(uuid, text[]) TO anon, authenticated, service_role;

COMMIT;
