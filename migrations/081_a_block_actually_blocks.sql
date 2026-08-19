-- 081_a_block_actually_blocks.sql
-- Blocking someone changed almost nothing at the database level.
--
-- ── Part 1: the block was never in the visibility predicate ────────────────
--
-- `profile_visible_to_viewer` is the single predicate that gates SELECT on
-- watched_items (019), favorite_items (019), user_ratings (019),
-- user_media_status (029), takes (065), user_activity (025), watched_episodes
-- (073) and more. It has never consulted `user_blocks`.
--
-- The audit found this as "blocking does not remove their follow, so they keep
-- followers-level access". That is true and it is the smaller half. The larger
-- half is that for a **public** profile the predicate returns true to everyone,
-- so a block bought no RLS protection at all — the person you blocked could
-- read your diary dates, your ratings and your takes straight off PostgREST
-- with the publishable key, block or no block. The app-level filtering in
-- src/utils/blocks.ts only ever cleaned up the feed, the comments and search;
-- it cannot defend a table.
--
-- A block is mutual here, because `is_blocked` (032) already checks both
-- directions. That is the right semantic: neither party sees the other.
--
-- Two details in the rewrite below:
--   * The owner short-circuits to true before the block test. You can always
--     see your own rows, and `is_blocked(x, x)` is impossible anyway given
--     032's CHECK(blocker_id <> blocked_id), but the ordering makes it explicit.
--   * The block test is skipped when there is no viewer. An anonymous caller
--     cannot be blocked, and `is_blocked(NULL, owner)` would just cost a
--     pointless index probe on every public row read.
--
-- This also restores `SET search_path = public`, which 018 set deliberately
-- (its filename is `..._robust`) and 034 silently dropped when it rewrote the
-- function to add the deleted-account check. It is the predicate the entire RLS
-- layer is built on; it should not be resolving `users` through a caller's
-- search_path.
--
-- Cost: one extra indexed lookup per row read, for signed-in viewers only.
-- `user_blocks` carries UNIQUE(blocker_id, blocked_id) plus an index on each
-- column (032), so both sides of is_blocked's OR are covered.
--
-- ── Part 2: the cleanup could not delete the row that mattered ─────────────
--
-- /api/user/block ran its connection cleanup on the BLOCKER's own client:
--   .delete()
--   .or(`follower_id.eq.${userId},followed_id.eq.${userId}`)
--   .or(`follower_id.eq.${profileId},followed_id.eq.${profileId}`)
-- The filter logic is right. The permission is not: the only DELETE policy is
-- `user_connections_delete_self USING (auth.uid() = follower_id)`, and on the
-- row where the blocked user follows the blocker, follower_id is the OTHER
-- person. RLS filtered it out, PostgREST returned 200 having deleted nothing,
-- and the route never looked at the count. So the block "succeeded" and left
-- the follow in place.
--
-- `block_user` does the whole operation as one authorised unit. Part 1 means a
-- surviving connection row would no longer grant access anyway — but leaving a
-- follower attached to someone who blocked them is wrong on its own terms, and
-- two defences are the point.
--
-- Removing the string-built `.or()` filters also removes the one place in this
-- codebase where a caller-supplied id was interpolated into a PostgREST filter
-- expression.
--
-- Idempotent: create or replace; the insert is ON CONFLICT DO NOTHING and the
-- deletes are naturally re-runnable.

BEGIN;

CREATE OR REPLACE FUNCTION public.profile_visible_to_viewer(owner_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visibility text;
  v_deleted timestamptz;
  viewer_id uuid;
BEGIN
  viewer_id := auth.uid();

  SELECT visibility, deleted_at INTO v_visibility, v_deleted
  FROM public.users WHERE id = owner_user_id;

  -- Deleted users are invisible.
  IF v_deleted IS NOT NULL THEN
    RETURN false;
  END IF;

  -- You can always see your own.
  IF viewer_id IS NOT NULL AND viewer_id = owner_user_id THEN
    RETURN true;
  END IF;

  -- A block beats visibility, including 'public', and cuts both ways.
  IF viewer_id IS NOT NULL AND public.is_blocked(viewer_id, owner_user_id) THEN
    RETURN false;
  END IF;

  IF v_visibility IS NULL OR v_visibility = 'public' THEN
    RETURN true;
  END IF;

  -- Private: only the owner, and the owner already returned above.
  IF v_visibility = 'private' THEN
    RETURN false;
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

/**
 * Block someone, and actually sever the relationship.
 *
 * SECURITY DEFINER because the caller cannot delete the row where the other
 * person follows them — that is the whole bug. The caller is pinned to
 * auth.uid(); there is no parameter for "who is blocking", so this cannot be
 * pointed at anybody else's relationships.
 */
CREATE OR REPLACE FUNCTION public.block_user(p_blocked uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'You have to be signed in to block someone.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_blocked IS NULL OR p_blocked = v_me THEN
    RAISE EXCEPTION 'You cannot block yourself.' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_blocked) THEN
    RAISE EXCEPTION 'No such account.' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (v_me, p_blocked)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Both directions, which is what the route could not do.
  DELETE FROM public.user_connections
   WHERE (follower_id = v_me       AND followed_id = p_blocked)
      OR (follower_id = p_blocked  AND followed_id = v_me);

  DELETE FROM public.user_follow_requests
   WHERE (sender_id = v_me      AND receiver_id = p_blocked)
      OR (sender_id = p_blocked AND receiver_id = v_me);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated, service_role;

COMMIT;
