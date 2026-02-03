-- Make profile_visible_to_viewer robust: treat null visibility as public, compare visibility case-insensitively.
-- Run in Supabase SQL editor so friends' public profiles show watched/favorites/watchlist.

create or replace function public.profile_visible_to_viewer(owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = owner_user_id
    and (
      -- Public: allow if visibility is public (case-insensitive) or null
      (u.visibility is null or lower(trim(u.visibility::text)) = 'public')
      or (
        auth.uid() is not null
        and lower(trim(u.visibility::text)) = 'followers'
        and exists (
          select 1 from public.user_connections c
          where c.followed_id = u.id and c.follower_id = auth.uid()
        )
      )
    )
  );
$$;

grant execute on function public.profile_visible_to_viewer(uuid) to anon;
grant execute on function public.profile_visible_to_viewer(uuid) to authenticated;
