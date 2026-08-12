-- 042_block_enforcement.sql
-- Enforce user blocks at the RLS layer.
--
-- Why this must be RLS and not app code: the app inserts into `messages`
-- directly from the browser with the anon key (src/components/message/sendCard.tsx
-- and src/app/app/messages/[id]/page.tsx). Any check living in a React component
-- or a route handler is cosmetic — a blocked user can open devtools and insert
-- the row themselves. The same applies to follows, which are inserted client-side
-- from src/utils/followerAction.ts.
--
-- Uses the existing is_blocked(viewer, profile) helper from
-- 032_user_blocks_and_reports.sql, which is STABLE SECURITY DEFINER and already
-- checks the block in both directions.

BEGIN;

-- ── messages ────────────────────────────────────────────────────────────────
-- Previously: WITH CHECK (auth.uid() = sender_id) — no block check at all.
DROP POLICY IF EXISTS messages_insert_sender ON public.messages;

CREATE POLICY messages_insert_sender ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_blocked(sender_id, recipient_id)
  );

-- ── follows ─────────────────────────────────────────────────────────────────
-- A blocked user should not be able to follow you either.
DROP POLICY IF EXISTS user_connections_insert_self ON public.user_connections;

CREATE POLICY user_connections_insert_self ON public.user_connections
  FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND NOT public.is_blocked(follower_id, followed_id)
  );

-- ── follow requests ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS user_follow_requests_insert_sender ON public.user_follow_requests;

CREATE POLICY user_follow_requests_insert_sender ON public.user_follow_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_blocked(sender_id, receiver_id)
  );

COMMIT;
