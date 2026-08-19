-- 082_a_deleted_user_can_still_reach_their_own_row.sql
-- Prerequisite for the purge cron. Do not apply the purge without this.
--
-- 034 replaced the users SELECT policy with:
--   CREATE POLICY "users_select_public" ON public.users
--     FOR SELECT USING (deleted_at IS NULL);
-- and it is the only SELECT policy on the table. It has no `auth.uid() = id`
-- escape, so the one group of people it hides the row from is exactly the group
-- that needs to read it: users who have scheduled their own deletion.
--
-- Two things break as a direct result, and both matter more once a purge job
-- exists to make the deletion real:
--
--   1. /api/account/reactivate opens with
--        select deleted_at, deletion_scheduled_at from users where id = userId
--      which returns null for precisely those users, so it answers
--      "Account is not scheduled for deletion" and refuses. The 30-day grace
--      period the delete route promises in writing has never been usable.
--
--   2. src/utils/supabase/middleware.ts reads `username, deleted_at` to decide
--      where to send someone. It gets null, so `profile?.deleted_at` is
--      undefined, the account-deleted redirect never fires, and
--      `!profile?.username` is true — dropping the user into /app/welcome
--      onboarding instead of telling them their account is scheduled for
--      deletion. An infinite loop with a false explanation.
--
-- Adding the purge without this would turn a 30-day window nobody can escape
-- into a 30-day countdown nobody can escape, and then delete everything at the
-- end of it. The escape hatch has to work before the trapdoor does.
--
-- Widening the policy exposes a deleted user's own row to that user alone.
-- Nothing else changes: `profile_visible_to_viewer` reads this table as
-- SECURITY DEFINER and so never consulted the policy anyway, and every other
-- viewer still sees only rows with deleted_at IS NULL.
--
-- Idempotent: drop and recreate.

BEGIN;

DROP POLICY IF EXISTS "users_select_public" ON public.users;

CREATE POLICY "users_select_public" ON public.users
  FOR SELECT
  USING (deleted_at IS NULL OR auth.uid() = id);

COMMIT;
