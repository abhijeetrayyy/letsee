-- 114_was_there_means_named_by_them.sql
-- Fixes from the review of 112.
--
-- 1. `were_there_together` let a reader in when *they* had named the author on
--    their own viewing and the companion row carried a `linked_viewing_id` —
--    meant as "the author confirmed with I was there too". But the owner of a
--    viewing may write every column of its companion rows
--    (`viewing_companions_owner_all`), and the link only has to point at some
--    viewing, their own included. So anyone could name anyone, set the link
--    themselves, and read that person's "us" words on any title — without the
--    person ever being told, because `notify_co_log_invite` stays silent for a
--    row that is already linked. The clause goes: `accept_co_log` writes the
--    reciprocal row on the confirmer's new viewing, naming the original
--    logger, so "the author named you" already covers every real
--    confirmation, in both directions.
-- 2. `linked_viewing_id` is now written only by definer functions
--    (`accept_co_log`). From the API roles an insert can't set it and an
--    update can't change it — which also stops a pre-linked row being used to
--    name someone silently. The app only ever reads it.
--
-- Idempotent.

BEGIN;

-- ── 1 ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.were_there_together(p_author uuid, p_item_id text, p_item_type text)
RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_author IS NOT NULL
     AND p_author <> auth.uid()
     AND NOT public.is_blocked(auth.uid(), p_author)
     AND EXISTS (
       SELECT 1
         FROM public.viewings v
         JOIN public.viewing_companions c ON c.viewing_id = v.id
        WHERE v.user_id = p_author AND v.item_id = p_item_id AND v.item_type = p_item_type
          AND c.companion_user_id = auth.uid()
     );
$$;
REVOKE ALL ON FUNCTION public.were_there_together(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.were_there_together(uuid, text, text) TO authenticated;

-- ── 2 ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_companion_link() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.linked_viewing_id := NULL;
    ELSIF NEW.linked_viewing_id IS DISTINCT FROM OLD.linked_viewing_id THEN
      NEW.linked_viewing_id := OLD.linked_viewing_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_companion_link ON public.viewing_companions;
CREATE TRIGGER trg_guard_companion_link BEFORE INSERT OR UPDATE ON public.viewing_companions
  FOR EACH ROW EXECUTE FUNCTION public.guard_companion_link();

DO $$
BEGIN
  IF to_regprocedure('public.guard_companion_link()') IS NULL THEN
    RAISE EXCEPTION 'guard_companion_link is missing';
  END IF;
  RAISE NOTICE 'verified: us words need the author to have named you; links are the server''s to write';
END $$;

COMMIT;
