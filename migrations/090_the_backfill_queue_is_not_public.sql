-- 090_the_backfill_queue_is_not_public.sql
-- 088 shipped four service-role functions that any visitor could call.
--
-- ── What went wrong ────────────────────────────────────────────────────────
-- 088 ended its grant block with:
--
--     REVOKE ALL ON FUNCTION public.claim_title_metadata(integer, integer) FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION public.claim_title_metadata(integer, integer) TO service_role;
--
-- and cited 077 while doing it — 077's finding being that `REVOKE ... FROM
-- anon` is a no-op, because anon is a member of PUBLIC and the privilege
-- actually came from the PUBLIC grant. That is true, and it is only half the
-- rule. **Supabase also installs a default ACL on the `public` schema that
-- grants EXECUTE on every newly created function directly to `anon` and
-- `authenticated`**:
--
--     pg_default_acl, objtype 'f':
--       {postgres=X/postgres, anon=X/postgres,
--        authenticated=X/postgres, service_role=X/postgres}
--
-- So a function born in this schema carries *two* grants: the implicit one to
-- PUBLIC that Postgres adds, and an explicit one to anon and authenticated
-- that Supabase adds. Revoking from PUBLIC removes the first and leaves the
-- second untouched. 077 got this right — `FROM PUBLIC, anon` — and 088 copied
-- the reasoning without copying the statement.
--
-- Verified live before this migration: `has_function_privilege('anon',
-- 'claim_title_metadata', 'EXECUTE')` returned **true**.
--
-- ── What it exposed ────────────────────────────────────────────────────────
-- None of this leaks user data — `title_metadata` holds public TMDB facts. It
-- is a denial-of-service surface on the backfill:
--
--   * `claim_title_metadata(500, 86400)` on a loop leases every pending title
--     for a day at a time. The cron then finds an empty queue every run and
--     coverage never advances, silently — the job reports "no-work" and looks
--     healthy.
--   * `record_title_metadata_failure(id, type, '', 1)` walks any title
--     straight to `fetch_state = 'failed'`, which nothing retries.
--   * `enqueue_stale_title_metadata(0, 200)` re-queues fetched rows on demand,
--     turning the refresh trickle into TMDB traffic on someone else's timing.
--
-- The read path is unaffected and stays public: `profile_taste_stats` and
-- `profile_taste_titles` (089) are *meant* to answer anon, because signed-out
-- visitors can browse public profiles, and both gate on
-- `profile_visible_to_viewer` internally.
--
-- Idempotent.

BEGIN;

DO $$
DECLARE
  r RECORD;
  v_locked int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'enqueue_missing_title_metadata',
        'enqueue_stale_title_metadata',
        'claim_title_metadata',
        'record_title_metadata_failure'
      )
  LOOP
    -- All three, every time. PUBLIC for the implicit grant, anon and
    -- authenticated for the ones the schema's default ACL handed out at
    -- creation. Dropping any of the three leaves a door open.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role', r.sig);
    v_locked := v_locked + 1;
    RAISE NOTICE 'locked to service_role: %', r.sig;
  END LOOP;

  IF v_locked <> 4 THEN
    RAISE EXCEPTION
      'expected to lock 4 backfill functions, locked % — has 088 been applied?', v_locked;
  END IF;
END $$;

-- Prove it, in the same transaction that did it. A migration that reports
-- success while the privilege is still there is how 074 and 076 shipped.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'enqueue_missing_title_metadata', 'enqueue_stale_title_metadata',
        'claim_title_metadata', 'record_title_metadata_failure')
  LOOP
    IF has_function_privilege('anon', r.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'still reachable by anon/authenticated: %', r.proname;
    END IF;
    IF NOT has_function_privilege('service_role', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role lost EXECUTE on %', r.proname;
    END IF;
  END LOOP;
  RAISE NOTICE 'verified: backfill queue is service_role only';
END $$;

COMMIT;
