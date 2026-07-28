-- 028_fix_episode_ratings_fk.sql
-- Fix: episode_ratings.user_id references auth.users directly,
-- but every other user-data table references public.users.
-- This aligns it with the rest of the schema.

BEGIN;

-- Drop the existing FK constraint (name may vary depending on how it was created)
ALTER TABLE public.episode_ratings
  DROP CONSTRAINT IF EXISTS episode_ratings_user_id_fkey;

-- Re-add pointing to public.users
ALTER TABLE public.episode_ratings
  ADD CONSTRAINT episode_ratings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

COMMIT;
