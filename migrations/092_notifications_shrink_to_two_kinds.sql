-- 092_notifications_shrink_to_two_kinds.sql
-- A notification is now one person addressing another person. Nothing else.
--
-- ── What is kept, and why those four ───────────────────────────────────────
--   follow_request   — someone asked to follow you
--   follow_accepted  — someone accepted your request
--   new_follower     — someone followed you
--   dm_received      — someone sent you a message
--
-- All four are a named human doing something *to you*, on purpose, that you
-- would want to answer. That is the whole definition being applied here.
--
-- ── What goes, and why ─────────────────────────────────────────────────────
-- The other nine were machine-generated ambient activity — "a person you
-- follow watched something", "your rating was liked", "a show you track has a
-- new episode". None is addressed to anyone; each is a broadcast that happened
-- to land in a bell. A notification people learn to ignore is worse than one
-- that was never built, which 061's own header said and then built anyway.
--
-- They also cost the most. `notify_friend_watched` and
-- `notify_started_watching` are FOR EACH ROW and fan out one INSERT per
-- follower per row: a 1,000-title import with 50 followers writes 50,000
-- notification rows. That was harmless only because this database has no
-- follows yet — it was a bill waiting for the product to succeed.
--
-- `comment_reply` is the one genuinely person-to-person type being dropped, and
-- that is a deliberate call rather than an oversight: the rule is follows and
-- messages, and comments are neither. Somebody replying to a comment will not
-- be told. If comments become load-bearing, this is the type to bring back
-- first, and it is four lines.
--
-- ── The tables ─────────────────────────────────────────────────────────────
-- Four tables existed only to serve jobs that are being deleted in the same
-- change: `notified_episodes` (the new-episode job's memory), `watchlist_alerts`
-- and `user_notification_prefs` (the availability checker), and
-- `background_jobs` (a queue with no registered handler and no runner, which
-- has therefore never executed a single job — see 024's note in
-- docs/AGENT_DB_AND_MIGRATIONS.md). `user_waves` is the wave feature, which the
-- product removed and no code references.
--
-- Every one is dropped, and every one is checked for rows first. A migration
-- that deletes data because the author believed a table was empty is a
-- different and much worse migration than one that proves it.
--
-- Idempotent.

BEGIN;

-- ── Refuse to run if any of this is actually carrying data ────────────────
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notified_episodes', 'watchlist_alerts', 'background_jobs',
    'user_notification_prefs', 'user_waves'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION
          'public.% holds % row(s) — this migration only drops empty tables. Inspect it before continuing.', t, n;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ── Ambient notification triggers, and the functions behind them ──────────
DROP TRIGGER IF EXISTS notify_reaction_trigger     ON public.reactions;
DROP TRIGGER IF EXISTS trg_notify_started_watching ON public.user_media_status;
DROP TRIGGER IF EXISTS trg_notify_friend_watched   ON public.watched_items;
DROP TRIGGER IF EXISTS trg_notify_comment_reply    ON public.comments;
DROP TRIGGER IF EXISTS trg_notify_wave             ON public.user_waves;

DROP FUNCTION IF EXISTS public.notify_reaction();
DROP FUNCTION IF EXISTS public.notify_started_watching();
DROP FUNCTION IF EXISTS public.notify_friend_watched();
DROP FUNCTION IF EXISTS public.notify_comment_reply();
DROP FUNCTION IF EXISTS public.notify_wave();

-- Reactions and comments themselves are untouched. Liking a review still
-- works and still counts toward `popular` ordering; it just no longer rings.

-- ── Rows of the retired types ─────────────────────────────────────────────
-- Empty today. Written anyway so this is correct on a database where it isn't.
DELETE FROM public.notifications
WHERE notification_type NOT IN
  ('follow_request', 'follow_accepted', 'new_follower', 'dm_received');

-- ── The constraint becomes the specification ──────────────────────────────
-- Four types, and the database refuses a fifth. This is what stops the list
-- growing back one plausible-sounding addition at a time, which is how it got
-- to thirteen.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'follow_request'::text,
    'follow_accepted'::text,
    'new_follower'::text,
    'dm_received'::text
  ]));

-- ── Tables whose only readers are being deleted ───────────────────────────
DROP TABLE IF EXISTS public.notified_episodes;
DROP TABLE IF EXISTS public.watchlist_alerts;
DROP TABLE IF EXISTS public.background_jobs;
DROP TABLE IF EXISTS public.user_notification_prefs;
DROP TABLE IF EXISTS public.user_waves;

-- The enum existed only for background_jobs.status.
DROP TYPE IF EXISTS public.job_status;

-- ── Verify, in the transaction that did it ────────────────────────────────
DO $$
DECLARE
  v_fns int;
  v_tbls int;
BEGIN
  SELECT count(*) INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN (
    'notify_reaction', 'notify_started_watching', 'notify_friend_watched',
    'notify_comment_reply', 'notify_wave');
  IF v_fns <> 0 THEN
    RAISE EXCEPTION '% ambient notify function(s) survived', v_fns;
  END IF;

  SELECT count(*) INTO v_tbls
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN (
    'notified_episodes', 'watchlist_alerts', 'background_jobs',
    'user_notification_prefs', 'user_waves');
  IF v_tbls <> 0 THEN
    RAISE EXCEPTION '% table(s) survived', v_tbls;
  END IF;

  -- The four that must still fire.
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN (
        'notify_follow_request', 'notify_follow_accepted',
        'notify_new_follower', 'notify_dm_received')) <> 4 THEN
    RAISE EXCEPTION 'a follow or message notifier was removed by mistake';
  END IF;

  RAISE NOTICE 'verified: notifications are follows and messages only';
END $$;

COMMIT;
