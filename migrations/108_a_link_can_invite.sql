-- 108_a_link_can_invite.sql
-- A pass you can send to anyone, as a link — including someone not on letsee.
--
-- ── Why ────────────────────────────────────────────────────────────────────
-- A pass is a film from one person to another (097). It needed both to be on
-- letsee, which made it useless for the one thing it is best at: bringing
-- someone in. Now a pass can be a link. Whoever opens it sees the film, the
-- note and who sent it, on the invited door (`/invite?t=…`); joining, or
-- opening it signed in, keeps the pass in their Up next, from you
-- (docs/design/RETHINK.md §3b; EXECUTION.md step 9).
--
-- ── Safety ─────────────────────────────────────────────────────────────────
-- * The token is a v4 UUID's 122 random bits as 32 hex characters, never
--   derived from anything guessable.
-- * Nobody reads `share_links` directly except the person who made the row.
--   Everyone else goes through `open_share_link`, which returns only what the
--   door shows — the title, the note, the sender's public name and face — and
--   nothing for a link that is revoked, expired, malformed or whose sender's
--   account is gone.
-- * Links expire after 30 days and can be revoked. Making them is limited to
--   30 an hour per person.
-- * Keeping a pass (`claim_share_link`) refuses yourself and anyone either of
--   you has blocked.
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.share_links (
    token text PRIMARY KEY,
    kind text NOT NULL DEFAULT 'pass',
    created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    item_id text NOT NULL,
    item_type text NOT NULL,
    item_name text NOT NULL,
    image_url text,
    note text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
    revoked_at timestamp with time zone,
    opened_count integer NOT NULL DEFAULT 0,
    CONSTRAINT share_links_token_check CHECK (token ~ '^[0-9a-f]{32}$'),
    CONSTRAINT share_links_kind_check CHECK (kind IN ('pass')),
    CONSTRAINT share_links_item_type_check CHECK (item_type IN ('movie', 'tv')),
    CONSTRAINT share_links_item_id_check CHECK (item_id ~ '^[0-9]{1,9}$'),
    CONSTRAINT share_links_name_check CHECK (length(item_name) BETWEEN 1 AND 300),
    CONSTRAINT share_links_image_check CHECK (image_url IS NULL OR length(image_url) <= 500),
    CONSTRAINT share_links_note_check CHECK (note IS NULL OR length(note) <= 500)
);

CREATE INDEX IF NOT EXISTS share_links_creator_idx ON public.share_links USING btree (created_by, created_at DESC);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS share_links_select_own ON public.share_links;
CREATE POLICY share_links_select_own ON public.share_links
  FOR SELECT USING (auth.uid() = created_by);

REVOKE ALL ON TABLE public.share_links FROM anon, authenticated;
GRANT SELECT ON TABLE public.share_links TO authenticated;

-- ── Make one ───────────────────────────────────────────────────────────────
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in to send a link' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.share_links WHERE created_by = v_uid AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'too many links this hour' USING ERRCODE = '54000';
  END IF;
  v_token := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.share_links (token, kind, created_by, item_id, item_type, item_name, image_url, note)
  VALUES (v_token, 'pass', v_uid, btrim(p_item_id), p_item_type, left(btrim(p_item_name), 300), nullif(left(coalesce(p_image_url, ''), 500), ''), left(v_note, 500));
  RETURN v_token;
END $$;

-- ── Open one: the only way anyone else sees a link ─────────────────────────
CREATE OR REPLACE FUNCTION public.open_share_link(p_token text)
RETURNS TABLE(kind text, item_id text, item_type text, item_name text, image_url text, note text, from_username text, from_avatar text, expires_at timestamp with time zone)
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
    SELECT s.kind, s.item_id, s.item_type, s.item_name, s.image_url, s.note, u.username::text, u.avatar_url::text, s.expires_at
      FROM public.share_links s
      JOIN public.users u ON u.id = s.created_by AND u.deleted_at IS NULL
     WHERE s.token = p_token AND s.revoked_at IS NULL AND s.expires_at > now();
END $$;

-- ── Keep it: the pass lands in your Up next, from them ─────────────────────
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
  SELECT * INTO v_link FROM public.share_links WHERE token = p_token AND revoked_at IS NULL AND expires_at > now();
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

-- ── Stop one ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_share_link(p_token text)
RETURNS boolean
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  WITH r AS (
    UPDATE public.share_links SET revoked_at = now()
     WHERE token = p_token AND created_by = auth.uid() AND revoked_at IS NULL
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM r);
$$;

REVOKE ALL ON FUNCTION public.create_pass_link(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_share_link(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_share_link(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_share_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pass_link(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_share_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_share_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_share_link(text) TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.share_links') IS NULL THEN
    RAISE EXCEPTION 'share_links is missing';
  END IF;
  IF to_regprocedure('public.open_share_link(text)') IS NULL OR to_regprocedure('public.claim_share_link(text)') IS NULL
     OR to_regprocedure('public.create_pass_link(text, text, text, text, text)') IS NULL OR to_regprocedure('public.revoke_share_link(text)') IS NULL THEN
    RAISE EXCEPTION 'a share-link function is missing';
  END IF;
  RAISE NOTICE 'verified: share_links and its four functions in place';
END $$;

COMMIT;
