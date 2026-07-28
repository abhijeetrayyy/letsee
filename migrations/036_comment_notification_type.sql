-- 036_comment_notification_type.sql
BEGIN;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN ('follow_request','follow_accepted','like','friend_watched','friend_reviewed','friend_rated','comment_reply','dm_received'));
COMMIT;
