-- 084_a_message_has_a_size_and_a_rate.sql
-- There is no rate limiting anywhere in this app, and DMs have no length cap.
--
-- ── Why this has to be in the database ─────────────────────────────────────
--
-- Messages have no server route. `messages/[id]/page.tsx`, `sendCard.tsx` and
-- `ShareModal.tsx` all insert straight into PostgREST from the browser, so
-- there is no place in `src/` where a limit could be enforced that a client
-- cannot simply skip. `comments` carries `CHECK (char_length(body) <= 2000)`;
-- `messages` carries `maxLength={2000}` on a textarea. Only one of those
-- survives contact with curl.
--
-- So: a CHECK for size, and a trigger for rate.
--
-- ── The limiter ────────────────────────────────────────────────────────────
--
-- A fixed window, counted in a table, enforced by a SECURITY DEFINER function.
-- Not a token bucket and not a sliding window: a fixed window lets a caller
-- burst to 2x across a boundary, which for "stop someone flooding an inbox" is
-- an acceptable trade for something that is one INSERT and one index probe.
--
-- The bucket key is built from auth.uid() inside the trigger, never passed in
-- by the caller, so a client cannot pick a bucket nobody else is using.
--
-- The counter table is not readable or writable by anon or authenticated at
-- all — it is touched only through the function, which runs as its owner.
-- Otherwise a rate limiter is a thing you can delete your way out of.
--
-- Old windows are swept opportunistically, roughly one insert in a hundred, so
-- the table cannot grow without bound and no cron has to remember it.
--
-- ── Limits, and why these numbers ──────────────────────────────────────────
--
--   messages  30/min   A fast typist sends maybe 10. Sharing a card to five
--                      people at once is five rows in one statement, and the
--                      share sheet caps recipients at 5, so a burst of sharing
--                      still fits.
--   comments  20/min   Slower to write than a DM, and the abuse shape is a
--                      script rather than a person.
--
-- Both raise SQLSTATE 53400 (configuration_limit_exceeded), which PostgREST
-- surfaces as an error the existing catch blocks already render.

BEGIN;

-- ── Size ────────────────────────────────────────────────────────────────────
-- Matches the textarea that was pretending to enforce it (sendCard.tsx's
-- CONTENT_MAX_LENGTH = 2000) and the comments constraint that actually did.
--
-- NOT VALID on purpose. Adding a CHECK normally scans and validates every
-- existing row, so one legacy message over the limit would abort this whole
-- migration — and `messages` is RLS-protected to its participants, so that
-- cannot be checked from outside the database first. NOT VALID enforces the
-- rule on every future insert and update while leaving history alone, which is
-- the behaviour actually wanted here.
--
-- To adopt history too, once you have looked:
--   SELECT count(*) FROM public.messages WHERE char_length(content) > 2000;
--   ALTER TABLE public.messages VALIDATE CONSTRAINT messages_content_length;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_length;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length
  CHECK (char_length(content) <= 2000) NOT VALID;

-- ── Rate ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  bucket       text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately. Nothing reaches this table except the SECURITY
-- DEFINER function below, and a limiter the limited party can edit is decor.
REVOKE ALL ON public.rate_limit_hits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rate_limit_take(
  p_bucket text,
  p_limit  integer,
  p_unit   text DEFAULT 'minute'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_hits   integer;
BEGIN
  v_window := date_trunc(p_unit, now());

  INSERT INTO public.rate_limit_hits AS r (bucket, window_start, hits)
  VALUES (p_bucket, v_window, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO v_hits;

  -- Cheap amortised sweep: no cron to forget, no unbounded table.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_hits WHERE window_start < now() - interval '1 hour';
  END IF;

  IF v_hits > p_limit THEN
    RAISE EXCEPTION 'Too many too quickly. Wait a moment and try again.'
      USING ERRCODE = '53400';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rate_limit_take(text, integer, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rate_limit_take(text, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.limit_message_rate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid(), not NEW.sender_id: the RLS insert policy already ties those
  -- together, and reading the session directly means this cannot be aimed at
  -- somebody else's bucket even if that policy ever loosens.
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.rate_limit_take('dm:' || auth.uid()::text, 30, 'minute');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limit_message_rate ON public.messages;
CREATE TRIGGER trg_limit_message_rate
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.limit_message_rate();

CREATE OR REPLACE FUNCTION public.limit_comment_rate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.rate_limit_take('comment:' || auth.uid()::text, 20, 'minute');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limit_comment_rate ON public.comments;
CREATE TRIGGER trg_limit_comment_rate
BEFORE INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.limit_comment_rate();

COMMIT;
