-- 040_started_watching_activity.sql
-- "Started watching" is a much more frequent, more alive signal of "what your
-- friends are up to" than the existing completion-only events (watched/rated/
-- reviewed). user_media_status is upsert-only (no history), so the transition
-- must be captured as an event at write time via trigger, not derived later.
--
-- Revives user_activity (structurally correct already, just never used for
-- this) for exactly this one purpose -- watched/rated/reviewed/list_created
-- stay as direct queries in feed/following/route.ts, unchanged.

BEGIN;

ALTER TABLE public.user_activity DROP CONSTRAINT IF EXISTS user_activity_activity_type_check;
ALTER TABLE public.user_activity ADD CONSTRAINT user_activity_activity_type_check
  CHECK (activity_type IN ('watched', 'rated', 'reviewed', 'list_created', 'favored', 'started_watching'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'follow_request','follow_accepted','like','friend_watched','friend_reviewed',
    'friend_rated','comment_reply','dm_received','new_follower','friend_started_watching'
  ));

CREATE OR REPLACE FUNCTION public.notify_started_watching()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'watching' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'watching') THEN
    INSERT INTO public.user_activity (user_id, activity_type, item_id, item_type, item_name, image_url, created_at)
    VALUES (NEW.user_id, 'started_watching', NEW.item_id, NEW.item_type, NEW.item_name, NEW.image_url, NEW.updated_at);

    INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, target_id, metadata, created_at)
    SELECT
      c.follower_id,
      NEW.user_id,
      'friend_started_watching',
      NEW.item_type,
      NULL,
      jsonb_build_object('item_id', NEW.item_id, 'item_type', NEW.item_type, 'item_name', NEW.item_name, 'image_url', NEW.image_url),
      NEW.updated_at
    FROM public.user_connections c
    WHERE c.followed_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_started_watching
AFTER INSERT OR UPDATE ON public.user_media_status
FOR EACH ROW EXECUTE FUNCTION public.notify_started_watching();

COMMIT;
