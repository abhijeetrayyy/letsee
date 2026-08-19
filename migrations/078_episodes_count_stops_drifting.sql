-- 078_episodes_count_stops_drifting.sql
-- 069 is called `stats_cannot_drift` and left the one counter that drifts.
--
-- `episodes_count` is derived from watched_episodes and from nothing else —
-- 054_remove_hours.sql:50-52:
--   select count(*) into v_episodes from public.watched_episodes
--    where user_id = p_user_id and season_number > 0;
--
-- 069 then installed six triggers: four on `user_media_status` and two on
-- `favorite_items`. None on `watched_episodes`. And no episode write path calls
-- recount_user_stats either — /api/watched-episode inserts the row and then
-- calls ensureShowInMediaStatus (which returns early when a status row already
-- exists) and autoTransitionStatus (which writes only when the status actually
-- changes). So ticking episode 5 of a show already marked `watching` performs
-- zero writes to user_media_status and fires zero triggers.
--
-- Net effect: the "Episodes" number on the profile hero, in the stats grid and
-- in the home sidebar only moved when the user happened to also change a show's
-- status, and un-ticking episodes never moved it down at all.
--
-- sync_user_stats() needs no changes — it loops `SELECT DISTINCT user_id FROM
-- affected_users`, and watched_episodes has a user_id column like the other two
-- tables. Statement-level with transition tables for the same reason 069 gives:
-- the episode modal and the importer both write in chunks, and a row-level
-- trigger would recount once per episode.
--
-- Idempotent: `drop trigger if exists` before each create. Ends with one
-- reconciliation pass so the counters start from the truth rather than from
-- whatever they drifted to.

BEGIN;

DROP TRIGGER IF EXISTS sync_stats_eps_ins ON public.watched_episodes;
CREATE TRIGGER sync_stats_eps_ins
AFTER INSERT ON public.watched_episodes
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

DROP TRIGGER IF EXISTS sync_stats_eps_upd_new ON public.watched_episodes;
CREATE TRIGGER sync_stats_eps_upd_new
AFTER UPDATE ON public.watched_episodes
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

DROP TRIGGER IF EXISTS sync_stats_eps_upd_old ON public.watched_episodes;
CREATE TRIGGER sync_stats_eps_upd_old
AFTER UPDATE ON public.watched_episodes
REFERENCING OLD TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

DROP TRIGGER IF EXISTS sync_stats_eps_del ON public.watched_episodes;
CREATE TRIGGER sync_stats_eps_del
AFTER DELETE ON public.watched_episodes
REFERENCING OLD TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

-- Reconcile once, so today's drift is cleared rather than frozen in place.
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id FROM public.users LOOP
    PERFORM public.recount_user_stats(u.id);
  END LOOP;
END $$;

COMMIT;
