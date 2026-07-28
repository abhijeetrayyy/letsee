-- 030_drop_legacy_tables.sql
-- Drops old media interaction tables after data has been migrated to user_media_status
-- CAUTION: Run 029_unified_media_status.sql first and verify data integrity before running this.

BEGIN;

-- Drop old tables (CASCADE handles dependent objects)
DROP TABLE IF EXISTS public.user_watchlist CASCADE;
DROP TABLE IF EXISTS public.currently_watching CASCADE;
DROP TABLE IF EXISTS public.user_tv_list CASCADE;

-- watched_items stays — it now serves as diary/review storage (is_watched column is deprecated)
-- favorite_items stays — it's now the independent "like/heart" system
-- user_ratings stays — independent rating system

COMMIT;
