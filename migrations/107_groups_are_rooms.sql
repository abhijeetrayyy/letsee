-- 107_groups_are_rooms.sql
-- A club is a group room, and a group room can decide tonight together.
--
-- ── Why ────────────────────────────────────────────────────────────────────
-- Clubs move into People as group rooms (docs/design/RETHINK.md §5, EXECUTION
-- step 4): the people you watch with in threes and fours, not only in twos.
-- A group room's *Decide tonight* opens Tonight with its members, and the
-- session it starts belongs to the group, so the group can see what it
-- decided. Members of a club need not follow one another; being in the same
-- club is the connection (enforced in POST /api/tonight).
--
-- ── Shape ──────────────────────────────────────────────────────────────────
-- One nullable column. Sessions started outside a club keep NULL. Deleting a
-- club keeps its sessions (they are the participants' history) and forgets
-- the link.
--
-- Idempotent.

BEGIN;

ALTER TABLE public.watch_sessions
  ADD COLUMN IF NOT EXISTS club_id bigint REFERENCES public.clubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS watch_sessions_club_idx ON public.watch_sessions USING btree (club_id, created_at DESC) WHERE club_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'watch_sessions' AND column_name = 'club_id'
  ) THEN
    RAISE EXCEPTION 'watch_sessions.club_id is missing';
  END IF;
  RAISE NOTICE 'verified: watch_sessions.club_id in place';
END $$;

COMMIT;
