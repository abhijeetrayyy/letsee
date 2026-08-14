-- 052: remove "watched" activity when the watched_items row is deleted.
--
-- 051 covered INSERT and UPDATE, which handles marking and un-marking. It does
-- not cover DELETE, and two paths delete outright rather than clearing
-- is_watched: quick-add's undo, and the "delete everything" branch of the
-- unwatch dialog. Both left the activity row behind, so the feed kept
-- advertising a title the user had removed.

create or replace function remove_watched_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_activity
   where user_id = old.user_id
     and item_id = old.item_id
     and activity_type in ('watched', 'reviewed');
  return old;
end;
$$;

drop trigger if exists trg_remove_watched_activity on public.watched_items;

create trigger trg_remove_watched_activity
after delete on public.watched_items
for each row execute function remove_watched_activity();

-- Clear the orphans already left behind.
delete from public.user_activity a
 where a.activity_type in ('watched', 'reviewed')
   and not exists (
     select 1 from public.watched_items w
      where w.user_id = a.user_id
        and w.item_id = a.item_id
   );
