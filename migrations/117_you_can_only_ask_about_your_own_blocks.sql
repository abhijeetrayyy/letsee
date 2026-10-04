-- 117_you_can_only_ask_about_your_own_blocks.sql
-- `is_blocked(a, b)` answered for any two people, to anyone.
--
-- ── The leak ───────────────────────────────────────────────────────────────
--
-- `is_blocked` is SECURITY DEFINER, so it reads every row of `user_blocks`
-- past `user_blocks_self` (which shows a user only the blocks they placed),
-- and anon and authenticated both hold EXECUTE on it. A single
-- `rpc('is_blocked', { p_viewer_id: X, p_profile_id: Y })` therefore told
-- anyone with the publishable key whether X and Y had blocked each other, for
-- any X and Y. Two definer functions offered the same answer by another
-- route: `title_audience` and `reviews_for_title` take the viewer as a
-- parameter and drop everyone blocked with that viewer, so passing a
-- stranger's id and watching who vanished asked the same question.
--
-- ── Why not REVOKE ─────────────────────────────────────────────────────────
--
-- Four INSERT policies call it directly (messages, user_follow_requests,
-- user_connections, title_recommendations), and a policy runs with the
-- privileges of the role making the query (077's note). Revoking would have
-- meant rewriting those four policies and every app caller onto a second,
-- narrower function, and it would have left the two side doors above open.
--
-- ── What this does ─────────────────────────────────────────────────────────
--
-- When the request comes from the API as an end user (the `role` GUC is anon
-- or authenticated), the function only answers about a pair that includes
-- `auth.uid()`. For any other pair it raises 42501 instead of answering. That
-- makes anon's every question unanswerable, since anon has no uid. It reads
-- the `role` GUC, not `current_user`: inside a definer function
-- `current_user` is always the owner, while `role` still names whoever
-- PostgREST switched to.
--
-- Callers with no end user are unchanged: the service role (the crons,
-- `refresh_taste_neighbours` → `recompute_taste_neighbours`, admin-client
-- writes and the triggers they fire) and direct connections such as pg_cron
-- and migrations.
--
-- Two cases skip the guard and return false, because no block can exist there
-- and saying so reveals nothing: a NULL argument, and a self-pair. A self-pair
-- is blocked by `user_blocks_check`. It must not raise, because
-- `title_audience` and `reviews_for_title` call
-- `is_blocked(COALESCE(p_viewer, x), x)`, which becomes `(x, x)` for every
-- signed-out title page.
--
-- Raising rather than returning a fixed false is deliberate. A future definer
-- function that asks about two other people during a user's request then
-- fails loudly, instead of quietly treating a blocked pair as unblocked and
-- sending a notification, or making a match, across the block.
--
-- ── Every caller, checked against production on 2026-10-04 ────────────────
--
-- Pairs that include the caller (unchanged):
--   policies   messages_insert_sender, user_follow_requests_insert_sender,
--              user_connections_insert_self: (auth.uid() = sender/follower)
--              AND NOT is_blocked(that same id, other).
--              title_recommendations_insert_party: any row the rest of the
--              policy admits has auth.uid() as from or to.
--   functions  profile_visible_to_viewer, my_taste_neighbours, taste_pair_get,
--              room_companions, watch_companions, were_there_together,
--              accept_co_log, accept_follow_request: all pass auth.uid().
--   triggers   notify_dm_received (sender), notify_comment_reply (commenter),
--              close_recommendations_on_viewing (the viewing's owner),
--              notify_co_log_invite (the viewing's owner). Their rows can
--              only be written by that person (viewings_self,
--              viewing_companions_owner_all, comments_insert_self,
--              messages_insert_sender), or by definer functions that write as
--              auth.uid() (ensure_first_viewings, accept_co_log, answer_ask).
--   app        src/app/api/tonight/route.ts passes the caller's own id.
-- No end user (unchanged): recompute_taste_neighbours, which only the service
-- role can execute.
-- Caller-supplied viewer (now raises when the viewer isn't the caller):
--   title_audience, reviews_for_title. The app passes the signed-in user's id
--   (src/lib/db/room.ts) or null.
--
-- Idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_blocked(p_viewer_id uuid, p_profile_id uuid)
RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid;
BEGIN
  IF p_viewer_id IS NULL OR p_profile_id IS NULL OR p_viewer_id = p_profile_id THEN
    RETURN false;
  END IF;

  IF current_setting('role', true) IN ('anon', 'authenticated') THEN
    v_me := auth.uid();
    IF v_me IS NULL OR (v_me <> p_viewer_id AND v_me <> p_profile_id) THEN
      RAISE EXCEPTION 'You can only ask about blocks that involve you.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_blocks
     WHERE (blocker_id = p_viewer_id AND blocked_id = p_profile_id)
        OR (blocker_id = p_profile_id AND blocked_id = p_viewer_id)
  );
END $$;

COMMENT ON FUNCTION public.is_blocked(uuid, uuid) IS
  'Whether either user has blocked the other. From the API (anon/authenticated) it answers only about a pair that includes auth.uid() and raises 42501 otherwise — even when reached through another definer function. Service role and direct connections get every answer. See 117.';

DO $$
DECLARE
  v_raised boolean := false;
BEGIN
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM public.is_blocked(gen_random_uuid(), gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := true;
  END;
  PERFORM set_config('role', 'none', true);

  IF NOT v_raised THEN
    RAISE EXCEPTION 'is_blocked still answers a signed-out caller about two strangers';
  END IF;
  IF public.is_blocked(gen_random_uuid(), gen_random_uuid()) THEN
    RAISE EXCEPTION 'is_blocked reports a block between two ids that do not exist';
  END IF;
  RAISE NOTICE 'verified: is_blocked answers the API only about the caller''s own pairs';
END $$;

COMMIT;
