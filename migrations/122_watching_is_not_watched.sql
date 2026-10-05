-- 122_watching_is_not_watched.sql
--
-- The feed (user_activity — People → Activity) said "watched" for titles
-- people had only started. Marking a film or a series Watching mirrors it to
-- watched_items as seen (utils/mediaStatus: every status but watch later is
-- "seen"), and log_watched_activity announces every newly-seen title as
-- "watched". "Started watching" used to come from 040's trigger on
-- user_media_status, which 092 dropped for its notifications — and the feed
-- row went with it.
--
-- Now, one live feed row per title, saying where it stands:
--
-- 1. user_media_status, on a status change (trg_status_activity):
--    - into watching from nothing or watch later: "started watching", now.
--    - into watching, on hold or dropped from anything else: a "watched" row
--      for it becomes "started watching", keeping its time (not news again).
--    - into watched from watching, on hold or dropped: finished — the
--      "started watching" row goes and "watched" is written, now.
--    - into watch later: "started watching" goes (they've said they're not).
--    No notifications: 092's rule stands; this writes the feed only.
--
-- 2. log_watched_activity (watched_items becoming seen): if the title's
--    status is watching, on hold or dropped, it makes sure "started watching"
--    is there instead of writing "watched". Writers save the status first
--    (writeStatus), but either order ends right: (1) relabels a "watched" row
--    written before the status.
--
-- 3. Every delete now matches item_type too: a film and a series can share a
--    TMDB id, and removing one used to take the other's feed rows with it.
--
-- 4. Backfill: "watched" rows for titles now watching / on hold / dropped
--    become "started watching" (or go, where one already exists); a "started
--    watching" row for a title no longer in that person's library goes.
--
-- user_activity has no triggers of its own and no updated_at. Idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION public.log_watched_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s text;
begin
  -- Becoming seen: on insert, or on the false -> true transition.
  if new.is_watched and (tg_op = 'INSERT' or not coalesce(old.is_watched, false)) then
    select status into s from public.user_media_status
     where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type;

    if s in ('watching', 'on_hold', 'dropped') then
      -- Started, not finished.
      delete from public.user_activity
       where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
         and activity_type = 'watched';
      if not exists (
        select 1 from public.user_activity
         where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
           and activity_type = 'started_watching'
      ) then
        insert into public.user_activity
          (user_id, activity_type, item_id, item_type, item_name, image_url, created_at)
        values
          (new.user_id, 'started_watching', new.item_id, new.item_type, new.item_name, new.image_url, now());
      end if;
    else
      -- One live row per title; re-marking refreshes its time rather than
      -- stacking duplicates in the feed.
      delete from public.user_activity
       where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
         and activity_type in ('watched', 'started_watching');
      insert into public.user_activity
        (user_id, activity_type, item_id, item_type, item_name, image_url, created_at)
      values
        (new.user_id, 'watched', new.item_id, new.item_type, new.item_name,
         new.image_url, coalesce(new.watched_at, now()));
    end if;

  -- No longer seen: the feed should stop advertising it as watched.
  elsif tg_op = 'UPDATE' and coalesce(old.is_watched, false) and not new.is_watched then
    delete from public.user_activity
     where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
       and activity_type = 'watched';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.remove_watched_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.user_activity
   where user_id = old.user_id
     and item_id = old.item_id
     and item_type = old.item_type
     and activity_type in ('watched', 'started_watching', 'reviewed');
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_status_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  was text := case when tg_op = 'UPDATE' then old.status else null end;
begin
  if new.status is not distinct from was then
    return new;
  end if;

  if new.status in ('watching', 'on_hold', 'dropped') then
    -- Whatever said "watched" for it now says "started watching", at its time.
    if exists (
      select 1 from public.user_activity
       where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
         and activity_type = 'started_watching'
    ) then
      delete from public.user_activity
       where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
         and activity_type = 'watched';
    else
      update public.user_activity set activity_type = 'started_watching'
       where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
         and activity_type = 'watched';
    end if;

    -- Starting something new is news.
    if new.status = 'watching' and coalesce(was, 'watchlist') = 'watchlist' and not exists (
      select 1 from public.user_activity
       where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
         and activity_type = 'started_watching'
    ) then
      insert into public.user_activity
        (user_id, activity_type, item_id, item_type, item_name, image_url, created_at)
      values
        (new.user_id, 'started_watching', new.item_id, new.item_type, new.item_name, new.image_url, now());
    end if;

  elsif new.status = 'watched' and was in ('watching', 'on_hold', 'dropped') then
    -- Finished.
    delete from public.user_activity
     where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
       and activity_type in ('watched', 'started_watching');
    insert into public.user_activity
      (user_id, activity_type, item_id, item_type, item_name, image_url, created_at)
    values
      (new.user_id, 'watched', new.item_id, new.item_type, new.item_name, new.image_url, now());

  elsif new.status = 'watchlist' then
    delete from public.user_activity
     where user_id = new.user_id and item_id = new.item_id and item_type = new.item_type
       and activity_type = 'started_watching';
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_status_activity ON public.user_media_status;
CREATE TRIGGER trg_status_activity
AFTER INSERT OR UPDATE OF status ON public.user_media_status
FOR EACH ROW EXECUTE FUNCTION public.log_status_activity();

-- Backfill.
DELETE FROM public.user_activity a
 USING public.user_media_status s
 WHERE a.activity_type = 'watched'
   AND s.user_id = a.user_id AND s.item_id = a.item_id AND s.item_type = a.item_type
   AND s.status IN ('watching', 'on_hold', 'dropped')
   AND EXISTS (
     SELECT 1 FROM public.user_activity b
      WHERE b.user_id = a.user_id AND b.item_id = a.item_id AND b.item_type = a.item_type
        AND b.activity_type = 'started_watching'
   );

UPDATE public.user_activity a
   SET activity_type = 'started_watching'
  FROM public.user_media_status s
 WHERE a.activity_type = 'watched'
   AND s.user_id = a.user_id AND s.item_id = a.item_id AND s.item_type = a.item_type
   AND s.status IN ('watching', 'on_hold', 'dropped');

DELETE FROM public.user_activity a
 WHERE a.activity_type = 'started_watching'
   AND NOT EXISTS (
     SELECT 1 FROM public.user_media_status s
      WHERE s.user_id = a.user_id AND s.item_id = a.item_id AND s.item_type = a.item_type
        AND s.status IN ('watching', 'on_hold', 'dropped', 'watched')
   );

COMMIT;
