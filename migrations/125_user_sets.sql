-- 125_user_sets.sql
--
-- Sets (docs/IDEAS_2026-10.md §2.1): a bounded set someone chooses to work
-- through — a list (anyone's they can see), or a person's work in one role
-- (every film a director made, a creator's series, an actor's real roles).
--
-- The research's form of gamification that keeps the benefit: bounded, chosen,
-- progress as pace ("7 of 12 · 3 this year"), nothing lost when it lapses, and
-- comparison as company ("sam's on it too, 9 of 12"), never rank.
--
-- A row is a reference, not a copy: the titles come from the list or the
-- person's work, read when shown; progress from the person's own marks. Seen
-- by whoever can see the person's profile (so your people can be on a set with
-- you); added and removed only by its owner.
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_sets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('list', 'person')),
  -- A list's id, or a TMDB person id.
  ref_id text NOT NULL CHECK (ref_id ~ '^[0-9]+$'),
  -- For a person: the work it is. Null for a list.
  role text CHECK (role IS NULL OR role IN ('director', 'creator', 'actor')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  image_url text CHECK (image_url IS NULL OR char_length(image_url) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref_id, role),
  CHECK ((kind = 'list') = (role IS NULL))
);

CREATE INDEX IF NOT EXISTS user_sets_ref_idx ON public.user_sets (kind, ref_id);

ALTER TABLE public.user_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_sets_select_visible ON public.user_sets;
CREATE POLICY user_sets_select_visible ON public.user_sets
  FOR SELECT USING (user_id = auth.uid() OR public.profile_visible_to_viewer(user_id));

DROP POLICY IF EXISTS user_sets_insert_own ON public.user_sets;
CREATE POLICY user_sets_insert_own ON public.user_sets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_sets_delete_own ON public.user_sets;
CREATE POLICY user_sets_delete_own ON public.user_sets
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.user_sets TO anon, authenticated;
GRANT INSERT, DELETE ON public.user_sets TO authenticated;

COMMIT;
