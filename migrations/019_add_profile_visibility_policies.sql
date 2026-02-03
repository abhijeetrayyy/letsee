-- Add missing RLS policies to allow public profile access for watched/favorites/watchlist
-- These were present in schema.sql but missing from previous migrations.

-- watched_items
create policy "watched_items_select_profile_visible" on public.watched_items
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- favorite_items
create policy "favorite_items_select_profile_visible" on public.favorite_items
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- user_watchlist
create policy "user_watchlist_select_profile_visible" on public.user_watchlist
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- user_ratings
create policy "user_ratings_select_profile_visible" on public.user_ratings
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- recommendation
create policy "recommendation_select_profile_visible" on public.recommendation
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
