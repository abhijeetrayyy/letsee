-- 079_the_bell_and_the_follow_button_get_realtime.sql
-- 070 diagnosed this exact failure and fixed one of the three tables with it.
--
-- 070's header is a good post-mortem: a channel that reports SUBSCRIBED and
-- then delivers nothing forever, because the table was never added to the
-- publication realtime reads from. It added `public.messages`. It is also the
-- ONLY `ALTER PUBLICATION` in all 77 migrations.
--
-- Meanwhile:
--   src/components/header/NotificationBell.tsx:34-46 subscribes to
--     postgres_changes INSERT and UPDATE on `notifications`
--   src/components/profile/FollowButton.tsx:97-104 subscribes to
--     `user_follow_requests`
--
-- Neither table is in the publication, so neither subscription has ever fired.
-- The unread badge only moves on a full remount or via the one manual
-- `letsee:messages-read` window event, and follow-request state never updates
-- live — which is the second half of why the Accept button feels inert.
--
-- REPLICA IDENTITY FULL on notifications for the reason 070 gives about
-- messages: the UPDATE handler filters on user_id, and the default replica
-- identity (primary key only) sends UPDATE events without the old row, so the
-- client cannot tell whether a change belongs to it. Notifications are small
-- and their updates are "mark as read", so the extra WAL is cheap.
--
-- user_follow_requests gets it too: FollowButton reacts to status transitions,
-- and the same argument applies.
--
-- Idempotent: membership is checked before each ADD, and REPLICA IDENTITY is
-- declarative.

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications', 'user_follow_requests'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'added % to supabase_realtime', t;
    ELSE
      RAISE NOTICE '% already published', t;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.notifications        REPLICA IDENTITY FULL;
ALTER TABLE public.user_follow_requests REPLICA IDENTITY FULL;

COMMIT;
