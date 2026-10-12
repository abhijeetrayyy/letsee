-- 124_households.sql
--
-- "We live together" (docs/IDEAS_2026-10.md §4.4). The research's first gap:
-- every tracker records what was watched, none records who — and the people
-- you watch with most are the ones you live with.
--
-- A household row is yours: "I live with this person". It changes only your
-- own screens — your diary sheet suggests them as who was there (a
-- suggestion; nothing is written until you tap it, and they still confirm
-- "I was there too" as for anyone you name), and a series page shows where
-- they are as well as where you are (read under their profile's visibility,
-- as any of their episodes). Nobody else can see your rows, including them.
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.households (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  other_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_id),
  CHECK (user_id <> other_id)
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS households_select_own ON public.households;
CREATE POLICY households_select_own ON public.households
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS households_insert_own ON public.households;
CREATE POLICY households_insert_own ON public.households
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.is_blocked(user_id, other_id));

DROP POLICY IF EXISTS households_delete_own ON public.households;
CREATE POLICY households_delete_own ON public.households
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.households FROM anon;
GRANT SELECT, INSERT, DELETE ON public.households TO authenticated;

COMMIT;
