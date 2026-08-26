-- 087_the_thread_updates_itself.sql
--
-- `public.comments` is not in the `supabase_realtime` publication, so the two
-- components that render a discussion — `TitleTalk` on every movie, series,
-- season and episode page, and `Comments` on club pages, review permalinks and
-- the club-pick widget — could only show a reply after a reload.
--
-- This is the third time this exact gap has been closed. 070 added
-- `public.messages` and its header explains the failure mode: a channel that
-- reports SUBSCRIBED and then delivers nothing, forever, because the table it
-- watches is not published. 079 found the same thing for `notifications` and
-- `user_follow_requests`, where two subscriptions had been live in the code and
-- inert in production for their whole existence.
--
-- `reactions` gets it too: a like count that only moves on reload is the same
-- bug wearing a different number, and `LikeButton` renders beside every
-- comment this migration is making live.
--
-- REPLICA IDENTITY FULL, for the reason 070 gives about messages: the client
-- subscribes with `filter: item_id=eq.<id>`, and the default replica identity
-- (primary key only) sends UPDATE and DELETE events without the old row — so a
-- deleted comment arrives as an event the client cannot attribute to the thread
-- it is watching, and the row stays on screen. Comments and reactions are small
-- and their updates are rare; the extra WAL is not a consideration here.
--
-- Idempotent: publication membership is checked before each ADD, and REPLICA
-- IDENTITY is declarative.

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['comments', 'reactions'] LOOP
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

ALTER TABLE public.comments  REPLICA IDENTITY FULL;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;

COMMIT;
