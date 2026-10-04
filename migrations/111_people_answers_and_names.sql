-- 111_people_answers_and_names.sql
-- Fixes from the review of 108–110.
--
-- 1. `are_people(a, b)` was callable by anyone about any two people, which
--    told a stranger whether A and B had messaged (a room) or blocked each
--    other. It is now internal; the policy and the client ask only about
--    themselves through `is_my_person(other)`.
-- 2. `title_recommendations.ask_id` could be set by a direct insert or by the
--    recipient's update, attaching an "answer" to someone's ask without any of
--    `answer_ask`'s checks. Only definer functions may set it now.
-- 3. `answer_ask` re-tagged an existing pass, so answering a second ask with a
--    film you had already used for the first moved the answer away from it.
--    It now refuses ('already') and sends nothing.
-- 4. `create_viewing_link` read the title's name only from
--    `user_media_status`; the diary also falls back to `watched_items`.
-- 5. `open_share_link`'s `list_count` counted titles `open_shared_list_items`
--    leaves out (adult ones).
--
-- Idempotent.

BEGIN;

-- ── 1 ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_my_person(p_other uuid)
RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT public.are_people(auth.uid(), p_other);
$$;
REVOKE ALL ON FUNCTION public.are_people(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_my_person(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_person(uuid) TO authenticated;

DROP POLICY IF EXISTS asks_select_own_or_people ON public.asks;
CREATE POLICY asks_select_own_or_people ON public.asks
  FOR SELECT USING (
    auth.uid() = user_id
    OR (closed_at IS NULL AND closes_at > now() AND public.is_my_person(user_id))
  );

-- ── 2 ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_recommendation_ask() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
AS $$
BEGIN
  -- Direct writes from the API roles may not choose an ask; definer
  -- functions (answer_ask) run as the table owner and may.
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.ask_id := NULL;
    ELSIF NEW.ask_id IS DISTINCT FROM OLD.ask_id THEN
      NEW.ask_id := OLD.ask_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_recommendation_ask ON public.title_recommendations;
CREATE TRIGGER trg_guard_recommendation_ask BEFORE INSERT OR UPDATE ON public.title_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.guard_recommendation_ask();

-- ── 3 ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.answer_ask(
  p_ask_id bigint,
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
  v_ask public.asks%ROWTYPE;
  v_existing public.title_recommendations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in to answer' USING ERRCODE = '42501';
  END IF;
  IF p_item_type NOT IN ('movie', 'tv') OR p_item_id !~ '^[0-9]{1,9}$' OR length(btrim(coalesce(p_item_name, ''))) = 0 THEN
    RAISE EXCEPTION 'pick a film or a series' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ask FROM public.asks WHERE id = p_ask_id AND closed_at IS NULL AND closes_at > now();
  IF NOT FOUND OR v_ask.user_id = v_uid OR NOT public.are_people(v_uid, v_ask.user_id) THEN
    RETURN 'gone';
  END IF;
  IF (SELECT count(*) FROM public.title_recommendations WHERE ask_id = p_ask_id AND from_user_id = v_uid) >= 3 THEN
    RETURN 'enough';
  END IF;
  -- A pass of this title from you to them already exists. If it answers
  -- another ask, leave it there; if it answers this one, nothing to do.
  SELECT * INTO v_existing FROM public.title_recommendations
   WHERE from_user_id = v_uid AND to_user_id = v_ask.user_id AND item_id = p_item_id AND item_type = p_item_type;
  IF FOUND AND v_existing.ask_id IS NOT NULL THEN
    RETURN CASE WHEN v_existing.ask_id = p_ask_id THEN 'answered' ELSE 'already' END;
  END IF;

  INSERT INTO public.messages (sender_id, recipient_id, content, message_type, metadata)
  VALUES (
    v_uid, v_ask.user_id, left(btrim(coalesce(p_note, '')), 280), 'cardmix',
    jsonb_build_object('media_type', p_item_type, 'media_id', p_item_id, 'media_name', left(btrim(p_item_name), 300), 'media_image', nullif(left(coalesce(p_image_url, ''), 500), ''), 'ask_id', p_ask_id)
  );
  -- 097's trigger recorded the pass (or found the earlier one, untagged);
  -- either way it answers this ask now, and comes back to their Up next.
  UPDATE public.title_recommendations
     SET ask_id = p_ask_id, dismissed_at = NULL
   WHERE from_user_id = v_uid AND to_user_id = v_ask.user_id AND item_id = p_item_id AND item_type = p_item_type
     AND ask_id IS NULL;
  RETURN 'answered';
END $$;
REVOKE ALL ON FUNCTION public.answer_ask(bigint, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_ask(bigint, text, text, text, text, text) TO authenticated;

-- ── 4 ──────────────────────────────────────────────────────────────────────
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
   WHERE s.user_id = v_uid AND s.item_id = v_view.item_id AND s.item_type = v_view.item_type AND coalesce(btrim(s.item_name), '') <> ''
   LIMIT 1;
  IF v_name IS NULL THEN
    SELECT w.item_name, w.image_url INTO v_name, v_image
      FROM public.watched_items w
     WHERE w.user_id = v_uid AND w.item_id = v_view.item_id AND w.item_type = v_view.item_type AND coalesce(btrim(w.item_name), '') <> ''
     LIMIT 1;
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'that title has no name to show' USING ERRCODE = '22023';
  END IF;
  v_token := public.share_link_token(v_uid);
  INSERT INTO public.share_links (token, kind, created_by, viewing_id, item_id, item_type, item_name, image_url)
  VALUES (v_token, 'viewing', v_uid, v_view.id, v_view.item_id, v_view.item_type, left(v_name, 300), left(v_image, 500));
  RETURN v_token;
END $$;

-- ── 5 ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_share_link(p_token text)
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
           (SELECT count(*)::integer FROM public.user_list_items i WHERE i.list_id = l.id AND coalesce(i.item_adult, false) = false)
      FROM public.share_links s
      JOIN public.users u ON u.id = s.created_by AND u.deleted_at IS NULL
      LEFT JOIN public.viewings v ON v.id = s.viewing_id
      LEFT JOIN public.user_lists l ON l.id = s.list_id
     WHERE s.token = p_token AND s.revoked_at IS NULL AND s.expires_at > now();
END $$;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.are_people(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'are_people is still callable by authenticated';
  END IF;
  IF to_regprocedure('public.is_my_person(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_my_person is missing';
  END IF;
  RAISE NOTICE 'verified: are_people internal, ask_id guarded, answer_ask and names fixed';
END $$;

COMMIT;
