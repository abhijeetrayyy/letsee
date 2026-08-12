-- 045_activity_backfill_and_rated.sql
-- Make user_activity the single source of truth for the activity feed.
--
-- Context: the feed in src/app/api/feed/following/route.ts merges four live
-- queries (watched_items, user_ratings, user_lists, user_activity) in Node and
-- sorts them together. Its cursor is only applied to the watched_items query,
-- so page 2+ re-returns the same ratings/lists rows, and older ones are
-- unreachable. The fix is to read a single indexed table — user_activity
-- already has (user_id, created_at) and (created_at) indexes for exactly this.
--
-- But user_activity only started being written at migration 025 and was never
-- backfilled: 7 rows against 259 watched_items. Switching the feed to it
-- without this backfill would silently shrink the feed to almost nothing.
--
-- This migration:
--   1. Adds the missing `rated` trigger (the only feed type with no producer).
--   2. Backfills watched / reviewed / rated / list_created from the source
--      tables, skipping anything already logged.

BEGIN;

-- ── 1. The missing `rated` producer ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_rated_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_image text;
BEGIN
  -- Only log a genuinely new score, not every re-save of the same value.
  IF TG_OP = 'UPDATE' AND OLD.score IS NOT DISTINCT FROM NEW.score THEN
    RETURN NEW;
  END IF;

  SELECT item_name, image_url INTO v_name, v_image
  FROM public.user_media_status
  WHERE user_id = NEW.user_id AND item_id = NEW.item_id
  LIMIT 1;

  INSERT INTO public.user_activity
    (user_id, activity_type, item_id, item_type, item_name, image_url, score, created_at)
  VALUES
    (NEW.user_id, 'rated', NEW.item_id, NEW.item_type, v_name, v_image, NEW.score, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_rated_activity ON public.user_ratings;
CREATE TRIGGER trg_log_rated_activity
AFTER INSERT OR UPDATE ON public.user_ratings
FOR EACH ROW EXECUTE FUNCTION public.log_rated_activity();

-- ── 2. Backfill history ────────────────────────────────────────────────────

-- watched
INSERT INTO public.user_activity
  (user_id, activity_type, item_id, item_type, item_name, image_url, created_at)
SELECT w.user_id, 'watched', w.item_id, w.item_type, w.item_name, w.image_url, w.watched_at
FROM public.watched_items w
WHERE w.is_watched
  AND NOT EXISTS (
    SELECT 1 FROM public.user_activity a
    WHERE a.user_id = w.user_id AND a.item_id = w.item_id
      AND a.activity_type = 'watched'
  );

-- reviewed (public reviews only — review_text is the private diary)
INSERT INTO public.user_activity
  (user_id, activity_type, item_id, item_type, item_name, image_url, review_text, created_at)
SELECT w.user_id, 'reviewed', w.item_id, w.item_type, w.item_name, w.image_url,
       w.public_review_text, w.watched_at
FROM public.watched_items w
WHERE w.public_review_text IS NOT NULL
  AND w.public_review_text <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.user_activity a
    WHERE a.user_id = w.user_id AND a.item_id = w.item_id
      AND a.activity_type = 'reviewed'
  );

-- rated
INSERT INTO public.user_activity
  (user_id, activity_type, item_id, item_type, item_name, image_url, score, created_at)
SELECT r.user_id, 'rated', r.item_id, r.item_type, s.item_name, s.image_url, r.score,
       COALESCE(r.created_at, now())
FROM public.user_ratings r
LEFT JOIN public.user_media_status s
  ON s.user_id = r.user_id AND s.item_id = r.item_id
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_activity a
    WHERE a.user_id = r.user_id AND a.item_id = r.item_id
      AND a.activity_type = 'rated'
  );

-- list_created
INSERT INTO public.user_activity
  (user_id, activity_type, list_id, list_name, created_at)
SELECT l.user_id, 'list_created', l.id, l.name, l.created_at
FROM public.user_lists l
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_activity a
    WHERE a.user_id = l.user_id AND a.list_id = l.id
      AND a.activity_type = 'list_created'
  );

COMMIT;
