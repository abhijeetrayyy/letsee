-- 044_dm_notification.sql
-- Emit the `dm_received` notification.
--
-- The type has been in the notifications CHECK constraint since 027 but no
-- trigger ever produced it: someone could message you and you'd only find out
-- if you happened to open the app and notice the header badge. For a product
-- whose whole premise is strangers starting conversations, a message arriving
-- silently is the single worst notification gap.
--
-- Mirrors notify_new_follower from 037.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_dm_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Don't notify yourself, and don't fire across a block.
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;
  IF public.is_blocked(NEW.sender_id, NEW.recipient_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, notification_type, created_at)
  VALUES (NEW.recipient_id, NEW.sender_id, 'dm_received', now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_dm_received ON public.messages;
CREATE TRIGGER trg_notify_dm_received AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_dm_received();

COMMIT;
