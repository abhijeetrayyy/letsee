-- 070_messages_realtime.sql
-- Turn on the thing the chat UI has always assumed was on.
--
-- Measured before writing this: a client subscribes to postgres_changes on
-- public.messages, gets SUBSCRIBED, and then receives nothing — zero INSERT
-- events and zero UPDATE events for a real insert, update and delete. So no
-- message has ever arrived live. Every conversation needed a reload, and the
-- unread badge, which learned about reads only through a realtime UPDATE,
-- could never learn about them at all.
--
-- Two separate things are required and only one is obvious.

BEGIN;

-- 1. The table has to be in the publication realtime reads from.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END;
$$;

/**
 * 2. REPLICA IDENTITY FULL, or UPDATE and DELETE events arrive without the old
 * row. The default (primary key only) is enough to say "a row changed" and not
 * enough to say WHICH conversation it belonged to — and every subscription in
 * this app filters on recipient_id, so without this the client cannot tell a
 * read receipt for its own thread from one for somebody else's and would have
 * to re-query on every unrelated change.
 *
 * It costs more WAL per update. On a direct-message table where updates are
 * "mark as read" that is a trade worth making.
 */
ALTER TABLE public.messages REPLICA IDENTITY FULL;

/**
 * One row per conversation, correct at any volume.
 *
 * The inbox derived its list by scanning the newest 500 messages in
 * application code, which means a conversation silently disappears from the
 * inbox once 500 newer messages exist — not "loads slowly", disappears. It is
 * also four round trips of post-processing for something one DISTINCT ON does.
 *
 * Invoker rights on purpose, NOT security definer: messages_select_participants
 * already restricts rows to the two people in the conversation, and this must
 * inherit that rather than bypass it.
 */
CREATE OR REPLACE FUNCTION public.conversation_list(p_user uuid)
RETURNS TABLE (
  partner_id uuid,
  last_content text,
  last_message_type text,
  last_at timestamptz,
  last_from_me boolean,
  unread int
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH mine AS (
    SELECT m.*,
           CASE WHEN m.sender_id = p_user THEN m.recipient_id ELSE m.sender_id END AS partner
    FROM public.messages m
    WHERE m.sender_id = p_user OR m.recipient_id = p_user
  ),
  latest AS (
    SELECT DISTINCT ON (partner) partner, content, message_type, created_at, sender_id
    FROM mine
    ORDER BY partner, created_at DESC
  ),
  counts AS (
    SELECT partner, COUNT(*)::int AS unread
    FROM mine
    WHERE recipient_id = p_user AND is_read = false
    GROUP BY partner
  )
  SELECT l.partner,
         l.content,
         l.message_type::text,
         l.created_at,
         l.sender_id = p_user,
         COALESCE(c.unread, 0)
  FROM latest l
  LEFT JOIN counts c ON c.partner = l.partner
  WHERE l.partner <> p_user
  ORDER BY l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.conversation_list(uuid) TO authenticated;

COMMIT;
