-- 112_words_can_be_for_us.sql
-- Your words about a film can be for the people who watched it with you.
-- (Planned as 105, `words_can_be_for_us`; the numbers moved on before it ran.)
--
-- ── Why ────────────────────────────────────────────────────────────────────
-- The log sheet offered *Just me* or *Shelf*: a private note, or a review for
-- everyone. The thing most people actually want to say after a film is said
-- to whoever was on the sofa — "Us" (docs/design/RETHINK.md §7, the LogSheet's
-- three audiences). A viewing already knows who was there (096); this lets a
-- take be read by exactly them.
--
-- ── Shape ──────────────────────────────────────────────────────────────────
-- `takes.visibility` is 'me' | 'us' | 'shelf'. `takes_identity_key` includes
-- `is_public`, so a person holds at most one public and one non-public take
-- per thing; "us" is therefore a property of the non-public row, never a
-- third row. `is_public` stays the column every existing reader and the
-- legacy mirror use, and a trigger keeps the two in step: public is 'shelf',
-- and a non-public row is 'us' only when a writer said so. Writers that don't
-- know the column (the importer, older routes) leave it as it was.
--
-- ── Who may read an "us" take ──────────────────────────────────────────────
-- A signed-in reader, about an author, for one title, when either
--   (a) the author named the reader on a viewing of that title, or
--   (b) the reader named the author and the author confirmed ("I was there
--       too" linked the two viewings),
-- and neither has blocked the other. Naming someone yourself is not enough:
-- anyone can type a name onto their own viewing. The test is a SECURITY
-- DEFINER function about the caller only, like `is_my_person` (111), so it
-- tells nobody anything about anyone else; and the policy is `TO
-- authenticated`, so signed-out reads of public reviews never evaluate it.
--
-- Idempotent.

BEGIN;

ALTER TABLE public.takes ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'me';

-- The backfill is not an edit: `set_takes_updated_at` would stamp every public
-- row with now() and reorder reviews by it (the first run did, to one review,
-- whose time was restored by hand). Paused for this one statement.
ALTER TABLE public.takes DISABLE TRIGGER set_takes_updated_at;
UPDATE public.takes
   SET visibility = CASE WHEN is_public THEN 'shelf' WHEN visibility = 'us' THEN 'us' ELSE 'me' END
 WHERE visibility IS DISTINCT FROM (CASE WHEN is_public THEN 'shelf' WHEN visibility = 'us' THEN 'us' ELSE 'me' END);
ALTER TABLE public.takes ENABLE TRIGGER set_takes_updated_at;

CREATE OR REPLACE FUNCTION public.takes_visibility_follows_public() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
AS $$
BEGIN
  NEW.visibility := CASE
    WHEN NEW.is_public THEN 'shelf'
    WHEN NEW.visibility = 'us' THEN 'us'
    ELSE 'me'
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_takes_visibility ON public.takes;
CREATE TRIGGER trg_takes_visibility BEFORE INSERT OR UPDATE ON public.takes
  FOR EACH ROW EXECUTE FUNCTION public.takes_visibility_follows_public();

ALTER TABLE public.takes DROP CONSTRAINT IF EXISTS takes_visibility_check;
ALTER TABLE public.takes ADD CONSTRAINT takes_visibility_check
  CHECK (visibility IN ('me', 'us', 'shelf') AND (visibility = 'shelf') = is_public);

CREATE INDEX IF NOT EXISTS takes_us_idx ON public.takes USING btree (item_id, item_type, user_id) WHERE visibility = 'us';

-- ── Were we there together? ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.were_there_together(p_author uuid, p_item_id text, p_item_type text)
RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_author IS NOT NULL
     AND p_author <> auth.uid()
     AND NOT public.is_blocked(auth.uid(), p_author)
     AND (
       EXISTS (
         SELECT 1
           FROM public.viewings v
           JOIN public.viewing_companions c ON c.viewing_id = v.id
          WHERE v.user_id = p_author AND v.item_id = p_item_id AND v.item_type = p_item_type
            AND c.companion_user_id = auth.uid()
       )
       OR EXISTS (
         SELECT 1
           FROM public.viewings v
           JOIN public.viewing_companions c ON c.viewing_id = v.id
          WHERE v.user_id = auth.uid() AND v.item_id = p_item_id AND v.item_type = p_item_type
            AND c.companion_user_id = p_author AND c.linked_viewing_id IS NOT NULL
       )
     );
$$;
REVOKE ALL ON FUNCTION public.were_there_together(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.were_there_together(uuid, text, text) TO authenticated;

DROP POLICY IF EXISTS takes_us_read ON public.takes;
CREATE POLICY takes_us_read ON public.takes
  FOR SELECT TO authenticated
  USING (visibility = 'us' AND public.were_there_together(user_id, item_id, item_type));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.takes WHERE (visibility = 'shelf') <> is_public) THEN
    RAISE EXCEPTION 'takes.visibility disagrees with is_public';
  END IF;
  IF has_function_privilege('anon', 'public.were_there_together(uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'were_there_together is callable signed out';
  END IF;
  RAISE NOTICE 'verified: takes.visibility in step with is_public, us readable by who was there';
END $$;

COMMIT;
