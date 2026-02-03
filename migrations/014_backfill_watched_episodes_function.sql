-- Backfill watched_episodes for users who had TV shows in watched_items before episode tracking existed.
-- The app cannot call TMDB from SQL, so this function accepts an episode list (from TMDB) and inserts
-- into watched_episodes. The API /api/backfill-watched-episodes fetches TMDB and calls this.

begin;

create or replace function public.backfill_watched_episodes_for_show(
  p_user_id uuid,
  p_show_id text,
  p_episodes jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  ep jsonb;
  inserted integer := 0;
  s smallint;
  e smallint;
begin
  if p_episodes is null or jsonb_array_length(p_episodes) = 0 then
    return 0;
  end if;

  for ep in select * from jsonb_array_elements(p_episodes)
  loop
    s := (ep->>'season_number')::smallint;
    e := (ep->>'episode_number')::smallint;
    if s is not null and e is not null and s >= 0 and e >= 1 then
      insert into public.watched_episodes (user_id, show_id, season_number, episode_number)
      values (p_user_id, p_show_id, s, e)
      on conflict (user_id, show_id, season_number, episode_number) do nothing;
      inserted := inserted + 1;
    end if;
  end loop;
  return inserted;
end;
$$;

comment on function public.backfill_watched_episodes_for_show(uuid, text, jsonb) is
  'Insert episode list into watched_episodes for a user/show. Used to backfill existing Watched TV shows. p_episodes: [{"season_number":1,"episode_number":1}, ...]';

commit;
