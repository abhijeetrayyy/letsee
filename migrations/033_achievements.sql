-- 033_achievements.sql
-- Public achievements/badges system with per-achievement opt-out

BEGIN;

CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('watching', 'reviewing', 'social', 'exploration', 'milestone'))
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id TEXT REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_idx ON public.user_achievements (user_id);

-- Seed achievements
INSERT INTO public.achievements (id, name, description, icon, category) VALUES
  ('first-watch', 'First Watch', 'Mark your first title as watched', '🎬', 'watching'),
  ('ten-watches', 'Getting Started', 'Watch 10 titles', '🍿', 'milestone'),
  ('fifty-watches', 'Film Buff', 'Watch 50 titles', '🎥', 'milestone'),
  ('hundred-watches', 'Cinephile', 'Watch 100 titles', '🎬', 'milestone'),
  ('five-hundred-watches', 'Film Scholar', 'Watch 500 titles', '📚', 'milestone'),
  ('first-review', 'Critic', 'Write your first review', '✍️', 'reviewing'),
  ('ten-reviews', 'Regular Critic', 'Write 10 reviews', '📝', 'reviewing'),
  ('first-list', 'Curator', 'Create your first custom list', '📋', 'watching'),
  ('genre-explorer', 'Genre Explorer', 'Watch content from 5 different genres', '🌍', 'exploration'),
  ('binge-watcher', 'Binge Watcher', 'Watch 10 episodes in a single day', '📺', 'watching'),
  ('night-owl', 'Night Owl', 'Watch something after midnight', '🦉', 'watching'),
  ('social-butterfly', 'Social Butterfly', 'Gain 10 followers', '🦋', 'social'),
  ('completionist', 'Completionist', 'Finish an entire TV series', '✅', 'watching'),
  ('diverse-taste', 'Diverse Taste', 'Explore 15 different genres', '🎨', 'exploration'),
  ('rating-master', 'Rating Master', 'Rate 25 titles', '⭐', 'reviewing'),
  ('world-cinema', 'World Cinema', 'Watch content from 5 different countries', '🌏', 'exploration'),
  ('list-maker', 'List Maker', 'Create 5 custom lists', '📑', 'watching'),
  ('dedicated', 'Dedicated Watcher', 'Active for 100 days', '🔥', 'milestone')
ON CONFLICT (id) DO NOTHING;

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION public.check_achievements(
  p_user_id UUID,
  p_action TEXT
)
RETURNS TABLE(achievement_id TEXT, achievement_name TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  watch_count INT;
  review_count INT;
  list_count INT;
  genre_count INT;
  follower_count INT;
  rating_count INT;
  episode_day_count INT;
  active_days INT;
  show_completed INT;
  country_count INT;
BEGIN
  -- Get current counts
  SELECT COUNT(*) INTO watch_count FROM public.user_media_status WHERE user_id = p_user_id AND status = 'watched';
  SELECT COUNT(*) INTO review_count FROM public.watched_items WHERE user_id = p_user_id AND public_review_text IS NOT NULL AND public_review_text != '';
  SELECT COUNT(*) INTO list_count FROM public.user_lists WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT unnest(genres)) INTO genre_count FROM public.user_media_status WHERE user_id = p_user_id AND status = 'watched' AND genres IS NOT NULL;
  SELECT COUNT(*) INTO follower_count FROM public.user_connections WHERE followed_id = p_user_id;
  SELECT COUNT(*) INTO rating_count FROM public.user_ratings WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO show_completed FROM public.user_media_status WHERE user_id = p_user_id AND item_type = 'tv' AND status = 'watched';
  SELECT COUNT(DISTINCT date_trunc('day', watched_at)) INTO active_days FROM public.watched_items WHERE user_id = p_user_id AND is_watched = true;
  
  -- Check episodes in one day
  SELECT COALESCE(MAX(cnt), 0) INTO episode_day_count FROM (
    SELECT COUNT(*) as cnt FROM public.watched_episodes
    WHERE user_id = p_user_id
    GROUP BY date_trunc('day', watched_at)
  ) sub;

  -- Award achievements
  IF watch_count >= 1 THEN
    RETURN QUERY SELECT 'first-watch', 'First Watch' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'first-watch');
  END IF;
  IF watch_count >= 10 THEN
    RETURN QUERY SELECT 'ten-watches', 'Getting Started' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'ten-watches');
  END IF;
  IF watch_count >= 50 THEN
    RETURN QUERY SELECT 'fifty-watches', 'Film Buff' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'fifty-watches');
  END IF;
  IF watch_count >= 100 THEN
    RETURN QUERY SELECT 'hundred-watches', 'Cinephile' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'hundred-watches');
  END IF;
  IF watch_count >= 500 THEN
    RETURN QUERY SELECT 'five-hundred-watches', 'Film Scholar' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'five-hundred-watches');
  END IF;
  IF review_count >= 1 THEN
    RETURN QUERY SELECT 'first-review', 'Critic' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'first-review');
  END IF;
  IF review_count >= 10 THEN
    RETURN QUERY SELECT 'ten-reviews', 'Regular Critic' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'ten-reviews');
  END IF;
  IF list_count >= 1 THEN
    RETURN QUERY SELECT 'first-list', 'Curator' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'first-list');
  END IF;
  IF list_count >= 5 THEN
    RETURN QUERY SELECT 'list-maker', 'List Maker' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'list-maker');
  END IF;
  IF genre_count >= 5 THEN
    RETURN QUERY SELECT 'genre-explorer', 'Genre Explorer' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'genre-explorer');
  END IF;
  IF genre_count >= 15 THEN
    RETURN QUERY SELECT 'diverse-taste', 'Diverse Taste' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'diverse-taste');
  END IF;
  IF episode_day_count >= 10 THEN
    RETURN QUERY SELECT 'binge-watcher', 'Binge Watcher' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'binge-watcher');
  END IF;
  IF follower_count >= 10 THEN
    RETURN QUERY SELECT 'social-butterfly', 'Social Butterfly' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'social-butterfly');
  END IF;
  IF show_completed >= 1 THEN
    RETURN QUERY SELECT 'completionist', 'Completionist' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'completionist');
  END IF;
  IF rating_count >= 25 THEN
    RETURN QUERY SELECT 'rating-master', 'Rating Master' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'rating-master');
  END IF;
  IF active_days >= 100 THEN
    RETURN QUERY SELECT 'dedicated', 'Dedicated Watcher' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'dedicated');
  END IF;
END;
$$;

-- Insert newly earned achievements
CREATE OR REPLACE FUNCTION public.award_achievement(
  p_user_id UUID,
  p_achievement_id TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
END;
$$;

-- RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_select_all" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "user_achievements_select_public" ON public.user_achievements FOR SELECT 
  USING (public.profile_visible_to_viewer(user_id) OR auth.uid() = user_id);
CREATE POLICY "user_achievements_modify_self" ON public.user_achievements 
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
