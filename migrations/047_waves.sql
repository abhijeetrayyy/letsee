-- 047_waves.sql
-- The "wave": connecting with zero words.
--
-- Every social action LetSee currently offers costs exposure — write a review,
-- post a comment, or compose a DM. Even the pre-filled icebreaker still opens
-- a message box you have to press send on. For a lot of people that is the
-- barrier, and they lurk instead.
--
-- A wave is the rung below that: one tap, no text, no thread. The recipient
-- sees who waved and why the app thought they'd get along (the shared-title
-- evidence), and can wave back or open a conversation. It's the cheapest
-- possible signal of "I saw you and I'm interested" — and it's reciprocal, so
-- neither side has to be the one who speaks first.
--
-- Deliberately constrained: one wave per pair per direction (unique index),
-- so it can't be used to pester anyone. Waving again is a no-op, not a
-- second notification.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_waves (
  id bigserial PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_waves_no_self CHECK (sender_id <> recipient_id),
  CONSTRAINT user_waves_unique_pair UNIQUE (sender_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS user_waves_recipient_idx ON public.user_waves (recipient_id);

ALTER TABLE public.user_waves ENABLE ROW LEVEL SECURITY;

-- You can see waves you sent or received.
DROP POLICY IF EXISTS user_waves_select_participants ON public.user_waves;
CREATE POLICY user_waves_select_participants ON public.user_waves
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- You can only wave as yourself, and not across a block.
DROP POLICY IF EXISTS user_waves_insert_self ON public.user_waves;
CREATE POLICY user_waves_insert_self ON public.user_waves
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_blocked(sender_id, recipient_id)
  );

-- Withdrawing a wave is allowed (it's a low-stakes signal, not a commitment).
DROP POLICY IF EXISTS user_waves_delete_sender ON public.user_waves;
CREATE POLICY user_waves_delete_sender ON public.user_waves
  FOR DELETE USING (auth.uid() = sender_id);

-- ── Notification ────────────────────────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'follow_request', 'follow_accepted', 'like', 'friend_watched',
    'friend_reviewed', 'friend_rated', 'comment_reply', 'dm_received',
    'new_follower', 'friend_started_watching', 'achievement_unlocked',
    'wave'
  ]));

CREATE OR REPLACE FUNCTION public.notify_wave()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, notification_type, created_at)
  VALUES (NEW.recipient_id, NEW.sender_id, 'wave', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_wave ON public.user_waves;
CREATE TRIGGER trg_notify_wave AFTER INSERT ON public.user_waves
FOR EACH ROW EXECUTE FUNCTION public.notify_wave();

COMMIT;
