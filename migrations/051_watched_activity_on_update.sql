-- 051: make "watched" activity reflect what actually just happened.
--
-- trg_log_watched_activity was AFTER INSERT only. Every write path upserts on
-- (user_id, item_id), so once a title has a watched_items row it is forever an
-- UPDATE — re-marking it watched produced no activity at all, and the feed kept
-- showing the original date. The trigger also fired regardless of is_watched,
-- so a row inserted unwatched logged a "watched" event, and un-watching left
-- the old row advertising a title the user had removed.
--
-- After this: an activity row exists exactly while a title is watched, and its
-- created_at is when it was marked.

create or replace function log_watched_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Becoming watched: on insert, or on the false -> true transition.
  if new.is_watched and (tg_op = 'INSERT' or not coalesce(old.is_watched, false)) then
    -- One live "watched" row per title; re-marking refreshes its timestamp
    -- rather than stacking duplicates in the feed.
    delete from public.user_activity
     where user_id = new.user_id
       and item_id = new.item_id
       and activity_type = 'watched';

    insert into public.user_activity
      (user_id, activity_type, item_id, item_type, item_name, image_url, created_at)
    values
      (new.user_id, 'watched', new.item_id, new.item_type, new.item_name,
       new.image_url, coalesce(new.watched_at, now()));

  -- No longer watched: the feed should stop advertising it.
  elsif tg_op = 'UPDATE' and coalesce(old.is_watched, false) and not new.is_watched then
    delete from public.user_activity
     where user_id = new.user_id
       and item_id = new.item_id
       and activity_type = 'watched';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_watched_activity on public.watched_items;

create trigger trg_log_watched_activity
after insert or update of is_watched, watched_at on public.watched_items
for each row execute function log_watched_activity();

-- Clear the rows left behind by the old INSERT-only behaviour: "watched"
-- activity for titles that are no longer watched, or gone entirely.
delete from public.user_activity a
 where a.activity_type = 'watched'
   and not exists (
     select 1 from public.watched_items w
      where w.user_id = a.user_id
        and w.item_id = a.item_id
        and w.is_watched
   );
