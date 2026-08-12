-- 046_fix_review_comment_notification.sql
-- Fix: commenting on someone's review never notified them.
--
-- notify_comment_reply (035) guards the review-owner branch with
--   item_owner != parent_owner
-- but parent_owner is NULL for a top-level comment, and in SQL `x != NULL`
-- evaluates to NULL rather than true — so the enclosing IF never ran. The
-- notification only fired for *replies* to an existing comment, which is the
-- rarer case; the primary one (someone comments on your review) was silent.
--
-- Fixed with IS DISTINCT FROM, which treats NULL as a real value.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_comment_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE parent_owner UUID; item_owner UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner FROM public.comments WHERE id = NEW.parent_id;
    IF parent_owner IS NOT NULL AND parent_owner != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, target_id, metadata)
      VALUES (parent_owner, NEW.user_id, 'comment_reply', 'comment', NEW.id,
              jsonb_build_object('comment_body', left(NEW.body, 100), 'item_id', NEW.item_id, 'item_type', NEW.item_type));
    END IF;
  END IF;

  IF NEW.item_type = 'review' THEN
    SELECT user_id INTO item_owner FROM public.watched_items WHERE id = NEW.item_id::bigint;
    -- IS DISTINCT FROM so a NULL parent_owner (top-level comment) still counts
    IF item_owner IS NOT NULL
       AND item_owner != NEW.user_id
       AND item_owner IS DISTINCT FROM parent_owner THEN
      INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, target_id, metadata)
      VALUES (item_owner, NEW.user_id, 'comment_reply', 'comment', NEW.id,
              jsonb_build_object('comment_body', left(NEW.body, 100), 'item_id', NEW.item_id, 'item_type', NEW.item_type));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
