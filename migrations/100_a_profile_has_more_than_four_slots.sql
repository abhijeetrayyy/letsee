-- 100_a_profile_has_more_than_four_slots.sql
-- Three small identity slots beside Taste in Four: four people, a comfort
-- watch, and a hill to die on.
--
-- ── Why ────────────────────────────────────────────────────────────────────
-- Taste is the strongest predictor of liking a stranger (Launay & Dunbar
-- 2015), and a finite, editable identity slot is the cheapest durable reason
-- to keep a profile current. Letterboxd's single most-upvoted 2025 wish was
-- to extend the four favourites to *people*. docs/WHY_PEOPLE_COME_BACK.md
-- §3.2, §9 Bet 10.
--
-- ── Why a new table ────────────────────────────────────────────────────────
-- `user_favorite_display` is CHECKed to movie/tv and to positions 1..4, and
-- the route, the editor and the profile page all assume exactly that. Widening
-- it would put people and films in one list with one meaning. A slot is a
-- different object: it has a *kind*, and only one kind holds four.
--
-- `line` is the one sentence a "hill" carries ("Speed 2 is better than
-- Speed"). Visible exactly as widely as the profile.
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_identity_slots (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    slot text NOT NULL,
    "position" smallint NOT NULL DEFAULT 1,
    item_id text NOT NULL,
    item_type text NOT NULL,
    item_name text NOT NULL,
    image_url text,
    line text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT user_identity_slots_pkey PRIMARY KEY (user_id, slot, "position"),
    CONSTRAINT user_identity_slots_slot_check CHECK (slot IN ('person', 'comfort', 'hill')),
    CONSTRAINT user_identity_slots_position_check CHECK ("position" >= 1 AND "position" <= 4),
    CONSTRAINT user_identity_slots_item_type_check CHECK (item_type IN ('movie', 'tv', 'person')),
    -- People fill the person slot; titles fill the other two; only people
    -- take more than one position.
    CONSTRAINT user_identity_slots_shape_check CHECK (
      (slot = 'person' AND item_type = 'person')
      OR (slot IN ('comfort', 'hill') AND item_type IN ('movie', 'tv') AND "position" = 1)
    ),
    CONSTRAINT user_identity_slots_line_check CHECK (line IS NULL OR char_length(line) <= 140)
);

ALTER TABLE public.user_identity_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_identity_slots_self ON public.user_identity_slots;
CREATE POLICY user_identity_slots_self ON public.user_identity_slots
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_identity_slots_select_visible ON public.user_identity_slots;
CREATE POLICY user_identity_slots_select_visible ON public.user_identity_slots
  FOR SELECT USING (auth.uid() = user_id OR public.profile_visible_to_viewer(user_id));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_identity_slots FROM anon;
GRANT SELECT ON TABLE public.user_identity_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_identity_slots TO authenticated, service_role;

DROP TRIGGER IF EXISTS set_user_identity_slots_updated_at ON public.user_identity_slots;
CREATE TRIGGER set_user_identity_slots_updated_at BEFORE UPDATE ON public.user_identity_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE tablename = 'user_identity_slots') <> 2 THEN
    RAISE EXCEPTION 'user_identity_slots should carry 2 policies';
  END IF;
  RAISE NOTICE 'verified: identity slots in place';
END $$;

COMMIT;
