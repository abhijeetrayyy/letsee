-- 062_reviews_get_an_audience.sql
--
-- The gap this closes is the first one in SURPASSING_LETTERBOXD.md §1: on
-- Letterboxd a review is a *publication* — it gets likes, it surfaces on the
-- film page, people gain followers by writing. Here it has been a text column
-- nobody will ever read, so nobody writes one. That isn't a missing feature,
-- it's a missing loop.
--
-- Three parts, all small, because the pieces already existed and were simply
-- never connected:
--
--   1. Liking a review notified nobody. `reactions` (026) has no trigger and
--      the toggle route sends nothing — so the 'like' notification type has
--      been in the enum since 027 with nothing on earth creating it. Writing
--      into a void is the whole problem; this is the cheapest possible fix.
--
--   2. `/api/reviews` sorted by recency, which ranks the newest review above
--      the best one and guarantees that good writing sinks. Popularity needs
--      an aggregate over `reactions`, which PostgREST can't order by — hence
--      an RPC.
--
--   3. Nothing surfaced reviews outside the title they were about, so a good
--      one could only be found by someone already on that page.

begin;

-- ── 1. Liking notifies the author ───────────────────────────────────────────
create or replace function public.notify_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_owner uuid;
  item_name_val text;
  item_id_val text;
  item_type_val text;
begin
  -- Only the target types that belong to a person who'd want to know. A
  -- reaction on a comment or an activity row is noise, not applause.
  if new.target_type in ('review', 'watched') then
    select user_id, item_name, item_id, item_type
      into target_owner, item_name_val, item_id_val, item_type_val
      from public.watched_items where id = new.target_id;
  elsif new.target_type = 'list' then
    select user_id, name, null, 'list'
      into target_owner, item_name_val, item_id_val, item_type_val
      from public.user_lists where id = new.target_id;
  else
    return new;
  end if;

  -- Liking your own thing is not news.
  if target_owner is null or target_owner = new.user_id then
    return new;
  end if;

  -- Blocked either way means no notification. is_blocked already exists for
  -- exactly this and is used by the other notify_* triggers.
  if public.is_blocked(target_owner, new.user_id) then
    return new;
  end if;

  insert into public.notifications
    (user_id, actor_id, notification_type, target_type, target_id, metadata)
  values (
    target_owner, new.user_id, 'like', new.target_type, new.target_id,
    jsonb_build_object(
      'target_type', new.target_type,
      'item_name', item_name_val,
      'item_id', item_id_val,
      'item_type', item_type_val
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_reaction_trigger on public.reactions;
create trigger notify_reaction_trigger
after insert on public.reactions
for each row
execute function public.notify_reaction();

-- ── 2. Reviews for a title, ranked by reactions ─────────────────────────────
-- SECURITY DEFINER so the reaction counts can be aggregated across users;
-- visibility is therefore enforced explicitly below rather than by RLS.
create or replace function public.reviews_for_title(
  p_item_id   text,
  p_item_type text,
  p_viewer    uuid,
  p_limit     int default 10,
  p_offset    int default 0
)
returns table (
  id             bigint,
  user_id        uuid,
  username       text,
  avatar_url     text,
  review_text    text,
  watched_at     timestamptz,
  score          smallint,
  reaction_count bigint,
  viewer_reacted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id,
    w.user_id,
    u.username,
    u.avatar_url,
    w.public_review_text,
    w.watched_at,
    r.score,
    coalesce(rx.count, 0) as reaction_count,
    p_viewer is not null and exists (
      select 1 from public.reactions
       where target_type = 'review' and target_id = w.id and user_id = p_viewer
    ) as viewer_reacted
  from public.watched_items w
  join public.users u on u.id = w.user_id
  left join public.user_ratings r
    on r.user_id = w.user_id and r.item_id = w.item_id
  left join lateral (
    select count(*) as count
      from public.reactions
     where target_type = 'review' and target_id = w.id
  ) rx on true
  where w.item_id = p_item_id
    and w.item_type = p_item_type
    and w.public_review_text is not null
    and coalesce(u.profile_show_public_reviews, true)
    and public.profile_visible_to_viewer(w.user_id)
    and not public.is_blocked(coalesce(p_viewer, w.user_id), w.user_id)
  -- Reactions first, recency only to break ties. A unique id last so the sort
  -- is total and pages can't reshuffle — the same reason /api/reviews already
  -- tiebreaks on id.
  order by coalesce(rx.count, 0) desc, w.watched_at desc, w.id desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

grant execute on function public.reviews_for_title(text, text, uuid, int, int)
  to authenticated, anon;

-- ── 3. Popular reviews, across everything ───────────────────────────────────
-- Deliberately public-profiles-only. This is a discovery surface shown to
-- strangers and signed-out visitors, so "followers-only" must not leak into it
-- — profile_visible_to_viewer would admit a followers-only profile for a
-- follower, and a row that appears for some viewers and not others is the
-- wrong shape for a shared "popular this week" list.
create or replace function public.popular_reviews(
  p_days  int default 7,
  p_limit int default 6
)
returns table (
  id             bigint,
  username       text,
  avatar_url     text,
  review_text    text,
  item_id        text,
  item_type      text,
  item_name      text,
  image_url      text,
  reaction_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id, u.username, u.avatar_url, w.public_review_text,
    w.item_id, w.item_type, w.item_name, w.image_url,
    count(rx.id) as reaction_count
  from public.watched_items w
  join public.users u on u.id = w.user_id
  join public.reactions rx
    on rx.target_type = 'review' and rx.target_id = w.id
  where w.public_review_text is not null
    and coalesce(u.profile_show_public_reviews, true)
    and lower(trim(coalesce(u.visibility::text, 'public'))) = 'public'
    and rx.created_at >= now() - make_interval(days => greatest(p_days, 1))
  group by w.id, u.username, u.avatar_url, w.public_review_text,
           w.item_id, w.item_type, w.item_name, w.image_url
  order by count(rx.id) desc, w.watched_at desc, w.id desc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.popular_reviews(int, int) to authenticated, anon;

-- The aggregate above scans reactions by recency within a target type.
create index if not exists reactions_review_recent_idx
  on public.reactions (target_type, created_at desc)
  where target_type = 'review';

commit;
