-- Allow visitors to SELECT profile content (watched, favorites, watchlist, ratings, recommendations)
-- when the profile owner's visibility permits: public = anyone; followers = only if viewer follows.
-- Safe to run even if base tables do not exist yet (no-op until public.users exists).
--
-- IMPORTANT: Run this migration AFTER your schema has public.users (and watched_items, etc.).
-- If you ran it earlier and it no-opped, run it again. To verify: in SQL editor run
--   select proname from pg_proc where proname = 'profile_visible_to_viewer';
-- (should return one row) and
--   select polname from pg_policies where tablename = 'watched_items' and polname like '%profile_visible%';
-- (should return watched_items_select_profile_visible).

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    return;
  end if;

  -- Helper: true when the profile owner (user_id) allows the current viewer to see their content
  create or replace function public.profile_visible_to_viewer(owner_user_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $inner$
    select exists (
      select 1 from public.users u
      where u.id = owner_user_id
      and (
        u.visibility = 'public'
        or (
          auth.uid() is not null
          and u.visibility = 'followers'
          and exists (
            select 1 from public.user_connections c
            where c.followed_id = u.id and c.follower_id = auth.uid()
          )
        )
      )
    );
  $inner$;

  comment on function public.profile_visible_to_viewer(uuid) is
    'True when the profile owner allows the current viewer to see their content (public or followers and viewer follows).';

  -- Required: anon and authenticated must be able to execute the function when RLS policies run
  grant execute on function public.profile_visible_to_viewer(uuid) to anon;
  grant execute on function public.profile_visible_to_viewer(uuid) to authenticated;

  -- watched_items
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'watched_items') then
    drop policy if exists "watched_items_select_profile_visible" on public.watched_items;
    create policy "watched_items_select_profile_visible" on public.watched_items
      for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
  end if;

  -- favorite_items
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'favorite_items') then
    drop policy if exists "favorite_items_select_profile_visible" on public.favorite_items;
    create policy "favorite_items_select_profile_visible" on public.favorite_items
      for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
  end if;

  -- user_watchlist
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_watchlist') then
    drop policy if exists "user_watchlist_select_profile_visible" on public.user_watchlist;
    create policy "user_watchlist_select_profile_visible" on public.user_watchlist
      for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
  end if;

  -- user_ratings
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_ratings') then
    drop policy if exists "user_ratings_select_profile_visible" on public.user_ratings;
    create policy "user_ratings_select_profile_visible" on public.user_ratings
      for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
  end if;

  -- recommendation
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'recommendation') then
    drop policy if exists "recommendation_select_profile_visible" on public.recommendation;
    create policy "recommendation_select_profile_visible" on public.recommendation
      for select using (auth.uid() = user_id or public.profile_visible_to_viewer(user_id));
  end if;
end $$;
