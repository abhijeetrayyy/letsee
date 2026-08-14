-- 054: remove the "hours watched" stat entirely.
--
-- The figure was never trustworthy. It began as a flat 2h per film and 45min
-- per episode, which 053 tried to rescue by storing real runtimes — but even
-- then it rests on assumptions (episodes you marked without watching every
-- minute, shows TMDB has no runtime for, a series marked watched with no
-- episodes recorded) and it dwarfed every honest number next to it. A total
-- nobody can verify is worse than no total.
--
-- Episodes replaces it on the profile and home: an exact count of rows the
-- user actually created.
--
-- This drops runtime_minutes, discarding the TMDB backfill 053 collected. It
-- can be re-gathered if a real use for runtime appears (a "2h 15m" label on a
-- title page would be a fair one) — but keeping an unused column populated by
-- a route nothing calls is the orphan pattern this codebase already has too
-- much of.

alter table public.user_cout_stats  drop column if exists minutes_watched;
alter table public.user_media_status drop column if exists runtime_minutes;

-- 017 added these for the same stat and nothing ever read them.
alter table public.watched_items    drop column if exists runtime_minutes;
alter table public.watched_episodes drop column if exists runtime_minutes;

create or replace function public.recount_user_stats(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_watched   int;
  v_favorites int;
  v_watchlist int;
  v_watching  int;
  v_episodes  int;
begin
  select
    count(*) filter (where status = 'watched'),
    count(*) filter (where status = 'watchlist'),
    count(*) filter (where status = 'watching')
  into v_watched, v_watchlist, v_watching
  from public.user_media_status
  where user_id = p_user_id;

  select count(*) into v_favorites
  from public.favorite_items where user_id = p_user_id;

  select count(*) into v_episodes
  from public.watched_episodes
  where user_id = p_user_id and season_number > 0;

  insert into public.user_cout_stats
    (user_id, watched_count, favorites_count, watchlist_count, watching_count,
     episodes_count, updated_at)
  values
    (p_user_id, v_watched, v_favorites, v_watchlist, v_watching, v_episodes, now())
  on conflict (user_id) do update set
    watched_count   = excluded.watched_count,
    favorites_count = excluded.favorites_count,
    watchlist_count = excluded.watchlist_count,
    watching_count  = excluded.watching_count,
    episodes_count  = excluded.episodes_count,
    updated_at      = now();
end;
$$;

drop function if exists public.get_user_stats(uuid);

create function public.get_user_stats(p_user_id uuid)
returns table (
  watched_count     int,
  movie_count       int,
  tv_count          int,
  watchlist_count   int,
  watching_count    int,
  favorite_count    int,
  episodes_count    int,
  watched_this_year int
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select
      count(*) filter (where status = 'watched')::int                          as watched_count,
      count(*) filter (where status = 'watched' and item_type = 'movie')::int  as movie_count,
      count(*) filter (where status = 'watched' and item_type = 'tv')::int     as tv_count,
      count(*) filter (where status = 'watchlist')::int                        as watchlist_count,
      count(*) filter (where status = 'watching')::int                         as watching_count,
      count(*) filter (
        where status = 'watched' and updated_at >= date_trunc('year', now())
      )::int                                                                   as watched_this_year
    from public.user_media_status
    where user_id = p_user_id
  )
  select
    live.watched_count,
    live.movie_count,
    live.tv_count,
    live.watchlist_count,
    live.watching_count,
    coalesce((select count(*)::int from public.favorite_items where user_id = p_user_id), 0),
    coalesce(cs.episodes_count, 0),
    live.watched_this_year
  from live
  left join public.user_cout_stats cs on cs.user_id = p_user_id;
$$;

grant execute on function public.get_user_stats(uuid) to authenticated, anon;
