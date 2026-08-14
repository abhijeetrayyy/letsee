-- 053: real runtimes, and stats read from one cached row instead of nine queries.
--
-- Two problems.
--
-- Hours were fiction. Every episode was billed at a flat 45 minutes, but Ben 10
-- runs 11 and Son Pari 21. For this account that turned ~253 hours of the six
-- largest shows into ~3,845. The episode *count* was always real — Doraemon and
-- Pokémon genuinely are thousands of episodes — but the hours derived from it
-- were not. Runtime is now stored per title and used when known.
--
-- Cost. Rendering a profile ran nine queries, including a COUNT over 7,000+
-- watched_episodes rows, on every single view — for figures that only change
-- when the user marks something. They are now maintained on write in
-- user_cout_stats (recount_user_stats is already called by every write path)
-- and read back in one round trip.

alter table public.user_media_status
  add column if not exists runtime_minutes integer;

comment on column public.user_media_status.runtime_minutes is
  'Movie: total runtime. TV: average episode runtime. Null until backfilled.';

alter table public.user_cout_stats
  add column if not exists episodes_count integer not null default 0,
  add column if not exists minutes_watched bigint not null default 0;

-- Fallbacks, used only where runtime_minutes is still null.
-- 30 rather than 45 for an episode: the flat 45 was calibrated on prestige
-- drama and is wrong for most of what people actually rack up episodes on.
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
  v_minutes   bigint;
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

  select
    -- Films: their own runtime.
    coalesce((
      select sum(coalesce(nullif(s.runtime_minutes, 0), 110))
        from public.user_media_status s
       where s.user_id = p_user_id and s.item_type = 'movie' and s.status = 'watched'
    ), 0)
    -- Series: episodes actually recorded, at that show's episode length.
    + coalesce((
      select sum(e.eps * coalesce(nullif(s.runtime_minutes, 0), 30))
        from (
          select show_id, count(*) eps
            from public.watched_episodes
           where user_id = p_user_id and season_number > 0
           group by show_id
        ) e
        left join public.user_media_status s
          on s.user_id = p_user_id and s.item_id = e.show_id
    ), 0)
    -- Series marked watched with no episodes recorded: estimate a short run
    -- rather than counting them as zero.
    + coalesce((
      select sum(8 * coalesce(nullif(s.runtime_minutes, 0), 30))
        from public.user_media_status s
       where s.user_id = p_user_id and s.item_type = 'tv' and s.status = 'watched'
         and not exists (
           select 1 from public.watched_episodes e
            where e.user_id = p_user_id and e.show_id = s.item_id
         )
    ), 0)
  into v_minutes;

  insert into public.user_cout_stats
    (user_id, watched_count, favorites_count, watchlist_count, watching_count,
     episodes_count, minutes_watched, updated_at)
  values
    (p_user_id, v_watched, v_favorites, v_watchlist, v_watching,
     v_episodes, v_minutes, now())
  on conflict (user_id) do update set
    watched_count   = excluded.watched_count,
    favorites_count = excluded.favorites_count,
    watchlist_count = excluded.watchlist_count,
    watching_count  = excluded.watching_count,
    episodes_count  = excluded.episodes_count,
    minutes_watched = excluded.minutes_watched,
    updated_at      = now();
end;
$$;

-- Everything the profile header and home sidebar need, in one round trip.
-- Counts that are cheap and must be exact (movies/TV split, this year) are
-- computed live; the expensive ones come from the cached row.
create or replace function public.get_user_stats(p_user_id uuid)
returns table (
  watched_count    int,
  movie_count      int,
  tv_count         int,
  watchlist_count  int,
  watching_count   int,
  favorite_count   int,
  episodes_count   int,
  minutes_watched  bigint,
  watched_this_year int
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select
      count(*) filter (where status = 'watched')::int                              as watched_count,
      count(*) filter (where status = 'watched' and item_type = 'movie')::int      as movie_count,
      count(*) filter (where status = 'watched' and item_type = 'tv')::int         as tv_count,
      count(*) filter (where status = 'watchlist')::int                            as watchlist_count,
      count(*) filter (where status = 'watching')::int                             as watching_count,
      count(*) filter (
        where status = 'watched'
          and updated_at >= date_trunc('year', now())
      )::int                                                                       as watched_this_year
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
    coalesce(cs.minutes_watched, 0),
    live.watched_this_year
  from live
  left join public.user_cout_stats cs on cs.user_id = p_user_id;
$$;

grant execute on function public.get_user_stats(uuid) to authenticated, anon;

-- Index for the per-show episode rollup above.
create index if not exists watched_episodes_user_show_idx
  on public.watched_episodes (user_id, show_id);
