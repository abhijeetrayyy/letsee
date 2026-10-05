-- 121_fair_use.sql
--
-- Two small things for fair use (lib/limits):
--
-- 1. usage_quotas: "once every N days" for the actions that cost the most per
--    call — downloading all your data (JSON, and the Letterboxd CSV), each
--    once every 15 days. take_quota() grants and records in one statement, so
--    two downloads started together can't both get through; refund_quota()
--    hands it back if the download then fails, so a server error never costs
--    someone 15 days. The intervals live here, not in the caller: nothing sent
--    from a browser can shorten them.
--
-- 2. limit_events: one row each time an address is put in the penalty box for
--    hammering the API (lib/limits/guard) — not one per request, so it stays
--    tiny. Written by the server with the service role; nobody else can read
--    it. The address is stored as a short hash, never in the clear.

BEGIN;

CREATE TABLE IF NOT EXISTS public.usage_quotas (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  last_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, action)
);

ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_quotas_select_own ON public.usage_quotas;
CREATE POLICY usage_quotas_select_own ON public.usage_quotas
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.usage_quotas TO authenticated;

-- How often each action may happen. Unknown actions are refused.
CREATE OR REPLACE FUNCTION public.quota_interval(p_action text)
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_action
    WHEN 'export_json' THEN interval '15 days'
    WHEN 'export_letterboxd' THEN interval '15 days'
  END;
$$;

-- NULL when granted (and recorded); otherwise when it will next be allowed.
CREATE OR REPLACE FUNCTION public.take_quota(p_action text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_every interval := public.quota_interval(p_action);
  v_last timestamptz;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'You have to be signed in.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_every IS NULL THEN
    RAISE EXCEPTION 'Unknown action %', p_action USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.usage_quotas AS q (user_id, action, last_at)
  VALUES (v_me, p_action, now())
  ON CONFLICT (user_id, action) DO UPDATE
     SET last_at = now()
   WHERE q.last_at <= now() - v_every;
  IF FOUND THEN
    RETURN NULL;
  END IF;

  SELECT last_at INTO v_last FROM public.usage_quotas WHERE user_id = v_me AND action = p_action;
  RETURN v_last + v_every;
END;
$function$;

-- Hand back an allowance taken in the last few minutes (the download failed).
CREATE OR REPLACE FUNCTION public.refund_quota(p_action text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.usage_quotas
   WHERE user_id = auth.uid() AND action = p_action AND last_at > now() - interval '5 minutes';
$$;

REVOKE ALL ON FUNCTION public.take_quota(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_quota(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_quota(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_quota(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.limit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_hash text NOT NULL,
  bucket text NOT NULL,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS limit_events_created_idx ON public.limit_events (created_at DESC);

ALTER TABLE public.limit_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) writes or reads it.
REVOKE ALL ON public.limit_events FROM anon, authenticated;

COMMIT;
