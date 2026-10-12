-- 123_watched_closes_a_pass.sql
--
-- A pass (title_recommendations — a title someone passed you, or an answer to
-- an ask) closes when you watch it, and the person who passed it hears so,
-- once: 097's `close_recommendations_on_viewing`, on a new diary entry.
--
-- Since the marks (5 Oct 2026) a tap on Watched — and Finished for a series —
-- makes no diary entry: it says "seen", not "seen today". So a pass you'd
-- marked watched stayed open: still "waiting for you" on Home and in Up
-- next, and its sender never heard. Asks closed the same way, so "the one you
-- suggested — they watched it" never arrived either.
--
-- Now the status closes it too: when a title's status becomes watched, every
-- open pass of it to you closes, and each sender gets one
-- `recommendation_watched` (unless either has blocked the other), exactly as
-- a logged viewing does. A later diary entry finds nothing open and says
-- nothing more. `watched_viewing_id` stays null: there's no entry to point at.
--
-- Idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION public.close_recommendations_on_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'watched' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'watched' THEN
    RETURN NULL;
  END IF;

  FOR r IN
    UPDATE public.title_recommendations t
       SET watched_at = now()
     WHERE t.to_user_id = NEW.user_id
       AND t.item_id = NEW.item_id
       AND t.item_type = NEW.item_type
       AND t.watched_at IS NULL
    RETURNING t.id, t.from_user_id, t.to_user_id, t.item_id, t.item_type, t.item_name, t.image_url
  LOOP
    IF NOT public.is_blocked(r.from_user_id, r.to_user_id) THEN
      INSERT INTO public.notifications (user_id, notification_type, actor_id, target_type, target_id, metadata)
      VALUES (
        r.from_user_id, 'recommendation_watched', r.to_user_id, 'recommendation', r.id,
        jsonb_build_object('item_id', r.item_id, 'item_type', r.item_type,
                           'item_name', r.item_name, 'image_url', r.image_url)
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_recommendations_on_status() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_close_recommendations_on_status ON public.user_media_status;
CREATE TRIGGER trg_close_recommendations_on_status
AFTER INSERT OR UPDATE OF status ON public.user_media_status
FOR EACH ROW EXECUTE FUNCTION public.close_recommendations_on_status();

-- Backfill: passes still open for titles already marked watched. Closed
-- quietly — these are old news, and a burst of "they watched it" for things
-- seen weeks ago would be noise, not a loop closing.
UPDATE public.title_recommendations t
   SET watched_at = now()
  FROM public.user_media_status s
 WHERE t.watched_at IS NULL
   AND s.user_id = t.to_user_id
   AND s.item_id = t.item_id
   AND s.item_type = t.item_type
   AND s.status = 'watched';

COMMIT;
