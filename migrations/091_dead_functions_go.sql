-- 091_dead_functions_go.sql
-- Fourteen functions nothing calls, and one trigger that fired twice.
--
-- ── How "dead" was decided ─────────────────────────────────────────────────
-- A function is live if ANY of these is true, and dead only if none are:
--
--   1. a trigger points at it            (pg_trigger.tgfoid)
--   2. the app invokes it                (`.rpc("name")` in src/ or tests/)
--   3. another function's body calls it  (pg_get_functiondef of all 67)
--   4. an RLS policy, CHECK constraint, column default, index or view
--      references it (pg_policies, pg_constraint, information_schema,
--      pg_indexes, pg_views)
--
-- Migrations were deliberately NOT searched: the file that creates a function
-- is not a caller of it, and counting it as one makes every function look live.
--
-- A grep for the bare name is not enough either, and this is the trap the first
-- pass fell into: `increment_favorites_count` appeared in `favoriteButton`'s
-- source and looked alive, but the only occurrence is a comment explaining that
-- it is no longer used. Test 2 is `.rpc("...")` specifically, so a name
-- discussed in prose does not resurrect a dead function.
--
-- ── The fourteen ───────────────────────────────────────────────────────────
-- Superseded by 069. Eight hand-maintained counter mutators from before the
-- statement-level triggers existed. 069's own header is the argument against
-- them: "Remembering is not a mechanism. A trigger is." `recount_user_stats`
-- writes absolute values derived from the rows; these wrote relative ones, so
-- keeping them around is keeping a loaded foot-gun in the drawer — anything
-- that called one on top of an already-correct counter would push it wrong.
--
-- Orphaned by a deleted route. `backfill_watched_episodes_for_show` was the
-- engine of `/api/backfill-watched-episodes`, which no longer exists.
--
-- Removed from the product. `award_achievement` and `check_achievements` —
-- the notification page says so in as many words ("Waves and achievements were
-- removed from the product"), `user_achievements` holds zero rows, and nothing
-- in src/ mentions either function.
--
-- Never wired. `popular_reviews` (062), `record_rewatch` (031) and
-- `is_club_member` were written, shipped and never called by anything. They are
-- not load-bearing, and a function nobody calls is not a feature — it is a
-- claim that a feature exists. Git history keeps them if any is ever wanted.
--
-- Idempotent: every DROP is IF EXISTS.

BEGIN;

-- ── Superseded by 069's triggers ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.increment_watched_count(uuid);
DROP FUNCTION IF EXISTS public.decrement_watched_count(uuid);
DROP FUNCTION IF EXISTS public.increment_watchlist_count(uuid);
DROP FUNCTION IF EXISTS public.decrement_watchlist_count(uuid);
DROP FUNCTION IF EXISTS public.increment_watching_count(uuid);
DROP FUNCTION IF EXISTS public.decrement_watching_count(uuid);
DROP FUNCTION IF EXISTS public.increment_favorites_count(uuid);
DROP FUNCTION IF EXISTS public.decrement_favorites_count(uuid);

-- ── Orphaned by a deleted route ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.backfill_watched_episodes_for_show(uuid, text, jsonb);

-- ── Removed from the product ───────────────────────────────────────────────
-- Functions only. `achievements` still holds 18 seed rows and `user_achievements`
-- is empty but real; dropping tables is a data decision, not a dead-code one,
-- and is deliberately left alone here.
DROP FUNCTION IF EXISTS public.award_achievement(uuid, text);
DROP FUNCTION IF EXISTS public.check_achievements(uuid, text);

-- ── Written, never called ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.popular_reviews(integer, integer);
DROP FUNCTION IF EXISTS public.record_rewatch(uuid, text, text);
DROP FUNCTION IF EXISTS public.is_club_member(bigint, uuid);

-- ───────────────────────────────────────────────────────────────────────────
-- The `reactions` table had two AFTER INSERT triggers, and both wrote a
-- notification.
--
-- 062 added `notify_reaction` under the heading "reviews get an audience —
-- liking notified nobody". It was right that liking notified nobody for
-- `watched` targets, and wrong that nothing existed: `notify_like` (027) was
-- already on the table. So from 062 onwards, one like on a **review** or a
-- **list** inserted *two* notification rows, and the owner saw the same like
-- twice. `reactions` holds one row on this database, which is why nobody has
-- reported it.
--
-- `notify_reaction` is the one to keep — it covers `watched`, it carries
-- richer metadata, and it checks `is_blocked`, which `notify_like` never did
-- (so a blocked person's like notified you anyway, straight past 081).
--
-- But `notify_like` covered one thing `notify_reaction` does not: a like on a
-- **rating**. Dropping it plainly would trade a double notification for a
-- missing one, so that branch moves across first.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  elsif new.target_type = 'rating' then
    -- Inherited from notify_like. user_ratings carries no title, so the name
    -- is looked up beside it; a missing name is fine (the metadata is a
    -- convenience for rendering, not the notification's identity).
    select r.user_id, r.item_id, r.item_type
      into target_owner, item_id_val, item_type_val
      from public.user_ratings r where r.id = new.target_id;

    if target_owner is not null then
      select s.item_name into item_name_val
        from public.user_media_status s
       where s.user_id = target_owner
         and s.item_id = item_id_val
         and s.item_type = item_type_val;
    end if;

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

  -- Blocked either way means no notification.
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

DROP TRIGGER IF EXISTS trg_notify_like ON public.reactions;
DROP FUNCTION IF EXISTS public.notify_like();

-- Prove the outcome in the same transaction that produced it.
DO $$
DECLARE
  v_dead int;
  v_react int;
BEGIN
  SELECT count(*) INTO v_dead
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN (
    'increment_watched_count','decrement_watched_count','increment_watchlist_count',
    'decrement_watchlist_count','increment_watching_count','decrement_watching_count',
    'increment_favorites_count','decrement_favorites_count',
    'backfill_watched_episodes_for_show','award_achievement','check_achievements',
    'popular_reviews','record_rewatch','is_club_member','notify_like');

  IF v_dead <> 0 THEN
    RAISE EXCEPTION '% dead function(s) survived the drop', v_dead;
  END IF;

  SELECT count(*) INTO v_react
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'reactions' AND NOT t.tgisinternal;

  IF v_react <> 1 THEN
    RAISE EXCEPTION 'reactions should carry exactly one trigger, found %', v_react;
  END IF;

  RAISE NOTICE 'verified: 15 functions dropped, reactions notifies once';
END $$;

COMMIT;
