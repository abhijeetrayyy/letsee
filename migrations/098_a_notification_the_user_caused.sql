-- 098_a_notification_the_user_caused.sql
-- The rule 092 applied was "a person addressing a person". The rule that
-- survives across every tracker that lasted — Letterboxd, Strava, Goodreads,
-- Duolingo — is one step wider: **only what the user caused.**
--
-- A title on your watchlist arriving on a service you pay for is something
-- you caused, twice: you saved it and you told us the service. It is the
-- number one reason people pay Letterboxd. A new episode of a show you are
-- mid-way through is Serializd's number one complaint. Somebody replying to
-- your take is a person addressing you — 092 said so itself and called the
-- restoration "four lines". docs/WHY_PEOPLE_COME_BACK.md §8, §9 Bet 5.
--
-- ── What is different from what 092 removed ────────────────────────────────
-- 092's cost argument was fan-out: `notify_friend_watched` wrote one row per
-- follower per title, so an import could write fifty thousand rows. Nothing
-- here fans out. The two cron-written kinds are computed *per user from that
-- user's own list* — a watchlist bounds its own notifications — and are
-- written at most once per user per day, as one row carrying every arrival.
-- The third is a trigger on `comments` that notifies exactly the people being
-- answered.
--
-- `notify_comment_reply` is 092's baseline body with one addition: it now
-- checks `is_blocked`, which the other notifiers already did.
--
-- `episode_announcements` is the daily job's memory, so it cannot re-announce
-- an episode. 092 dropped `notified_episodes` because its job was deleted;
-- this is the same idea under a name that says what it is. Service-role only.
--
-- Idempotent.

BEGIN;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'follow_request'::text, 'follow_accepted'::text, 'new_follower'::text, 'dm_received'::text,
    'co_log_invite'::text, 'recommendation_watched'::text,
    'comment_reply'::text, 'watchlist_available'::text, 'new_episode'::text
  ]));

-- ── Somebody answered you ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_comment_reply() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  parent_owner uuid;
  item_owner uuid;
BEGIN
  -- Reply to a comment: tell the comment's author.
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner FROM public.comments WHERE id = NEW.parent_id;
    IF parent_owner IS NOT NULL AND parent_owner <> NEW.user_id
       AND NOT public.is_blocked(NEW.user_id, parent_owner) THEN
      INSERT INTO public.notifications (user_id, notification_type, actor_id, target_type, target_id, metadata)
      VALUES (parent_owner, 'comment_reply', NEW.user_id, 'comment', NEW.id,
              jsonb_build_object('comment_body', left(NEW.body, 100),
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
              jsonb_build_object('comment_body', left(NEW.body, 100),
                                 'item_id', NEW.item_id, 'item_type', NEW.item_type));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment_reply ON public.comments;
CREATE TRIGGER trg_notify_comment_reply AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_reply();

-- ── The daily job's memory ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.episode_announcements (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    show_id text NOT NULL,
    season_number smallint NOT NULL,
    episode_number smallint NOT NULL,
    announced_on date NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT episode_announcements_pkey PRIMARY KEY (user_id, show_id, season_number, episode_number)
);

ALTER TABLE public.episode_announcements ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: nothing but the cron, which runs as service_role
-- and bypasses RLS, has any business here.
REVOKE ALL ON TABLE public.episode_announcements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.episode_announcements TO service_role;

-- ── Verify ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'notifications' AND c.conname = 'notifications_notification_type_check';
  IF v_def NOT LIKE '%comment_reply%' OR v_def NOT LIKE '%watchlist_available%' OR v_def NOT LIKE '%new_episode%' THEN
    RAISE EXCEPTION 'notification types not widened: %', v_def;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_comment_reply') THEN
    RAISE EXCEPTION 'trg_notify_comment_reply is missing';
  END IF;
  IF has_table_privilege('anon', 'public.episode_announcements', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read episode_announcements';
  END IF;
  RAISE NOTICE 'verified: nine notification kinds, replies notify, announcements are private';
END $$;

COMMIT;
