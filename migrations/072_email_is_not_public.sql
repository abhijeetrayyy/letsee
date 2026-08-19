-- 072_email_is_not_public.sql
-- Take users.email out of reach of the anon and authenticated roles.
--
-- The only SELECT policy on public.users is 034's
--   USING (deleted_at IS NULL)
-- and RLS filters ROWS, not COLUMNS. So that policy hands every column of every
-- live user to anyone holding the publishable anon key — and column two is
-- `email text not null`. `GET /rest/v1/users?select=username,email` is the
-- complete mailing list, unauthenticated, paginated, in one request. A profile
-- set to `private` leaked its address exactly as readily as a public one.
--
-- RLS has no way to say "this column but not that one", so the fix is a column
-- privilege. 043 already used the same instrument on user_title_affinity
-- (`REVOKE ALL ... FROM anon, authenticated`); this is that, one column wide.
--
-- A table-level SELECT grant implicitly covers every column, including ones
-- added later, so it cannot be narrowed in place — it has to be revoked and
-- re-granted per column. The column list is discovered from the catalogue
-- rather than typed out, for the same reason 064 discovers its constraints by
-- shape: a hand-copied list is a list that goes stale silently.
--
-- CONSEQUENCES, deliberately accepted:
--   * `select("*")` on public.users now fails with 42501 for anon and
--     authenticated. There was exactly one such call — /api/account/export —
--     and it names its columns as of this commit. `getUserProfile()` in
--     src/utils/supabase/client.ts also does it, but has no callers.
--   * Any column added to public.users after this runs is NOT granted until
--     this migration is re-run. Re-running is safe and is the intended
--     maintenance step; it is idempotent by construction.
--   * service_role is untouched. The cron jobs and the admin client read
--     through it and still see every column, email included.
--
-- Idempotent: re-runnable as a no-op, and re-running is how you pick up new
-- columns.

BEGIN;

DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
    INTO v_cols
    FROM pg_attribute
   WHERE attrelid    = 'public.users'::regclass
     AND attnum      > 0
     AND NOT attisdropped
     AND attname    <> 'email';

  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'public.users has no grantable columns — refusing to lock the table out';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.users FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.users TO anon, authenticated', v_cols);

  RAISE NOTICE 'users: SELECT granted on every column except email (%)', v_cols;
END $$;

COMMIT;
