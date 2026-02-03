-- Remove runtime_minutes from watched_items and watched_episodes.
-- Profile stats no longer show "Hours"; they show Movies, TV shows, and Episodes (count on fetch).
-- No triggers or functions reference these columns; safe to drop.

-- watched_items: movie runtime was stored here (TV used episode runtimes)
alter table public.watched_items drop column if exists runtime_minutes;

-- watched_episodes: per-episode runtime was stored here
alter table public.watched_episodes drop column if exists runtime_minutes;
