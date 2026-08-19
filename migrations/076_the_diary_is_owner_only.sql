-- 076_the_diary_is_owner_only.sql
-- The other half of the private-diary leak. 073 closed the path that ran
-- through 009's public-reviews policy; this closes the one that runs through
-- 019's visibility policy, which is the bigger of the two.
--
-- 019 grants:
--   watched_items_select_profile_visible
--     USING (auth.uid() = user_id OR public.profile_visible_to_viewer(user_id))
-- That is the correct rule for the row. But RLS filters ROWS, not COLUMNS, and
-- `watched_items.review_text` is the PRIVATE DIARY sitting on the same row as
-- the title, the poster and the public review. So for any profile a visitor may
-- see at all — every `public` profile, and every `followers` profile they
-- follow — this is readable straight off PostgREST with the publishable key:
--
--   GET /rest/v1/watched_items?user_id=eq.<uuid>&select=item_name,review_text
--
-- The application layer knows the column is private and is careful with it:
-- profile/[id]/page.tsx nulls it for non-owners, UserWatchedPagination nulls it
-- and says why, library/index refuses to select it at all. None of that helps.
-- The care is in the route; the table is what the anon key talks to.
--
-- ── Why a column privilege, and not a policy ────────────────────────────────
--
-- There is no policy that expresses this. Narrowing 019 to `auth.uid() =
-- user_id` would hide the whole row and take every visitor's view of a profile
-- with it — the Films grid, the diary dates, the public reviews. The split is
-- along a column, so the instrument has to be a column privilege. Same shape as
-- 072, and 043 already established the pattern.
--
-- A table-level SELECT grant implicitly covers every column including ones
-- added later, so it has to be revoked and re-granted per column. The list is
-- discovered from the catalogue rather than typed out, so a column added later
-- is picked up by re-running this rather than by remembering.
--
-- ── Why the owner still works ───────────────────────────────────────────────
--
-- Column privileges are per ROLE, not per row, and the owner is `authenticated`
-- like everyone else — so revoking the column takes it from the owner too. The
-- six places that legitimately read their own diary go through
-- `my_diary_notes()` below, which is SECURITY DEFINER and hard-scoped to
-- auth.uid(). It cannot be aimed at another user: it takes no user parameter.
--
-- Writes are unaffected. INSERT and UPDATE privileges are separate from SELECT,
-- and `mirrorToLegacy` / `importApply` upsert without chaining `.select()`, so
-- supabase-js sends `Prefer: return=minimal` and never reads the column back.
--
-- ── Consequences, deliberately accepted ────────────────────────────────────
--
--   * `select("*")` on watched_items now fails with 42501 for anon and
--     authenticated. Four call sites did it — account/export, recommendations,
--     recommendations/search, and the dead getUserProfile — and all name their
--     columns as of the same commit.
--   * A WHERE on review_text also needs the privilege. `watched-with-reviews`
--     filtered on `.not("review_text","is",null)` without selecting it; it uses
--     the function now.
--   * Any column added to watched_items later is not granted until this is
--     re-run. Re-running is the intended maintenance step and is a no-op
--     otherwise.
--   * service_role is untouched.
--
-- ── What this does NOT do ──────────────────────────────────────────────────
--
-- It does not consolidate the diary. 065 made `takes` the source of truth and
-- left `watched_items.review_text` as a one-directional projection of it, and
-- `takes` is already safe — `takes_public_read` is
-- `using (is_public and profile_visible_to_viewer(user_id))`, so a private
-- take's row never matches and its `body` is never exposed. The real end state
-- is to stop mirroring the diary into watched_items at all and delete the
-- column. That is a data migration with a backfill to verify first, so it is
-- not this file.
--
-- Idempotent: re-runnable as a no-op.

BEGIN;

DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
    INTO v_cols
    FROM pg_attribute
   WHERE attrelid    = 'public.watched_items'::regclass
     AND attnum      > 0
     AND NOT attisdropped
     AND attname    <> 'review_text';

  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'public.watched_items has no grantable columns — refusing to lock the table out';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.watched_items FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.watched_items TO anon, authenticated', v_cols);

  RAISE NOTICE 'watched_items: SELECT granted on every column except review_text (%)', v_cols;
END $$;

/**
 * The caller's own diary, and only ever their own.
 *
 * Takes no user id on purpose: there is no argument to point at somebody else.
 * `p_item_ids` narrows to a set of TMDB ids for the import path, which already
 * knows exactly which titles it is about; `p_limit` caps the pinned-review
 * picker. Rows without a note never come back, so an absent key means "no
 * diary entry" at every call site.
 *
 * public_review_text rides along because two callers (export, and the pinned
 * dropdown) want both halves of a title's writing in one pass, and it is
 * readable anyway.
 */
CREATE OR REPLACE FUNCTION public.my_diary_notes(
  p_item_ids text[] DEFAULT NULL,
  p_limit    int    DEFAULT NULL
)
RETURNS TABLE (
  id                 bigint,
  item_id            text,
  item_type          text,
  item_name          text,
  image_url          text,
  watched_at         timestamptz,
  review_text        text,
  public_review_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Every reference is qualified: RETURNS TABLE puts these names in scope as
  -- output parameters, and a bare `item_id` would be ambiguous.
  SELECT w.id, w.item_id, w.item_type, w.item_name, w.image_url,
         w.watched_at, w.review_text, w.public_review_text
    FROM public.watched_items w
   WHERE w.user_id = auth.uid()
     AND auth.uid() IS NOT NULL
     AND w.review_text IS NOT NULL
     AND (p_item_ids IS NULL OR w.item_id = ANY (p_item_ids))
   ORDER BY w.watched_at DESC, w.id DESC
   LIMIT COALESCE(p_limit, 1000000);
$$;

-- CORRECTION (077): the REVOKE below removes a grant that was never the
-- one letting anon in. PostgreSQL grants EXECUTE to PUBLIC by default and
-- anon is a member of PUBLIC, so this line is a no-op on its own.
-- migrations/077_rpcs_are_not_public.sql revokes from PUBLIC and is what
-- actually closes it. Verified against the live database.
REVOKE EXECUTE ON FUNCTION public.my_diary_notes(text[], int) FROM anon;
GRANT  EXECUTE ON FUNCTION public.my_diary_notes(text[], int) TO authenticated;

COMMIT;
