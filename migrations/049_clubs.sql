-- 049_clubs.sql
-- Clubs: a group primitive built on what already exists.
--
-- Deliberately small. Discussion reuses `comments` (item_type='club'),
-- "I'm watching this" reuses `reactions` (target_type='club_pick'), and the
-- weekly pick reuses `club_picks` with a nullable club_id — NULL keeps meaning
-- the global house pick, which must stay visible to signed-out visitors with
-- no join step.
--
-- Public-only in v1: comments_select_public is USING (true), so a private
-- club's discussion would be readable by anyone who guessed an id. Adding a
-- visibility column later means reworking that policy, which currently serves
-- four other surfaces.

BEGIN;

CREATE TABLE IF NOT EXISTS public.clubs (
  id bigserial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  join_policy text NOT NULL DEFAULT 'open' CHECK (join_policy IN ('open', 'request')),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_members (
  club_id bigint NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'banned')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS club_members_user_active_idx
  ON public.club_members (user_id) WHERE status = 'active';

-- ── Membership helper ───────────────────────────────────────────────────────
-- A policy on club_members that itself queries club_members recurses forever.
-- Same SECURITY DEFINER escape hatch this codebase already uses for
-- is_blocked() and profile_visible_to_viewer().
CREATE OR REPLACE FUNCTION public.is_club_member(p_club bigint, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club AND user_id = p_user AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin(p_club bigint, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club AND user_id = p_user
      AND status = 'active' AND role IN ('owner', 'moderator')
  );
$$;

-- ── Keep member_count honest ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_club_member_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.clubs c
  SET member_count = (
    SELECT count(*) FROM public.club_members m
    WHERE m.club_id = c.id AND m.status = 'active'
  )
  WHERE c.id = COALESCE(NEW.club_id, OLD.club_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_club_member_count ON public.club_members;
CREATE TRIGGER trg_sync_club_member_count
AFTER INSERT OR UPDATE OR DELETE ON public.club_members
FOR EACH ROW EXECUTE FUNCTION public.sync_club_member_count();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clubs_select_all ON public.clubs;
CREATE POLICY clubs_select_all ON public.clubs FOR SELECT USING (true);

DROP POLICY IF EXISTS clubs_insert_self ON public.clubs;
CREATE POLICY clubs_insert_self ON public.clubs
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS clubs_update_admin ON public.clubs;
CREATE POLICY clubs_update_admin ON public.clubs
  FOR UPDATE USING (public.is_club_admin(id, auth.uid()));

DROP POLICY IF EXISTS clubs_delete_owner ON public.clubs;
CREATE POLICY clubs_delete_owner ON public.clubs
  FOR DELETE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS club_members_select_all ON public.club_members;
CREATE POLICY club_members_select_all ON public.club_members FOR SELECT USING (true);

-- Join yourself. Blocked users can't join a club run by someone who blocked them.
DROP POLICY IF EXISTS club_members_insert_self ON public.club_members;
CREATE POLICY club_members_insert_self ON public.club_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Leave yourself; admins can remove others.
DROP POLICY IF EXISTS club_members_delete_self_or_admin ON public.club_members;
CREATE POLICY club_members_delete_self_or_admin ON public.club_members
  FOR DELETE USING (auth.uid() = user_id OR public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS club_members_update_admin ON public.club_members;
CREATE POLICY club_members_update_admin ON public.club_members
  FOR UPDATE USING (public.is_club_admin(club_id, auth.uid()));

-- ── Club-scoped picks ───────────────────────────────────────────────────────
ALTER TABLE public.club_picks
  ADD COLUMN IF NOT EXISTS club_id bigint REFERENCES public.clubs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS club_picks_club_idx ON public.club_picks (club_id, starts_at DESC);

-- Replace the SELECT-only policy: club admins can now manage their own club's
-- picks. The global pick (club_id IS NULL) still has no write policy and stays
-- admin-only via the SQL editor.
DROP POLICY IF EXISTS club_picks_select_all ON public.club_picks;
CREATE POLICY club_picks_select_all ON public.club_picks FOR SELECT USING (true);

DROP POLICY IF EXISTS club_picks_write_admin ON public.club_picks;
CREATE POLICY club_picks_write_admin ON public.club_picks
  FOR INSERT WITH CHECK (club_id IS NOT NULL AND public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS club_picks_update_admin ON public.club_picks;
CREATE POLICY club_picks_update_admin ON public.club_picks
  FOR UPDATE USING (club_id IS NOT NULL AND public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS club_picks_delete_admin ON public.club_picks;
CREATE POLICY club_picks_delete_admin ON public.club_picks
  FOR DELETE USING (club_id IS NOT NULL AND public.is_club_admin(club_id, auth.uid()));

-- ── Reuse comments + reactions instead of new tables ────────────────────────
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_item_type_check;
ALTER TABLE public.comments ADD CONSTRAINT comments_item_type_check
  CHECK (item_type IN ('movie', 'tv', 'review', 'episode', 'club_pick', 'club'));

ALTER TABLE public.reactions DROP CONSTRAINT IF EXISTS reactions_target_type_check;
ALTER TABLE public.reactions ADD CONSTRAINT reactions_target_type_check
  CHECK (target_type IN ('review', 'watched', 'rating', 'list', 'comment', 'activity', 'club_pick'));

COMMIT;
