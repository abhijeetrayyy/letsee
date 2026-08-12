-- 050_collaborative_lists.sql
-- Collaborative lists — the low-stakes, recurring co-op activity.
--
-- Two people can build a Kurosawa list together for months without the
-- commitment a club implies. It's the only repeat interaction in the product
-- that isn't a DM.
--
-- `added_by` is the whole social payoff: a shared list that shows
-- "Sam added Perfect Days" feels co-authored, one that doesn't feels like a
-- shared spreadsheet. One column.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_list_collaborators (
  list_id bigint NOT NULL REFERENCES public.user_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, user_id)
);

CREATE INDEX IF NOT EXISTS user_list_collaborators_user_idx
  ON public.user_list_collaborators (user_id);

CREATE TABLE IF NOT EXISTS public.user_list_follows (
  list_id bigint NOT NULL REFERENCES public.user_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, user_id)
);

CREATE INDEX IF NOT EXISTS user_list_follows_user_idx
  ON public.user_list_follows (user_id);

ALTER TABLE public.user_list_items
  ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- ── Editor helper (SECURITY DEFINER to avoid policy recursion) ──────────────
CREATE OR REPLACE FUNCTION public.is_list_editor(p_list bigint, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_lists WHERE id = p_list AND user_id = p_user)
      OR EXISTS (SELECT 1 FROM public.user_list_collaborators WHERE list_id = p_list AND user_id = p_user);
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_list_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_list_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS list_collaborators_select ON public.user_list_collaborators;
CREATE POLICY list_collaborators_select ON public.user_list_collaborators
  FOR SELECT USING (true);

-- Only the list owner can add or remove collaborators.
DROP POLICY IF EXISTS list_collaborators_write_owner ON public.user_list_collaborators;
CREATE POLICY list_collaborators_write_owner ON public.user_list_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_lists l WHERE l.id = list_id AND l.user_id = auth.uid())
  );

DROP POLICY IF EXISTS list_collaborators_delete ON public.user_list_collaborators;
CREATE POLICY list_collaborators_delete ON public.user_list_collaborators
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_lists l WHERE l.id = list_id AND l.user_id = auth.uid())
  );

DROP POLICY IF EXISTS list_follows_select ON public.user_list_follows;
CREATE POLICY list_follows_select ON public.user_list_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS list_follows_insert_self ON public.user_list_follows;
CREATE POLICY list_follows_insert_self ON public.user_list_follows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS list_follows_delete_self ON public.user_list_follows;
CREATE POLICY list_follows_delete_self ON public.user_list_follows
  FOR DELETE USING (auth.uid() = user_id);

-- ── Let collaborators edit list contents ───────────────────────────────────
-- Renaming and visibility stay owner-only; editing contents does not.
DROP POLICY IF EXISTS user_list_items_insert_owner ON public.user_list_items;
DROP POLICY IF EXISTS user_list_items_insert_editor ON public.user_list_items;
CREATE POLICY user_list_items_insert_editor ON public.user_list_items
  FOR INSERT WITH CHECK (public.is_list_editor(list_id, auth.uid()));

DROP POLICY IF EXISTS user_list_items_delete_owner ON public.user_list_items;
DROP POLICY IF EXISTS user_list_items_delete_editor ON public.user_list_items;
CREATE POLICY user_list_items_delete_editor ON public.user_list_items
  FOR DELETE USING (public.is_list_editor(list_id, auth.uid()));

DROP POLICY IF EXISTS user_list_items_update_owner ON public.user_list_items;
DROP POLICY IF EXISTS user_list_items_update_editor ON public.user_list_items;
CREATE POLICY user_list_items_update_editor ON public.user_list_items
  FOR UPDATE USING (public.is_list_editor(list_id, auth.uid()));

-- Collaborators must also be able to see a private list they're on.
DROP POLICY IF EXISTS user_lists_select_collaborator ON public.user_lists;
CREATE POLICY user_lists_select_collaborator ON public.user_lists
  FOR SELECT USING (
    visibility = 'public'
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_list_collaborators c
      WHERE c.list_id = id AND c.user_id = auth.uid()
    )
  );

COMMIT;
