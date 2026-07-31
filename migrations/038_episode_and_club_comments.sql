-- 038_episode_and_club_comments.sql
-- Extends comments to cover per-episode discussion threads and a recurring
-- "Club Pick" watch-along, reusing the existing comments/reactions/RLS
-- machinery rather than building new rooms/chat infra.
--
-- comments.item_type gains 'episode' (item_id = "{showId}-s{season}-e{episode}")
-- and 'club_pick' (item_id = club_picks.id). None of the 4 RLS policies on
-- comments branch on item_type, so no policy changes are needed here.

BEGIN;

ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_item_type_check;
ALTER TABLE public.comments ADD CONSTRAINT comments_item_type_check
  CHECK (item_type IN ('movie', 'tv', 'review', 'episode', 'club_pick'));

CREATE TABLE IF NOT EXISTS public.club_picks (
  id BIGSERIAL PRIMARY KEY,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  image_url TEXT,
  note TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  picked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_picks_starts_at_idx ON public.club_picks (starts_at DESC);

ALTER TABLE public.club_picks ENABLE ROW LEVEL SECURITY;

-- Deliberately SELECT-only: there is no admin-role concept in this app yet,
-- so no INSERT/UPDATE policy exists. The active pick is set for now by
-- running a manual INSERT in the Supabase SQL editor. Do NOT add a write
-- policy here to "fix" that -- it would let any authenticated user set the
-- active pick for everyone.
CREATE POLICY "club_picks_select_all" ON public.club_picks FOR SELECT USING (true);

COMMIT;
