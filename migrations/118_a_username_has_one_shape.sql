-- 118_a_username_has_one_shape.sql
--
-- A username is 2–15 of a–z, 0–9 and _, stored lowercase. Both places that set
-- one (welcome's first step through save_my_profile, and Settings' rename, a
-- direct update) clean it to exactly that in the browser — but nothing below
-- the browser said so, and `users_username_key` is case-sensitive. A name sent
-- straight to the API as "Ray" would sit beside "ray", and the people search
-- (lib/db/rooms findPerson) matches names case-insensitively, so it couldn't
-- tell which one you meant.
--
-- Holding every name to lowercase here makes the existing unique key
-- case-insensitive in effect, so no second index is needed. Every row already
-- fits (checked 5 Oct 2026: none outside the pattern, no case duplicates), so
-- the constraint is validated as it's added. NULL stays allowed: a profile row
-- can exist before its name does.

BEGIN;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_username_shape;

ALTER TABLE public.users
  ADD CONSTRAINT users_username_shape
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{2,15}$');

COMMIT;
