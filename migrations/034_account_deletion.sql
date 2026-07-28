-- 034_account_deletion.sql
-- Account deletion with 30-day grace period and reactivation

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

-- Hide deleted users from listings
CREATE OR REPLACE FUNCTION public.profile_visible_to_viewer(owner_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_visibility text;
  v_deleted timestamptz;
  viewer_id uuid;
BEGIN
  viewer_id := auth.uid();

  SELECT visibility, deleted_at INTO v_visibility, v_deleted
  FROM public.users WHERE id = owner_user_id;

  -- Deleted users are invisible
  IF v_deleted IS NOT NULL THEN
    RETURN false;
  END IF;

  IF v_visibility IS NULL OR v_visibility = 'public' THEN
    RETURN true;
  END IF;

  IF v_visibility = 'private' THEN
    RETURN viewer_id = owner_user_id;
  END IF;

  IF v_visibility = 'followers' AND viewer_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_connections
      WHERE follower_id = viewer_id AND followed_id = owner_user_id
    );
  END IF;

  RETURN false;
END;
$$;

-- RLS update: deleted users shouldn't show in public listings
DROP POLICY IF EXISTS "users_select_public" ON public.users;
CREATE POLICY "users_select_public" ON public.users
  FOR SELECT
  USING (deleted_at IS NULL);

COMMIT;
