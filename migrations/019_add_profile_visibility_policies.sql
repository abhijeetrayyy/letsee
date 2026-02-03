-- Add missing RLS policies to allow public profile access for watched/favorites/watchlist.
-- Idempotent: safe to run if policies already exist (e.g. from schema.sql or re-run).

-- watched_items
drop policy if exists "watched_items_select_profile_visible" on public.watched_items;
create policy "watched_items_select_profile_visible" on public.watched_items
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- favorite_items
drop policy if exists "favorite_items_select_profile_visible" on public.favorite_items;
create policy "favorite_items_select_profile_visible" on public.favorite_items
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- user_watchlist
drop policy if exists "user_watchlist_select_profile_visible" on public.user_watchlist;
create policy "user_watchlist_select_profile_visible" on public.user_watchlist
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- user_ratings
drop policy if exists "user_ratings_select_profile_visible" on public.user_ratings;
create policy "user_ratings_select_profile_visible" on public.user_ratings
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));

-- recommendation
drop policy if exists "recommendation_select_profile_visible" on public.recommendation;
create policy "recommendation_select_profile_visible" on public.recommendation
  for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
