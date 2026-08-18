-- 069_stats_cannot_drift.sql
-- Make the profile counters a consequence of the rows, not a promise each
-- write path has to keep.
--
-- `user_cout_stats` is denormalised and was maintained by every caller
-- remembering to call recount_user_stats. That held until a new write path
-- appeared: the favourite-implies-watched rule wrote user_media_status
-- directly, and the discover directory then showed accounts with four
-- favourites and nothing watched — stored watched_count 0 against an actual 4.
--
-- Remembering is not a mechanism. A trigger is.
--
-- STATEMENT level with transition tables, not FOR EACH ROW. The import applies
-- rows in chunks and the episode modal marks a whole series at once; a per-row
-- trigger would run a COUNT(*) over the user's history for every row in the
-- batch. Per statement it runs once per affected user however large the batch.

BEGIN;

/**
 * SECURITY DEFINER is required, not decorative: user_cout_stats has RLS with a
 * self-only modify policy, and this has to write a row that belongs to whoever
 * the affected user is — which for an admin or a service-role backfill is not
 * the caller.
 */
CREATE OR REPLACE FUNCTION public.sync_user_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM affected_users WHERE user_id IS NOT NULL LOOP
    PERFORM public.recount_user_stats(r.user_id);
  END LOOP;
  RETURN NULL;
END;
$$;

-- Two transition tables cannot be referenced by one trigger in the same
-- statement, so inserts/updates and deletes get their own — `new_rows` for
-- what arrived, `old_rows` for what left. An UPDATE that moved a row between
-- users is covered because both fire.

-- ── user_media_status: drives watched_count and watchlist_count ─────────────
DROP TRIGGER IF EXISTS sync_stats_ums_ins ON public.user_media_status;
CREATE TRIGGER sync_stats_ums_ins
AFTER INSERT ON public.user_media_status
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

DROP TRIGGER IF EXISTS sync_stats_ums_upd_new ON public.user_media_status;
CREATE TRIGGER sync_stats_ums_upd_new
AFTER UPDATE ON public.user_media_status
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

DROP TRIGGER IF EXISTS sync_stats_ums_upd_old ON public.user_media_status;
CREATE TRIGGER sync_stats_ums_upd_old
AFTER UPDATE ON public.user_media_status
REFERENCING OLD TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

DROP TRIGGER IF EXISTS sync_stats_ums_del ON public.user_media_status;
CREATE TRIGGER sync_stats_ums_del
AFTER DELETE ON public.user_media_status
REFERENCING OLD TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

-- ── favorite_items: drives favorites_count ──────────────────────────────────
DROP TRIGGER IF EXISTS sync_stats_fav_ins ON public.favorite_items;
CREATE TRIGGER sync_stats_fav_ins
AFTER INSERT ON public.favorite_items
REFERENCING NEW TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

DROP TRIGGER IF EXISTS sync_stats_fav_del ON public.favorite_items;
CREATE TRIGGER sync_stats_fav_del
AFTER DELETE ON public.favorite_items
REFERENCING OLD TABLE AS affected_users
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();

-- One reconciliation now, so the triggers start from the truth rather than
-- from whatever the counters last happened to say.
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id FROM public.users LOOP
    PERFORM public.recount_user_stats(u.id);
  END LOOP;
END;
$$;

COMMIT;
