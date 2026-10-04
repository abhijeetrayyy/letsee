-- 115_only_public_profiles_follow_instantly.sql
-- Following a profile that isn't public takes their yes.
--
-- `user_connections_insert_self` checked who was following and that neither
-- had blocked the other — not whom. Whether a follow connected at once or
-- went into `user_follow_requests` was decided in the browser, from a
-- visibility value the caller passed to `followUser`; a Follow button given no
-- visibility defaulted to "public" (the welcome page's did), and a hand-made
-- insert needed no button at all. So anyone could follow a followers-only
-- profile without asking, and from then on read what it shows its followers.
--
-- The insert now also requires the followed profile to be public. Accepting a
-- request still connects people, because `accept_follow_request` (080) is a
-- definer function and writes the row past this policy. The client falls back
-- to a request when this refuses (src/utils/followerAction.ts).
--
-- Every profile is public today and no existing follow is touched.
--
-- Idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION public.profile_is_public(p_user uuid)
RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = p_user AND u.visibility::text = 'public' AND u.deleted_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.profile_is_public(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_is_public(uuid) TO authenticated;

DROP POLICY IF EXISTS user_connections_insert_self ON public.user_connections;
CREATE POLICY user_connections_insert_self ON public.user_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND NOT public.is_blocked(follower_id, followed_id)
    AND public.profile_is_public(followed_id)
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'user_connections_insert_self' AND polrelid = 'public.user_connections'::regclass) THEN
    RAISE EXCEPTION 'user_connections_insert_self is missing';
  END IF;
  RAISE NOTICE 'verified: instant follows only for public profiles; requests still accepted through accept_follow_request';
END $$;

COMMIT;
