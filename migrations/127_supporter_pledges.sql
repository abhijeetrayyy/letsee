-- 127_supporter_pledges.sql
--
-- The supporter tier, pre-sold before it's built (docs/IDEAS_2026-10.md §6.2,
-- WHY_PEOPLE_COME_BACK.md Bet 12): a pledge, not a payment. Someone says
-- they'd support letsee at the price shown, and which of the four things
-- they'd use most — pictures without the mark, their year printed, early
-- access, all-time stats. Nothing is charged; when supporting opens, the
-- people who pledged are asked first and can change their minds then.
--
-- One pledge per person. Private: you see, change and withdraw only your own.
-- The owner reads the totals from the database. The price is one of the two
-- shown (20 dollars, or 1,700 rupees in India), never a figure a client
-- invents.
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.supporter_pledges (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  currency text NOT NULL,
  amount integer NOT NULL,
  most_wanted text CHECK (most_wanted IS NULL OR most_wanted IN ('no_mark', 'printed_year', 'early_access', 'all_time_stats')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supporter_pledges_price CHECK ((currency, amount) IN (('USD', 20), ('INR', 1700)))
);

DROP TRIGGER IF EXISTS supporter_pledges_updated_at ON public.supporter_pledges;
CREATE TRIGGER supporter_pledges_updated_at
  BEFORE UPDATE ON public.supporter_pledges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.supporter_pledges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supporter_pledges_select_own ON public.supporter_pledges;
CREATE POLICY supporter_pledges_select_own ON public.supporter_pledges
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS supporter_pledges_insert_own ON public.supporter_pledges;
CREATE POLICY supporter_pledges_insert_own ON public.supporter_pledges
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS supporter_pledges_update_own ON public.supporter_pledges;
CREATE POLICY supporter_pledges_update_own ON public.supporter_pledges
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS supporter_pledges_delete_own ON public.supporter_pledges;
CREATE POLICY supporter_pledges_delete_own ON public.supporter_pledges
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.supporter_pledges FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supporter_pledges TO authenticated;

COMMIT;
