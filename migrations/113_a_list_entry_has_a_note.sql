-- 113_a_list_entry_has_a_note.sql
-- A title on a list can carry a line about why it's there.
--
-- ── Why ────────────────────────────────────────────────────────────────────
-- A list made with someone is a conversation — "watch this one first", "the
-- best of the three", "for when you're sad" — and until now it could only
-- hold titles (EXECUTION.md, lists: "per-entry notes need a column"). The
-- note belongs to the entry, not to the person: any keeper of the list may
-- write or change it, under the existing `user_list_items_update_editor`
-- policy (`is_list_editor`), so no new policy is needed.
--
-- `open_shared_list_items` returns the note too, so a list shared by link
-- shows the same page its keepers see. Its result type changes, so it is
-- dropped and recreated with its grants.
--
-- Idempotent.

BEGIN;

ALTER TABLE public.user_list_items ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.user_list_items DROP CONSTRAINT IF EXISTS user_list_items_note_check;
ALTER TABLE public.user_list_items ADD CONSTRAINT user_list_items_note_check
  CHECK (note IS NULL OR (length(btrim(note)) BETWEEN 1 AND 280));

DROP FUNCTION IF EXISTS public.open_shared_list_items(text);
CREATE FUNCTION public.open_shared_list_items(p_token text)
RETURNS TABLE(item_id text, item_type text, item_name text, image_url text, note text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT i.item_id, i.item_type, i.item_name, i.image_url, i.note
    FROM public.share_links s
    JOIN public.users u ON u.id = s.created_by AND u.deleted_at IS NULL
    JOIN public.user_list_items i ON i.list_id = s.list_id
   WHERE p_token ~ '^[0-9a-f]{32}$' AND s.token = p_token AND s.kind = 'list'
     AND s.revoked_at IS NULL AND s.expires_at > now()
     AND coalesce(i.item_adult, false) = false
   ORDER BY i.position NULLS LAST, i.created_at
   LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.open_shared_list_items(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_shared_list_items(text) TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_list_items' AND column_name = 'note') THEN
    RAISE EXCEPTION 'user_list_items.note is missing';
  END IF;
  IF NOT has_function_privilege('anon', 'public.open_shared_list_items(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'open_shared_list_items lost its grant';
  END IF;
  RAISE NOTICE 'verified: list entries take a note, shared lists show it';
END $$;

COMMIT;
