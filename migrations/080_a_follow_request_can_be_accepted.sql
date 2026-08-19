-- 080_a_follow_request_can_be_accepted.sql
-- Accepting a follow request has never worked, in any account, ever.
--
-- src/utils/followerAction.ts's acceptFollowRequest runs on the BROWSER client,
-- under the receiver's session, and does:
--   insert into user_connections (follower_id: senderId, followed_id: receiverId)
--
-- The only insert policy is 042's:
--   user_connections_insert_self
--     WITH CHECK (auth.uid() = follower_id AND NOT is_blocked(follower_id, followed_id))
--
-- The receiver's auth.uid() is the RECEIVER. The row's follower_id is the
-- SENDER. They are never equal, so the WITH CHECK fails every time. No trigger
-- creates the connection from an accepted request either — grepping the
-- migrations for user_follow_requests turns up 027 (the notification trigger)
-- and 042 (this policy), and nothing else.
--
-- The UI then hides it: notification/page.tsx does
--   const { error } = await acceptFollowRequest(...); if (!error) { ...remove }
-- so the button produces no connection, no state change, and no message.
--
-- And it is not recoverable. sendFollowRequest refuses to create a second
-- request while ANY row exists for the pair, and the failed accept never
-- changed the row, so the sender can never retry. Followers-only visibility is
-- therefore unreachable for anyone who was not already following.
--
-- ── Why a function ─────────────────────────────────────────────────────────
--
-- The insert has to be made by someone the policy will accept, and the person
-- clicking Accept is by definition not that someone. Widening the policy to
-- allow inserting a connection on another user's behalf would let anyone add
-- themselves as anyone's follower. So the write happens inside a SECURITY
-- DEFINER function that first proves the caller is the recipient of that exact
-- request.
--
-- ── The request row is DELETED, not marked accepted ────────────────────────
--
-- The old code set status='accepted' and kept the row. Because
-- sendFollowRequest blocks on the existence of any row regardless of status,
-- that would permanently prevent the pair from ever re-requesting after an
-- unfollow. Nothing reads status='accepted': FollowButton filters on
-- `status = 'pending'`, and the notification page lists rows by receiver. The
-- accepted state is `user_connections` — that is what the row becomes.
--
-- ── One notification, deliberately, and one that comes for free ────────────
--
-- The sender gets 'follow_accepted' — a type that has been in the constraint
-- since 037 with no producer anywhere. 037's trg_notify_new_follower also fires
-- on the connection insert and tells the receiver they have a new follower;
-- that is left alone, because "X started following you" immediately after you
-- accept X reads as confirmation rather than noise, and suppressing it would
-- mean special-casing a trigger that is otherwise correct.
--
-- Idempotent: create or replace, and the insert is ON CONFLICT DO NOTHING so a
-- double-click is harmless.

BEGIN;

CREATE OR REPLACE FUNCTION public.accept_follow_request(p_request_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender   uuid;
  v_receiver uuid;
BEGIN
  SELECT sender_id, receiver_id
    INTO v_sender, v_receiver
    FROM public.user_follow_requests
   WHERE id = p_request_id;

  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'That follow request no longer exists.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- The whole reason this function exists: prove the caller is the recipient
  -- before writing a connection they are not otherwise allowed to write.
  IF auth.uid() IS NULL OR v_receiver IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the person who received a request can accept it.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 042 put this check in the insert policy; the policy is being bypassed, so
  -- the check has to be carried here rather than lost with it.
  IF public.is_blocked(v_sender, v_receiver) THEN
    RAISE EXCEPTION 'That account is blocked.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.user_connections (follower_id, followed_id)
  VALUES (v_sender, v_receiver)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (user_id, actor_id, notification_type, created_at)
  VALUES (v_sender, v_receiver, 'follow_accepted', now());

  DELETE FROM public.user_follow_requests WHERE id = p_request_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_follow_request(bigint) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_follow_request(bigint) TO authenticated, service_role;

COMMIT;
