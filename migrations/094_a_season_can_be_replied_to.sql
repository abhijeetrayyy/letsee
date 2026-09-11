-- 094_a_season_can_be_replied_to.sql
-- Every reply typed on a season page has been rejected by the database.
--
-- ── The fault ──────────────────────────────────────────────────────────────
-- `TitleTalk` renders on four pages. On a season page it is given
-- `scope="season"`, and it derives the thread's item_type from that scope:
--
--   const commentsItemType = scope === "title" ? itemType : scope;
--
-- so the insert arrives as item_type = 'season'. The client-side allow-list in
-- src/lib/db/comments.ts lists it:
--
--   ["movie","tv","review","episode","season","club","club_pick"]
--
-- and the CHECK constraint, last rewritten by 049, does not:
--
--   CHECK (item_type IN ('movie','tv','review','episode','club_pick','club'))
--
-- The insert violates the constraint, `postComment` returns `error.message`,
-- and the component renders the raw Postgres text where a person expected
-- their sentence to appear. Nothing is logged as an incident because nothing
-- threw — the failure is a returned string, and it looks exactly like a
-- validation message the product meant to show.
--
-- ── Why the constraint keeps drifting ──────────────────────────────────────
-- `comments` is keyed polymorphically on `(item_id text, item_type text)`, so
-- what a thread is attached to is a free-text pair whose legal values live in
-- two places that have to be kept in step by hand. They were kept in step by
-- hand three times (038, 049, and the client list) and diverged on the fourth.
--
-- The real fix is to stop keying threads on a string — a reply belongs to a
-- piece of writing, not to a category name — and that is a schema change with
-- a data migration behind it. This is the one-line stopgap that makes the
-- season pages work today. `tests/invariants/comment-types.test.ts` is added
-- alongside it so the two lists cannot drift again in the meantime.
--
-- Idempotent.

BEGIN;

ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_item_type_check;
ALTER TABLE public.comments ADD CONSTRAINT comments_item_type_check
  CHECK (item_type IN ('movie', 'tv', 'review', 'episode', 'season', 'club_pick', 'club'));

DO $$
DECLARE
  v_def text;
BEGIN
  -- Read the constraint back rather than trusting the ALTER above. A probe
  -- INSERT would be the stronger test and is the wrong one to run here: it
  -- would fire the rate-limit trigger and the reply notifier against a real
  -- account, so the verification would have side effects on somebody's inbox.
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public'
     AND t.relname = 'comments'
     AND c.conname = 'comments_item_type_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'comments_item_type_check is missing';
  END IF;
  IF v_def NOT LIKE '%''season''%' THEN
    RAISE EXCEPTION 'season is still rejected by comments_item_type_check: %', v_def;
  END IF;

  RAISE NOTICE 'verified: a season thread accepts replies';
END $$;

COMMIT;
