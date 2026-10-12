-- 126_a_room_for_a_series.sql
--
-- A room for a series (docs/IDEAS_2026-10.md §6.1): a group watching one show
-- together — the buddy read, for television.
--
-- 1. A group's series: `clubs.series_id` / `series_name` / `series_image`,
--    set by the group's organisers (the existing `clubs_update_admin`). The
--    group room then shows where everyone is in it, from each member's own
--    episodes, under their profile's visibility as ever.
--
-- 2. Talk about one episode: `comments.season` / `comments.episode`. A
--    comment tagged with an episode stays closed for each reader until
--    they've reached it — a kindness, not a lock: comments are public (as
--    they were), the gate is in the room. Both or neither, and both above 0.
--
-- 3. The bell doesn't spoil it: a reply notification carries the first 100
--    characters of the reply (`comment_body`). For a comment tagged with an
--    episode it now carries "About S02 · E04" instead.
--
-- Idempotent.

BEGIN;

ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS series_id text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS series_name text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS series_image text;
ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_series_shape;
ALTER TABLE public.clubs ADD CONSTRAINT clubs_series_shape CHECK (
  (series_id IS NULL OR series_id ~ '^[0-9]+$')
  AND (series_name IS NULL OR char_length(series_name) BETWEEN 1 AND 200)
  AND (series_image IS NULL OR char_length(series_image) <= 500)
  AND ((series_id IS NULL) = (series_name IS NULL))
);

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS season smallint;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS episode smallint;
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_episode_shape;
ALTER TABLE public.comments ADD CONSTRAINT comments_episode_shape CHECK (
  (season IS NULL) = (episode IS NULL) AND (season IS NULL OR (season > 0 AND episode > 0))
);

CREATE OR REPLACE FUNCTION public.notify_comment_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parent_owner uuid;
  item_owner uuid;
  -- About an episode: the bell says which, never the words.
  said text := CASE
    WHEN NEW.season IS NOT NULL THEN
      'About S' || lpad(NEW.season::text, 2, '0') || ' · E' || lpad(NEW.episode::text, 2, '0')
    ELSE left(NEW.body, 100)
  END;
BEGIN
  -- Reply to a comment: tell the comment's author.
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner FROM public.comments WHERE id = NEW.parent_id;
    IF parent_owner IS NOT NULL AND parent_owner <> NEW.user_id
       AND NOT public.is_blocked(NEW.user_id, parent_owner) THEN
      INSERT INTO public.notifications (user_id, notification_type, actor_id, target_type, target_id, metadata)
      VALUES (parent_owner, 'comment_reply', NEW.user_id, 'comment', NEW.id,
              jsonb_build_object('comment_body', said,
                                 'item_id', NEW.item_id, 'item_type', NEW.item_type));
    END IF;
  END IF;

  -- Comment on a review: tell the review's author, unless already told above.
  IF NEW.item_type = 'review' THEN
    SELECT user_id INTO item_owner FROM public.watched_items WHERE id::text = NEW.item_id;
    IF item_owner IS NOT NULL AND item_owner <> NEW.user_id
       AND item_owner IS DISTINCT FROM parent_owner
       AND NOT public.is_blocked(NEW.user_id, item_owner) THEN
      INSERT INTO public.notifications (user_id, notification_type, actor_id, target_type, target_id, metadata)
      VALUES (item_owner, 'comment_reply', NEW.user_id, 'comment', NEW.id,
              jsonb_build_object('comment_body', said,
                                 'item_id', NEW.item_id, 'item_type', NEW.item_type));
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
