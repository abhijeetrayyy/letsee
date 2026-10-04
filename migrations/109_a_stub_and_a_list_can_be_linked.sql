-- 109_a_stub_and_a_list_can_be_linked.sql
-- One night from your diary, or one of your lists, as a link for anyone.
--
-- ── Why ────────────────────────────────────────────────────────────────────
-- 108 made a pass a link. The other two things people want to show someone
-- who isn't on letsee are a night ("we saw Past Lives at the Curzon, Friday")
-- and a list ("my ten favourite Ozus") — including a list that is private or
-- for followers only, which a plain URL can't open (EXECUTION.md step 9).
--
-- ── Shape ──────────────────────────────────────────────────────────────────
-- `share_links` gains two kinds. A `viewing` link points at one row of the
-- maker's own diary and copies the title for display; a `list` link points at
-- one of the maker's own lists. Deleting the viewing or the list deletes its
-- links. Per kind, exactly the right reference must be present.
--
-- ── Safety ─────────────────────────────────────────────────────────────────
-- Only the owner of the viewing or the list can make its link
-- (`create_viewing_link`, `create_list_link`). `open_share_link` is the only
-- way anyone else reads a link, and for these kinds it returns: the title,
-- the day, whether it was a rewatch and at the cinema, and how many people
-- were there — never who; for a list, its name, description and up to 100
-- titles. Same expiry, revocation, rate limit and token rules as 108.
--
-- Idempotent.

BEGIN;

ALTER TABLE public.share_links ADD COLUMN IF NOT EXISTS viewing_id bigint REFERENCES public.viewings(id) ON DELETE CASCADE;
ALTER TABLE public.share_links ADD COLUMN IF NOT EXISTS list_id bigint REFERENCES public.user_lists(id) ON DELETE CASCADE;
ALTER TABLE public.share_links ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE public.share_links ALTER COLUMN item_type DROP NOT NULL;
ALTER TABLE public.share_links ALTER COLUMN item_name DROP NOT NULL;

ALTER TABLE public.share_links DROP CONSTRAINT IF EXISTS share_links_kind_check;
ALTER TABLE public.share_links ADD CONSTRAINT share_links_kind_check CHECK (kind IN ('pass', 'viewing', 'list'));
ALTER TABLE public.share_links DROP CONSTRAINT IF EXISTS share_links_reference_check;
ALTER TABLE public.share_links ADD CONSTRAINT share_links_reference_check CHECK (
  (kind = 'pass' AND item_id IS NOT NULL AND item_type IS NOT NULL AND item_name IS NOT NULL AND viewing_id IS NULL AND list_id IS NULL)
  OR (kind = 'viewing' AND viewing_id IS NOT NULL AND item_id IS NOT NULL AND item_type IS NOT NULL AND item_name IS NOT NULL AND list_id IS NULL)
  OR (kind = 'list' AND list_id IS NOT NULL AND viewing_id IS NULL)
);

-- A shared rate limit for every kind: 30 links an hour per person.
CREATE OR REPLACE FUNCTION public.share_link_token(p_uid uuid)
RETURNS text
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF p_uid IS NULL THEN
    RAISE EXCEPTION 'sign in to send a link' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.share_links WHERE created_by = p_uid AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'too many links this hour' USING ERRCODE = '54000';
  END IF;
  RETURN replace(gen_random_uuid()::text, '-', '');
END $$;
REVOKE ALL ON FUNCTION public.share_link_token(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_viewing_link(p_viewing_id bigint)
RETURNS text
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_view public.viewings%ROWTYPE;
  v_name text;
  v_image text;
  v_token text;
BEGIN
  SELECT * INTO v_view FROM public.viewings WHERE id = p_viewing_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'that night is not in your diary' USING ERRCODE = '42501';
  END IF;
  SELECT s.item_name, s.image_url INTO v_name, v_image
    FROM public.user_media_status s
   WHERE s.user_id = v_uid AND s.item_id = v_view.item_id AND s.item_type = v_view.item_type
   LIMIT 1;
  IF v_name IS NULL OR btrim(v_name) = '' THEN
    RAISE EXCEPTION 'that title has no name to show' USING ERRCODE = '22023';
  END IF;
  v_token := public.share_link_token(v_uid);
  INSERT INTO public.share_links (token, kind, created_by, viewing_id, item_id, item_type, item_name, image_url)
  VALUES (v_token, 'viewing', v_uid, v_view.id, v_view.item_id, v_view.item_type, left(v_name, 300), left(v_image, 500));
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.create_list_link(p_list_id bigint)
RETURNS text
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_lists WHERE id = p_list_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'that list is not yours' USING ERRCODE = '42501';
  END IF;
  v_token := public.share_link_token(v_uid);
  INSERT INTO public.share_links (token, kind, created_by, list_id)
  VALUES (v_token, 'list', v_uid, p_list_id);
  RETURN v_token;
END $$;

-- open_share_link returns more columns now, so it is replaced, not altered.
DROP FUNCTION IF EXISTS public.open_share_link(text);
CREATE FUNCTION public.open_share_link(p_token text)
RETURNS TABLE(
  kind text, item_id text, item_type text, item_name text, image_url text, note text,
  from_username text, from_avatar text, expires_at timestamp with time zone,
  watched_on date, rewatch boolean, place text, company integer,
  list_name text, list_description text, list_count integer
)
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
    RETURN;
  END IF;
  UPDATE public.share_links s SET opened_count = s.opened_count + 1
   WHERE s.token = p_token AND s.revoked_at IS NULL AND s.expires_at > now();
  RETURN QUERY
    SELECT s.kind, s.item_id, s.item_type, s.item_name, s.image_url, s.note,
           u.username::text, u.avatar_url::text, s.expires_at,
           v.watched_on, v.rewatch, v.place,
           (SELECT count(*)::integer FROM public.viewing_companions c WHERE c.viewing_id = v.id),
           l.name::text, l.description::text,
           (SELECT count(*)::integer FROM public.user_list_items i WHERE i.list_id = l.id)
      FROM public.share_links s
      JOIN public.users u ON u.id = s.created_by AND u.deleted_at IS NULL
      LEFT JOIN public.viewings v ON v.id = s.viewing_id
      LEFT JOIN public.user_lists l ON l.id = s.list_id
     WHERE s.token = p_token AND s.revoked_at IS NULL AND s.expires_at > now();
END $$;

-- A list link's titles, in the list's order.
CREATE OR REPLACE FUNCTION public.open_shared_list_items(p_token text)
RETURNS TABLE(item_id text, item_type text, item_name text, image_url text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT i.item_id, i.item_type, i.item_name, i.image_url
    FROM public.share_links s
    JOIN public.users u ON u.id = s.created_by AND u.deleted_at IS NULL
    JOIN public.user_list_items i ON i.list_id = s.list_id
   WHERE p_token ~ '^[0-9a-f]{32}$' AND s.token = p_token AND s.kind = 'list'
     AND s.revoked_at IS NULL AND s.expires_at > now()
     AND coalesce(i.item_adult, false) = false
   ORDER BY i.position NULLS LAST, i.created_at
   LIMIT 100;
$$;

-- Keeping applies to passes only; a stub or a list is something to look at.
CREATE OR REPLACE FUNCTION public.claim_share_link(p_token text)
RETURNS text
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link public.share_links%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in to keep it' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
    RETURN 'gone';
  END IF;
  SELECT * INTO v_link FROM public.share_links WHERE token = p_token AND kind = 'pass' AND revoked_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN
    RETURN 'gone';
  END IF;
  IF v_link.created_by = v_uid THEN
    RETURN 'yours';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
     WHERE (b.blocker_id = v_uid AND b.blocked_id = v_link.created_by)
        OR (b.blocker_id = v_link.created_by AND b.blocked_id = v_uid)
  ) THEN
    RETURN 'gone';
  END IF;
  INSERT INTO public.title_recommendations (from_user_id, to_user_id, item_id, item_type, item_name, image_url, note)
  VALUES (v_link.created_by, v_uid, v_link.item_id, v_link.item_type, v_link.item_name, v_link.image_url, v_link.note)
  ON CONFLICT (from_user_id, to_user_id, item_id, item_type) DO NOTHING;
  RETURN 'kept';
END $$;

-- create_pass_link keeps its 108 body; it only gains the shared limiter.
CREATE OR REPLACE FUNCTION public.create_pass_link(
  p_item_id text,
  p_item_type text,
  p_item_name text,
  p_image_url text,
  p_note text
)
RETURNS text
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  v_token := public.share_link_token(v_uid);
  INSERT INTO public.share_links (token, kind, created_by, item_id, item_type, item_name, image_url, note)
  VALUES (v_token, 'pass', v_uid, btrim(p_item_id), p_item_type, left(btrim(p_item_name), 300), nullif(left(coalesce(p_image_url, ''), 500), ''), left(v_note, 500));
  RETURN v_token;
END $$;

REVOKE ALL ON FUNCTION public.create_viewing_link(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_list_link(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_share_link(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_shared_list_items(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_viewing_link(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_list_link(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_share_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_shared_list_items(text) TO anon, authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.create_viewing_link(bigint)') IS NULL OR to_regprocedure('public.create_list_link(bigint)') IS NULL
     OR to_regprocedure('public.open_share_link(text)') IS NULL OR to_regprocedure('public.open_shared_list_items(text)') IS NULL THEN
    RAISE EXCEPTION 'a share-link function is missing';
  END IF;
  RAISE NOTICE 'verified: viewing and list links in place';
END $$;

COMMIT;
