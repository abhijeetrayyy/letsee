-- 037_public_follow_autoaccept.sql
-- Public-profile follows now connect instantly (app-level change in
-- src/utils/followerAction.ts inserts straight into user_connections,
-- skipping user_follow_requests entirely). user_connections has no trigger
-- today, so an instant follow would otherwise generate zero notification
-- to the person being followed -- add one.

BEGIN;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'follow_request','follow_accepted','like','friend_watched','friend_reviewed',
    'friend_rated','comment_reply','dm_received','new_follower'
  ));

CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, notification_type, created_at)
  VALUES (NEW.followed_id, NEW.follower_id, 'new_follower', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_follower AFTER INSERT ON public.user_connections
FOR EACH ROW EXECUTE FUNCTION public.notify_new_follower();

COMMIT;
