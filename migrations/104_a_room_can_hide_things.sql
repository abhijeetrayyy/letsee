-- 104_a_room_can_hide_things.sql
-- Hide something in a room, for yourself only.
--
-- ── Why ────────────────────────────────────────────────────────────────────
-- A room is everything between two people: messages, the films you watched
-- together, the films you passed each other (docs/design/RETHINK.md §5). Some
-- of that you would rather not keep seeing — a pass you'll never get to, a
-- message sent in the wrong mood. Deleting would change the other person's
-- room too; hiding changes only yours (EXECUTION.md, step 4).
--
-- ── Shape ──────────────────────────────────────────────────────────────────
-- One row per hidden event: whose room it is hidden from, what kind of event
-- (`message`, `together` — a viewing — or `pass`), and its id as text, since
-- message ids are uuids and the others are bigints. Readable and writable by
-- its owner only; nobody else can learn what you hid.
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.room_hidden_events (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_kind text NOT NULL,
    event_id text NOT NULL,
    hidden_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT room_hidden_events_pkey PRIMARY KEY (user_id, event_kind, event_id),
    CONSTRAINT room_hidden_events_kind_check CHECK (event_kind IN ('message', 'together', 'pass')),
    CONSTRAINT room_hidden_events_id_check CHECK (length(event_id) BETWEEN 1 AND 64)
);

ALTER TABLE public.room_hidden_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_hidden_events_self ON public.room_hidden_events;
CREATE POLICY room_hidden_events_self ON public.room_hidden_events
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Signed-out visitors have no room to hide anything in.
REVOKE ALL ON TABLE public.room_hidden_events FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.room_hidden_events TO authenticated;

DO $$
DECLARE
  v_policies integer;
BEGIN
  IF to_regclass('public.room_hidden_events') IS NULL THEN
    RAISE EXCEPTION 'room_hidden_events is missing';
  END IF;
  SELECT count(*) INTO v_policies FROM pg_policies WHERE schemaname = 'public' AND tablename = 'room_hidden_events';
  IF v_policies <> 1 THEN
    RAISE EXCEPTION 'room_hidden_events should have exactly one policy, has %', v_policies;
  END IF;
  RAISE NOTICE 'verified: room_hidden_events in place, self-only';
END $$;

COMMIT;
