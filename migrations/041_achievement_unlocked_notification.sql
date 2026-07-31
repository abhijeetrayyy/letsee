-- 041_achievement_unlocked_notification.sql
-- Surfaces the 18 achievements seeded in 033 (fully built, never wired up
-- anywhere in the app) with a notification on unlock.
--
-- Also fixes a real bug in the original award_achievement(): it inserts into
-- user_achievements but was never marked SECURITY DEFINER, and
-- user_achievements has no INSERT RLS policy at all (only SELECT/UPDATE) --
-- so calling it via RPC from a normal authenticated session would have
-- failed outright. Making it SECURITY DEFINER here fixes that.

BEGIN;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'follow_request','follow_accepted','like','friend_watched','friend_reviewed',
    'friend_rated','comment_reply','dm_received','new_follower',
    'friend_started_watching','achievement_unlocked'
  ));

CREATE OR REPLACE FUNCTION public.award_achievement(
  p_user_id UUID,
  p_achievement_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_icon TEXT;
BEGIN
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  IF FOUND THEN
    SELECT name, icon INTO v_name, v_icon FROM public.achievements WHERE id = p_achievement_id;

    INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, metadata)
    VALUES (
      p_user_id, p_user_id, 'achievement_unlocked', 'achievement',
      jsonb_build_object('achievement_id', p_achievement_id, 'name', v_name, 'icon', v_icon)
    );
  END IF;
END;
$$;

COMMIT;
