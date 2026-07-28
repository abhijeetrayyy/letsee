-- 029_unified_media_status.sql
-- Unifies watchlist, currently_watching, user_tv_list, and watched_items.is_watched
-- into a single user_media_status table with a lifecycle status column.
--
-- After migration:
--   user_media_status.status IN ('watchlist','watching','watched','on_hold','dropped')
--   favorite_items = independent like/heart (not a status)
--   user_ratings     = independent 1-10 rating
--   watched_items    = independent diary/review storage (review_text, public_review_text)

BEGIN;

-- 1. Create the unified status table
CREATE TABLE IF NOT EXISTS public.user_media_status (
  user_id   uuid    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id   text    NOT NULL,
  item_type text    NOT NULL CHECK (item_type IN ('movie', 'tv')),
  item_name text    NOT NULL DEFAULT '',
  image_url text,
  item_adult boolean NOT NULL DEFAULT FALSE,
  genres    text[],
  status    text    NOT NULL CHECK (status IN ('watchlist','watching','watched','on_hold','dropped')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS user_media_status_user_id_idx ON public.user_media_status (user_id);
CREATE INDEX IF NOT EXISTS user_media_status_user_status_idx ON public.user_media_status (user_id, status);

-- 2. Migrate data from user_watchlist
INSERT INTO public.user_media_status (user_id, item_id, item_type, item_name, image_url, item_adult, genres, status, updated_at)
SELECT user_id, item_id, item_type, item_name, image_url, item_adult, genres, 'watchlist', created_at
FROM public.user_watchlist
ON CONFLICT (user_id, item_id) DO NOTHING;

-- 3. Migrate data from currently_watching (movies only)
INSERT INTO public.user_media_status (user_id, item_id, item_type, item_name, image_url, item_adult, genres, status, updated_at)
SELECT user_id, item_id, item_type, item_name, image_url, item_adult, genres, 'watching', started_at
FROM public.currently_watching
ON CONFLICT (user_id, item_id) DO UPDATE SET status = 'watching', updated_at = EXCLUDED.updated_at;

-- 4. Migrate data from user_tv_list (TV shows with watching/completed/on_hold/dropped/plan_to_watch)
-- map 'plan_to_watch' -> 'watchlist', 'completed' -> 'watched'
INSERT INTO public.user_media_status (user_id, item_id, item_type, item_name, image_url, item_adult, genres, status, updated_at)
SELECT
  utl.user_id,
  utl.show_id AS item_id,
  'tv'       AS item_type,
  COALESCE(wi.item_name, utl.show_id) AS item_name,
  wi.image_url,
  COALESCE(wi.item_adult, FALSE),
  wi.genres,
  CASE utl.status
    WHEN 'plan_to_watch' THEN 'watchlist'
    WHEN 'completed'     THEN 'watched'
    WHEN 'rewatching'    THEN 'watching'
    ELSE utl.status
  END,
  utl.updated_at
FROM public.user_tv_list utl
LEFT JOIN public.watched_items wi
  ON wi.user_id = utl.user_id AND wi.item_id = utl.show_id AND wi.item_type = 'tv'
ON CONFLICT (user_id, item_id) DO UPDATE
  SET status = CASE
    WHEN user_media_status.status = 'watched' THEN user_media_status.status
    ELSE EXCLUDED.status
  END,
  updated_at = EXCLUDED.updated_at;

-- 5. Migrate watched movies/shows from watched_items where is_watched = true
--    Only insert if no status already exists (watchlist/tv_list takes priority)
INSERT INTO public.user_media_status (user_id, item_id, item_type, item_name, image_url, item_adult, genres, status, updated_at)
SELECT user_id, item_id, item_type, item_name, image_url, item_adult, genres, 'watched', watched_at
FROM public.watched_items
WHERE is_watched = TRUE
ON CONFLICT (user_id, item_id) DO NOTHING;

-- 6. RLS policies
ALTER TABLE public.user_media_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_media_status_self"
  ON public.user_media_status
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_media_status_select_profile_visible"
  ON public.user_media_status
  FOR SELECT
  USING (public.profile_visible_to_viewer(user_id));

-- 7. Update user_cout_stats to use a function based on user_media_status
--    (We keep the existing RPC functions but they now query the new table)
CREATE OR REPLACE FUNCTION public.recount_user_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  w_count  integer;
  fav_count integer;
  wl_count integer;
BEGIN
  SELECT COUNT(*) INTO w_count
  FROM public.user_media_status
  WHERE user_id = p_user_id AND status = 'watched';

  SELECT COUNT(*) INTO wl_count
  FROM public.user_media_status
  WHERE user_id = p_user_id AND status = 'watchlist';

  SELECT COUNT(*) INTO fav_count
  FROM public.favorite_items
  WHERE user_id = p_user_id;

  INSERT INTO public.user_cout_stats (user_id, watched_count, favorites_count, watchlist_count, watching_count)
  VALUES (p_user_id, w_count, fav_count, wl_count, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET watched_count = w_count,
        favorites_count = fav_count,
        watchlist_count = wl_count,
        updated_at = now();
END;
$$;

-- Recalculate all stats from the new table
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.users LOOP
    PERFORM public.recount_user_stats(r.id);
  END LOOP;
END;
$$;

COMMIT;
