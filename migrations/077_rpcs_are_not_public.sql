-- 077_rpcs_are_not_public.sql
-- Every RPC in this schema is executable by `anon`, including the writes.
--
-- ── How this was found ─────────────────────────────────────────────────────
--
-- 074 and 076 each ended with `REVOKE EXECUTE ... FROM anon`. Probing the live
-- database with the publishable key afterwards, both functions still executed.
-- So did `taste_matches`, which 043 granted to `authenticated` and to nobody
-- else — and it came back with real usernames and real shared titles.
--
-- The privilege was never coming from `anon`. PostgreSQL grants EXECUTE on a
-- new function to PUBLIC by default, and `anon` is a member of PUBLIC like
-- every other role. Revoking from `anon` removes a grant that was doing no
-- work; the default one underneath it is what actually admits the caller. The
-- explicit `GRANT ... TO authenticated` lines scattered through 043, 049, 062,
-- 066 and 070 have therefore been decorative from the beginning: they granted
-- something every role already had.
--
-- ── What that exposed ──────────────────────────────────────────────────────
--
-- Reads, confirmed answering an unauthenticated caller:
--   taste_matches        — usernames, avatars, scores and shared title names,
--                          plus the whole-platform scan that computes them
--   conversation_list    — the DM inbox builder, taking any user id
--   taste_compatibility  — guarded by 074, so it returns nothing, but reachable
--   my_diary_notes       — scoped to auth.uid(), so nothing, but reachable
--
-- Writes, confirmed reaching execution (they failed on a deliberate uuid cast
-- error, which only happens AFTER the permission check passes):
--   recount_user_stats        — the expensive full recount, any user id, no
--                               rate limit: a free denial-of-service primitive
--   increment_favorites_count — any user id
--   decrement_favorites_count — any user id, so anyone's favourites counter
--                               can be driven arbitrarily negative
--
-- ── What this does ─────────────────────────────────────────────────────────
--
-- Revokes EXECUTE from PUBLIC (and from anon, for the avoidance of doubt) on
-- the functions that are entry points for signed-in users only, then grants it
-- back deliberately.
--
-- Signatures are discovered from pg_proc by name rather than typed out, so this
-- cannot miss an overload or fail on an argument list that drifted.
--
-- ── What is deliberately LEFT alone, and why ───────────────────────────────
--
-- 1. RLS policy helpers — profile_visible_to_viewer, is_blocked, is_club_admin,
--    is_club_member, is_list_editor, is_session_participant, owns_import_job.
--    A policy expression is evaluated with the privileges of the role running
--    the query, so `anon` genuinely needs EXECUTE on these or every public
--    profile read starts failing. They return booleans and leak nothing.
--
-- 2. Functions signed-out visitors legitimately reach, because the app lets
--    anonymous users browse title pages and public profiles:
--    title_rating_histogram, reviews_for_title, related_by_audience,
--    title_audience, get_user_stats. Narrowing these is a product decision
--    about whether signed-out browsing survives, not a bug fix.
--
-- 3. `taste_matches(p_user)` still takes a caller-supplied uuid rather than
--    being pinned to auth.uid(), the way 074 pinned taste_compatibility. After
--    this migration only signed-in users can call it, and it already filters to
--    `visibility = 'public'` and non-blocked profiles, so what remains is one
--    authenticated user asking whose taste matches a DIFFERENT public profile.
--    Worth closing; not closed here, because doing it means retyping a
--    ninety-line query I have no way to execute first, and a transcription slip
--    in that body is a worse outcome than the residue.
--
-- Idempotent: revoking an absent grant and re-granting a held one are both
-- no-ops, and the function list is matched by name.

BEGIN;

DO $$
DECLARE
  r record;
  v_locked int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY (ARRAY[
             -- reads that are about one signed-in person
             'taste_matches',
             'taste_compatibility',
             'my_diary_notes',
             'conversation_list',
             -- writes: none of these should ever be reachable unauthenticated
             'recount_user_stats',
             'increment_favorites_count',
             'decrement_favorites_count',
             'increment_watched_count',
             'decrement_watched_count',
             'increment_watchlist_count',
             'decrement_watchlist_count',
             'increment_watching_count',
             'decrement_watching_count',
             'backfill_watched_episodes_for_show',
             -- dead, but they are writes and they take a user id
             'record_rewatch',
             'award_achievement',
             'check_achievements'
           ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    v_locked := v_locked + 1;
    RAISE NOTICE 'locked to authenticated: %', r.sig;
  END LOOP;

  IF v_locked = 0 THEN
    RAISE EXCEPTION 'matched no functions — the name list is wrong, refusing to claim success';
  END IF;

  RAISE NOTICE '077 locked % function(s)', v_locked;
END $$;

COMMIT;
