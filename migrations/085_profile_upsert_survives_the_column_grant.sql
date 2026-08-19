-- 085_profile_upsert_survives_the_column_grant.sql
-- URGENT: 072 broke every upsert on public.users. New signups cannot finish.
--
-- ── What happened ──────────────────────────────────────────────────────────
--
-- 072 revoked table-level SELECT on public.users and re-granted it column by
-- column without `email`, because RLS filters rows and not columns and the anon
-- key could otherwise read every address on the platform. INSERT and UPDATE
-- were left table-level and untouched, so writes were expected to be fine.
--
-- They are not. `INSERT ... ON CONFLICT DO UPDATE` requires **table-level**
-- SELECT, because the DO UPDATE path has to read the conflicting row. A set of
-- column grants does not satisfy a relation-level check — which is why the
-- error is "permission denied for table users" rather than "for column email".
--
-- Two call sites, both load-bearing:
--   /app/welcome        picking a handle. The middleware bounces every /app
--                       route back here while `username` is null, so a failure
--                       here means a new account can never leave onboarding.
--                       Every signup since 072 has been stuck.
--   /app/profile/setup  saving a profile.
--
-- Plain UPDATEs were never affected: `users_update_self` reads only `id`, and
-- SELECT(id) is granted. It is specifically ON CONFLICT that needs the table.
--
-- ── The fix, and why not the obvious one ───────────────────────────────────
--
-- Granting table SELECT back would fix it by reopening the hole 072 closed.
-- Rewriting the calls as UPDATE-then-INSERT would work but leaves two clients
-- racing on a row they both think does not exist yet.
--
-- So the upsert moves into a SECURITY DEFINER function, which runs as the table
-- owner and is therefore unaffected by the grants. It is strictly better than
-- what it replaces:
--
--   * The row is pinned to auth.uid(). The old client sent its own `id`, and
--     the only thing stopping it writing somebody else's row was a WITH CHECK.
--   * `email` is no longer written by the browser at all. It was being copied
--     out of the session into a column that exists in auth.users already — the
--     duplication 072 had to hide in the first place.
--   * COALESCE means a caller may send only the fields it edits. /app/welcome
--     sends a handle; /app/profile/setup sends the rest. One function, and
--     neither wipes what the other set.
--
-- Idempotent: create or replace.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_my_profile(
  p_username   text DEFAULT NULL,
  p_about      text DEFAULT NULL,
  p_tagline    text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL
)
RETURNS TABLE (username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'You have to be signed in.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A handle is how people find you; blank is not a handle. Absent is fine —
  -- that is the profile-editing path, which does not touch it.
  IF p_username IS NOT NULL AND btrim(p_username) = '' THEN
    RAISE EXCEPTION 'Pick a handle.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.users AS u (id, email, username, about, tagline, avatar_url, banner_url, updated_at)
  VALUES (
    v_me,
    -- Read from the auth schema, which owns it, rather than trusted from a client.
    (SELECT au.email FROM auth.users au WHERE au.id = v_me),
    p_username, p_about, p_tagline, p_avatar_url, p_banner_url, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    username   = COALESCE(EXCLUDED.username,   u.username),
    about      = COALESCE(EXCLUDED.about,      u.about),
    tagline    = COALESCE(EXCLUDED.tagline,    u.tagline),
    avatar_url = COALESCE(EXCLUDED.avatar_url, u.avatar_url),
    banner_url = COALESCE(EXCLUDED.banner_url, u.banner_url),
    updated_at = now();

  RETURN QUERY SELECT u2.username FROM public.users u2 WHERE u2.id = v_me;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_my_profile(text, text, text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.save_my_profile(text, text, text, text, text) TO authenticated, service_role;

/**
 * Writing the private diary, for the same reason.
 *
 * 076 revoked SELECT on watched_items.review_text. Two writers name that column
 * inside an upsert — takes.ts's mirrorToLegacy when a take is private, and the
 * importer when a row carries a review — and `ON CONFLICT DO UPDATE SET
 * review_text = EXCLUDED.review_text` reads it, which those roles may not do.
 *
 * The other five upserts on that table are untouched and were never affected:
 * they never mention the column. That is the whole rule — an upsert is fine, an
 * upsert that names a withheld column is not.
 *
 * This is the write half of `my_diary_notes()`. The row itself is still upserted
 * by the caller with its ordinary privileges; only the note comes through here.
 *
 * `p_only_if_empty` is the importer's governing rule made explicit: an import
 * may add, but never take away, so it fills a null diary entry and leaves
 * anything the user has written since alone.
 */
CREATE OR REPLACE FUNCTION public.set_my_diary_notes(
  p_notes jsonb,
  p_only_if_empty boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'You have to be signed in.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH note AS (
    SELECT
      n->>'item_id'   AS item_id,
      n->>'item_type' AS item_type,
      NULLIF(n->>'body', '') AS body
    FROM jsonb_array_elements(p_notes) AS n
  ),
  updated AS (
    UPDATE public.watched_items w
       SET review_text = note.body
      FROM note
     WHERE w.user_id   = v_me
       AND w.item_id   = note.item_id
       AND w.item_type = note.item_type
       AND (NOT p_only_if_empty OR w.review_text IS NULL)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.set_my_diary_notes(jsonb, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_my_diary_notes(jsonb, boolean) TO authenticated, service_role;

COMMIT;
