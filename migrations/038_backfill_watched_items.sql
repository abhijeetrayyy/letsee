-- 038_backfill_watched_items.sql
-- Backfill: for records in user_media_status with status='watched' that have no
-- corresponding row in watched_items, insert into watched_items so they appear in
-- the film grid, diary, reviews, and stats sections.

BEGIN;

INSERT INTO public.watched_items (user_id, item_id, item_type, item_name, image_url, item_adult, genres, is_watched, watched_at)
SELECT
  ums.user_id,
  ums.item_id,
  ums.item_type,
  ums.item_name,
  ums.image_url,
  ums.item_adult,
  ums.genres,
  true,
  ums.updated_at
FROM public.user_media_status ums
WHERE ums.status = 'watched'
  AND NOT EXISTS (
    SELECT 1 FROM public.watched_items wi
    WHERE wi.user_id = ums.user_id AND wi.item_id = ums.item_id
  );

COMMIT;
