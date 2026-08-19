--
-- 000_baseline.sql — the schema this database actually has.
--
-- Generated with pg_dump against production on 2026-08-19, after migrations
-- 007–083 were applied and verified.
--
-- ── What this replaces ─────────────────────────────────────────────────────
--
-- Two files, both deleted, both of which lied in different directions:
--
--   schema.sql               15 tables. Predated migration 024 and was the ONLY
--                            definition of the core tables, so it could not be
--                            deleted and could not be trusted. Its own entry in
--                            docs/AGENT_DB_AND_MIGRATIONS.md read "Badly stale
--                            — do not trust it."
--   schema_from_supabase.sql 14 tables. A dump so old it predated a third of
--                            the schema.
--
-- Neither could rebuild the database, and neither could migrations/ alone —
-- 007–028 assume state schema.sql half-provided and half-contradicted, and
-- set_updated_at() existed only in schema.sql. There was no artefact in this
-- repository from which a working database could be created. This is that
-- artefact.
--
-- ── How to use it ──────────────────────────────────────────────────────────
--
-- Fresh database:     run this file, and nothing else. It is the whole schema.
-- Existing database:  do NOT run it. Run the numbered migrations you are
--                     missing. This file is the reference for what you should
--                     end up with.
--
-- ── Keeping it true ────────────────────────────────────────────────────────
--
-- Re-generate after applying any migration: `npm run db:dump`. A baseline that
-- drifts is worse than no baseline, because it invites the trust the two files
-- above spent a year not deserving.
--
-- ── Contents, as generated ─────────────────────────────────────────────────
--
--   43 tables · 55 functions · 107 RLS policies · 38 triggers · 62 indexes
--
-- Verified at generation time against the running application:
--   * every one of the 37 tables the code queries is present
--   * every one of the 13 RPCs the code calls is present
--   * the tables dropped by 010 and 030 (activity, currently_watching,
--     user_tv_list, user_watchlist) are absent
--   * 072's and 076's column-level grants are intact — `email` is not granted
--     on public.users, and `review_text` is not granted on public.watched_items
--
-- One known disagreement, and it is the code that is wrong: /app/genre-start
-- queries `user_watchlist`, which 030 dropped. That page is an unlinked
-- maintenance script; the table is correctly absent here.
--
-- Dumped by pg_dump 18.4 from PostgreSQL 17.6. The psql meta-commands pg_dump
-- 18 emits (\restrict / \unrestrict) are stripped, because they are not SQL
-- and the Supabase SQL editor rejects them.
--

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: follow_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.follow_request_status AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


--
-- Name: job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed'
);


--
-- Name: message_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_type AS ENUM (
    'text',
    'cardmix'
);


--
-- Name: visibility_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visibility_level AS ENUM (
    'public',
    'followers',
    'private'
);


--
-- Name: accept_follow_request(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_follow_request(p_request_id bigint) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sender   uuid;
  v_receiver uuid;
BEGIN
  SELECT sender_id, receiver_id
    INTO v_sender, v_receiver
    FROM public.user_follow_requests
   WHERE id = p_request_id;

  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'That follow request no longer exists.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- The whole reason this function exists: prove the caller is the recipient
  -- before writing a connection they are not otherwise allowed to write.
  IF auth.uid() IS NULL OR v_receiver IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the person who received a request can accept it.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 042 put this check in the insert policy; the policy is being bypassed, so
  -- the check has to be carried here rather than lost with it.
  IF public.is_blocked(v_sender, v_receiver) THEN
    RAISE EXCEPTION 'That account is blocked.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.user_connections (follower_id, followed_id)
  VALUES (v_sender, v_receiver)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (user_id, actor_id, notification_type, created_at)
  VALUES (v_sender, v_receiver, 'follow_accepted', now());

  DELETE FROM public.user_follow_requests WHERE id = p_request_id;

  RETURN true;
END;
$$;


--
-- Name: award_achievement(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_achievement(p_user_id uuid, p_achievement_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_name TEXT;
  v_icon TEXT;
BEGIN
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  IF FOUND THEN
    SELECT name, icon INTO v_name, v_icon FROM public.achievements WHERE id = p_achievement_id;

    INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, metadata)
    VALUES (
      p_user_id, p_user_id, 'achievement_unlocked', 'achievement',
      jsonb_build_object('achievement_id', p_achievement_id, 'name', v_name, 'icon', v_icon)
    );
  END IF;
END;
$$;


--
-- Name: backfill_watched_episodes_for_show(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backfill_watched_episodes_for_show(p_user_id uuid, p_show_id text, p_episodes jsonb) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: FUNCTION backfill_watched_episodes_for_show(p_user_id uuid, p_show_id text, p_episodes jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.backfill_watched_episodes_for_show(p_user_id uuid, p_show_id text, p_episodes jsonb) IS 'Insert episode list into watched_episodes for a user/show. Used to backfill existing Watched TV shows. p_episodes: [{"season_number":1,"episode_number":1}, ...]';


--
-- Name: block_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_user(p_blocked uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'You have to be signed in to block someone.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_blocked IS NULL OR p_blocked = v_me THEN
    RAISE EXCEPTION 'You cannot block yourself.' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_blocked) THEN
    RAISE EXCEPTION 'No such account.' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (v_me, p_blocked)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Both directions, which is what the route could not do.
  DELETE FROM public.user_connections
   WHERE (follower_id = v_me       AND followed_id = p_blocked)
      OR (follower_id = p_blocked  AND followed_id = v_me);

  DELETE FROM public.user_follow_requests
   WHERE (sender_id = v_me      AND receiver_id = p_blocked)
      OR (sender_id = p_blocked AND receiver_id = v_me);
END;
$$;


--
-- Name: check_achievements(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_achievements(p_user_id uuid, p_action text) RETURNS TABLE(achievement_id text, achievement_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  watch_count INT;
  review_count INT;
  list_count INT;
  genre_count INT;
  follower_count INT;
  rating_count INT;
  episode_day_count INT;
  active_days INT;
  show_completed INT;
  country_count INT;
BEGIN
  -- Get current counts
  SELECT COUNT(*) INTO watch_count FROM public.user_media_status WHERE user_id = p_user_id AND status = 'watched';
  SELECT COUNT(*) INTO review_count FROM public.watched_items WHERE user_id = p_user_id AND public_review_text IS NOT NULL AND public_review_text != '';
  SELECT COUNT(*) INTO list_count FROM public.user_lists WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT unnest(genres)) INTO genre_count FROM public.user_media_status WHERE user_id = p_user_id AND status = 'watched' AND genres IS NOT NULL;
  SELECT COUNT(*) INTO follower_count FROM public.user_connections WHERE followed_id = p_user_id;
  SELECT COUNT(*) INTO rating_count FROM public.user_ratings WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO show_completed FROM public.user_media_status WHERE user_id = p_user_id AND item_type = 'tv' AND status = 'watched';
  SELECT COUNT(DISTINCT date_trunc('day', watched_at)) INTO active_days FROM public.watched_items WHERE user_id = p_user_id AND is_watched = true;
  
  -- Check episodes in one day
  SELECT COALESCE(MAX(cnt), 0) INTO episode_day_count FROM (
    SELECT COUNT(*) as cnt FROM public.watched_episodes
    WHERE user_id = p_user_id
    GROUP BY date_trunc('day', watched_at)
  ) sub;

  -- Award achievements
  IF watch_count >= 1 THEN
    RETURN QUERY SELECT 'first-watch', 'First Watch' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'first-watch');
  END IF;
  IF watch_count >= 10 THEN
    RETURN QUERY SELECT 'ten-watches', 'Getting Started' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'ten-watches');
  END IF;
  IF watch_count >= 50 THEN
    RETURN QUERY SELECT 'fifty-watches', 'Film Buff' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'fifty-watches');
  END IF;
  IF watch_count >= 100 THEN
    RETURN QUERY SELECT 'hundred-watches', 'Cinephile' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'hundred-watches');
  END IF;
  IF watch_count >= 500 THEN
    RETURN QUERY SELECT 'five-hundred-watches', 'Film Scholar' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'five-hundred-watches');
  END IF;
  IF review_count >= 1 THEN
    RETURN QUERY SELECT 'first-review', 'Critic' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'first-review');
  END IF;
  IF review_count >= 10 THEN
    RETURN QUERY SELECT 'ten-reviews', 'Regular Critic' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'ten-reviews');
  END IF;
  IF list_count >= 1 THEN
    RETURN QUERY SELECT 'first-list', 'Curator' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'first-list');
  END IF;
  IF list_count >= 5 THEN
    RETURN QUERY SELECT 'list-maker', 'List Maker' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'list-maker');
  END IF;
  IF genre_count >= 5 THEN
    RETURN QUERY SELECT 'genre-explorer', 'Genre Explorer' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'genre-explorer');
  END IF;
  IF genre_count >= 15 THEN
    RETURN QUERY SELECT 'diverse-taste', 'Diverse Taste' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'diverse-taste');
  END IF;
  IF episode_day_count >= 10 THEN
    RETURN QUERY SELECT 'binge-watcher', 'Binge Watcher' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'binge-watcher');
  END IF;
  IF follower_count >= 10 THEN
    RETURN QUERY SELECT 'social-butterfly', 'Social Butterfly' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'social-butterfly');
  END IF;
  IF show_completed >= 1 THEN
    RETURN QUERY SELECT 'completionist', 'Completionist' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'completionist');
  END IF;
  IF rating_count >= 25 THEN
    RETURN QUERY SELECT 'rating-master', 'Rating Master' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'rating-master');
  END IF;
  IF active_days >= 100 THEN
    RETURN QUERY SELECT 'dedicated', 'Dedicated Watcher' WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = 'dedicated');
  END IF;
END;
$$;


--
-- Name: cleanup_dm_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_dm_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.notifications n
  WHERE n.notification_type = 'dm_received'
    AND n.user_id = OLD.recipient_id
    AND n.actor_id = OLD.sender_id
    AND (
      (n.metadata ->> 'message_id') = OLD.id::text
      OR (
        n.metadata ->> 'message_id' IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.sender_id = OLD.sender_id
            AND m.recipient_id = OLD.recipient_id
            AND m.id <> OLD.id
        )
      )
    );

  RETURN OLD;
END;
$$;


--
-- Name: club_owner_on_create(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.club_owner_on_create() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.club_members (club_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'owner', 'active')
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: clubs_created_by_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clubs_created_by_immutable() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by cannot be changed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: conversation_list(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.conversation_list(p_user uuid) RETURNS TABLE(partner_id uuid, last_content text, last_message_type text, last_at timestamp with time zone, last_from_me boolean, unread integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  WITH mine AS (
    SELECT m.*,
           CASE WHEN m.sender_id = p_user THEN m.recipient_id ELSE m.sender_id END AS partner
    FROM public.messages m
    WHERE m.sender_id = p_user OR m.recipient_id = p_user
  ),
  latest AS (
    SELECT DISTINCT ON (partner) partner, content, message_type, created_at, sender_id
    FROM mine
    ORDER BY partner, created_at DESC
  ),
  counts AS (
    SELECT partner, COUNT(*)::int AS unread
    FROM mine
    WHERE recipient_id = p_user AND is_read = false
    GROUP BY partner
  )
  SELECT l.partner,
         l.content,
         l.message_type::text,
         l.created_at,
         l.sender_id = p_user,
         COALESCE(c.unread, 0)
  FROM latest l
  LEFT JOIN counts c ON c.partner = l.partner
  WHERE l.partner <> p_user
  ORDER BY l.created_at DESC;
$$;


--
-- Name: decrement_favorites_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_favorites_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set favorites_count = greatest(favorites_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: decrement_watched_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_watched_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watched_count = greatest(watched_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: decrement_watching_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_watching_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watching_count = greatest(watching_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: decrement_watchlist_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_watchlist_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watchlist_count = greatest(watchlist_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: ensure_user_cout_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_cout_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;


--
-- Name: get_user_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_stats(p_user_id uuid) RETURNS TABLE(watched_count integer, movie_count integer, tv_count integer, watchlist_count integer, watching_count integer, favorite_count integer, episodes_count integer, watched_this_year integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: increment_favorites_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_favorites_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set favorites_count = favorites_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: increment_watched_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_watched_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watched_count = watched_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: increment_watching_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_watching_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watching_count = watching_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: increment_watchlist_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_watchlist_count(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_cout_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_cout_stats
  set watchlist_count = watchlist_count + 1,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


--
-- Name: is_blocked(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_blocked(p_viewer_id uuid, p_profile_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = p_viewer_id AND blocked_id = p_profile_id)
       OR (blocker_id = p_profile_id AND blocked_id = p_viewer_id)
  );
END;
$$;


--
-- Name: is_club_admin(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_club_admin(p_club bigint, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club AND user_id = p_user
      AND status = 'active' AND role IN ('owner', 'moderator')
  );
$$;


--
-- Name: is_club_member(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_club_member(p_club bigint, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club AND user_id = p_user AND status = 'active'
  );
$$;


--
-- Name: is_club_owner(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_club_owner(p_club bigint, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club AND user_id = p_user
      AND status = 'active' AND role = 'owner'
  );
$$;


--
-- Name: is_list_editor(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_list_editor(p_list bigint, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_lists WHERE id = p_list AND user_id = p_user)
      OR EXISTS (SELECT 1 FROM public.user_list_collaborators WHERE list_id = p_list AND user_id = p_user);
$$;


--
-- Name: is_session_participant(bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_session_participant(p_session bigint, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
      from public.watch_session_participants
     where session_id = p_session
       and user_id    = p_user
  );
$$;


--
-- Name: log_list_created_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_list_created_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.user_activity (user_id, activity_type, list_name, list_id, created_at)
  values (new.user_id, 'list_created', new.name, new.id, new.created_at);
  return new;
end;
$$;


--
-- Name: log_rated_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_rated_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_name text;
  v_image text;
BEGIN
  -- Only log a genuinely new score, not every re-save of the same value.
  IF TG_OP = 'UPDATE' AND OLD.score IS NOT DISTINCT FROM NEW.score THEN
    RETURN NEW;
  END IF;

  SELECT item_name, image_url INTO v_name, v_image
  FROM public.user_media_status
  WHERE user_id = NEW.user_id AND item_id = NEW.item_id
  LIMIT 1;

  INSERT INTO public.user_activity
    (user_id, activity_type, item_id, item_type, item_name, image_url, score, created_at)
  VALUES
    (NEW.user_id, 'rated', NEW.item_id, NEW.item_type, v_name, v_image, NEW.score, now());

  RETURN NEW;
END;
$$;


--
-- Name: log_reviewed_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_reviewed_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.public_review_text is not null and new.public_review_text != coalesce(old.public_review_text, '') then
    insert into public.user_activity (user_id, activity_type, item_id, item_type, item_name, image_url, review_text, created_at)
    values (new.user_id, 'reviewed', new.item_id, new.item_type, new.item_name, new.image_url, new.public_review_text, now());
  end if;
  return new;
end;
$$;


--
-- Name: log_watched_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_watched_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: my_diary_notes(text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_diary_notes(p_item_ids text[] DEFAULT NULL::text[], p_limit integer DEFAULT NULL::integer) RETURNS TABLE(id bigint, item_id text, item_type text, item_name text, image_url text, watched_at timestamp with time zone, review_text text, public_review_text text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- Every reference is qualified: RETURNS TABLE puts these names in scope as
  -- output parameters, and a bare `item_id` would be ambiguous.
  SELECT w.id, w.item_id, w.item_type, w.item_name, w.image_url,
         w.watched_at, w.review_text, w.public_review_text
    FROM public.watched_items w
   WHERE w.user_id = auth.uid()
     AND auth.uid() IS NOT NULL
     AND w.review_text IS NOT NULL
     AND (p_item_ids IS NULL OR w.item_id = ANY (p_item_ids))
   ORDER BY w.watched_at DESC, w.id DESC
   LIMIT COALESCE(p_limit, 1000000);
$$;


--
-- Name: notify_comment_reply(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_comment_reply() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE parent_owner UUID; item_owner UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner FROM public.comments WHERE id = NEW.parent_id;
    IF parent_owner IS NOT NULL AND parent_owner != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, target_id, metadata)
      VALUES (parent_owner, NEW.user_id, 'comment_reply', 'comment', NEW.id,
              jsonb_build_object('comment_body', left(NEW.body, 100), 'item_id', NEW.item_id, 'item_type', NEW.item_type));
    END IF;
  END IF;

  IF NEW.item_type = 'review' THEN
    SELECT user_id INTO item_owner FROM public.watched_items WHERE id = NEW.item_id::bigint;
    -- IS DISTINCT FROM so a NULL parent_owner (top-level comment) still counts
    IF item_owner IS NOT NULL
       AND item_owner != NEW.user_id
       AND item_owner IS DISTINCT FROM parent_owner THEN
      INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, target_id, metadata)
      VALUES (item_owner, NEW.user_id, 'comment_reply', 'comment', NEW.id,
              jsonb_build_object('comment_body', left(NEW.body, 100), 'item_id', NEW.item_id, 'item_type', NEW.item_type));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: notify_dm_received(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_dm_received() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;
  IF public.is_blocked(NEW.sender_id, NEW.recipient_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, notification_type, metadata, created_at)
  VALUES (
    NEW.recipient_id,
    NEW.sender_id,
    'dm_received',
    jsonb_build_object('message_id', NEW.id),
    now()
  );

  RETURN NEW;
END;
$$;


--
-- Name: notify_follow_accepted(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_follow_accepted() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, notification_type, actor_id, created_at)
    values (new.sender_id, 'follow_accepted', new.receiver_id, now());
  end if;
  return new;
end;
$$;


--
-- Name: notify_follow_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_follow_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.notifications (user_id, notification_type, actor_id, metadata, created_at)
  values (new.receiver_id, 'follow_request', new.sender_id,
    jsonb_build_object('status', new.status),
    new.created_at);
  return new;
end;
$$;


--
-- Name: notify_friend_watched(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_friend_watched() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Notify all followers of the user who watched something
  insert into public.notifications (user_id, notification_type, actor_id, target_type, target_id, metadata, created_at)
  select
    c.follower_id,
    case when new.public_review_text is not null then 'friend_reviewed' else 'friend_watched' end,
    new.user_id,
    'watched',
    new.id,
    jsonb_build_object(
      'item_id', new.item_id,
      'item_type', new.item_type,
      'item_name', new.item_name,
      'image_url', new.image_url,
      'has_review', new.public_review_text is not null
    ),
    new.watched_at
  from public.user_connections c
  where c.followed_id = new.user_id;
  return new;
end;
$$;


--
-- Name: notify_like(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_like() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target_owner_id uuid;
begin
  -- Determine who owns the target content
  case new.target_type
    when 'review' then
      select user_id into target_owner_id from public.watched_items where id = new.target_id;
    when 'rating' then
      select user_id into target_owner_id from public.user_ratings where id = new.target_id;
    when 'list' then
      select user_id into target_owner_id from public.user_lists where id = new.target_id;
    else
      target_owner_id := null;
  end case;

  -- Don't notify if liking own content
  if target_owner_id is not null and target_owner_id != new.user_id then
    insert into public.notifications (user_id, notification_type, actor_id, target_type, target_id, metadata, created_at)
    values (target_owner_id, 'like', new.user_id, new.target_type, new.target_id,
      jsonb_build_object('target_type', new.target_type, 'target_id', new.target_id),
      new.created_at);
  end if;
  return new;
end;
$$;


--
-- Name: notify_new_follower(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_follower() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, notification_type, created_at)
  VALUES (NEW.followed_id, NEW.follower_id, 'new_follower', now());
  RETURN NEW;
END;
$$;


--
-- Name: notify_reaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_reaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: notify_started_watching(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_started_watching() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'watching' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'watching') THEN
    INSERT INTO public.user_activity (user_id, activity_type, item_id, item_type, item_name, image_url, created_at)
    VALUES (NEW.user_id, 'started_watching', NEW.item_id, NEW.item_type, NEW.item_name, NEW.image_url, NEW.updated_at);

    INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, target_id, metadata, created_at)
    SELECT
      c.follower_id,
      NEW.user_id,
      'friend_started_watching',
      NEW.item_type,
      NULL,
      jsonb_build_object('item_id', NEW.item_id, 'item_type', NEW.item_type, 'item_name', NEW.item_name, 'image_url', NEW.image_url),
      NEW.updated_at
    FROM public.user_connections c
    WHERE c.followed_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_wave(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_wave() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, notification_type, created_at)
  VALUES (NEW.recipient_id, NEW.sender_id, 'wave', now());
  RETURN NEW;
END;
$$;


--
-- Name: owns_import_job(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_import_job(p_job bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.import_jobs j
     where j.id = p_job and j.user_id = auth.uid()
  );
$$;


--
-- Name: popular_reviews(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.popular_reviews(p_days integer DEFAULT 7, p_limit integer DEFAULT 6) RETURNS TABLE(id bigint, username text, avatar_url text, review_text text, item_id text, item_type text, item_name text, image_url text, reaction_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: profile_visible_to_viewer(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_visible_to_viewer(owner_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_visibility text;
  v_deleted timestamptz;
  viewer_id uuid;
BEGIN
  viewer_id := auth.uid();

  SELECT visibility, deleted_at INTO v_visibility, v_deleted
  FROM public.users WHERE id = owner_user_id;

  -- Deleted users are invisible.
  IF v_deleted IS NOT NULL THEN
    RETURN false;
  END IF;

  -- You can always see your own.
  IF viewer_id IS NOT NULL AND viewer_id = owner_user_id THEN
    RETURN true;
  END IF;

  -- A block beats visibility, including 'public', and cuts both ways.
  IF viewer_id IS NOT NULL AND public.is_blocked(viewer_id, owner_user_id) THEN
    RETURN false;
  END IF;

  IF v_visibility IS NULL OR v_visibility = 'public' THEN
    RETURN true;
  END IF;

  -- Private: only the owner, and the owner already returned above.
  IF v_visibility = 'private' THEN
    RETURN false;
  END IF;

  IF v_visibility = 'followers' AND viewer_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_connections
      WHERE follower_id = viewer_id AND followed_id = owner_user_id
    );
  END IF;

  RETURN false;
END;
$$;


--
-- Name: record_rewatch(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_rewatch(p_user_id uuid, p_item_id text, p_item_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT watch_count INTO current_count
  FROM public.user_media_status
  WHERE user_id = p_user_id AND item_id = p_item_id;

  IF current_count IS NULL THEN
    -- First time watching
    INSERT INTO public.user_media_status (user_id, item_id, item_type, status, watch_count, updated_at)
    VALUES (p_user_id, p_item_id, p_item_type, 'watched', 1, now())
    ON CONFLICT (user_id, item_id) DO NOTHING;
  ELSE
    -- Rewatch: bump counter
    UPDATE public.user_media_status
    SET watch_count = watch_count + 1, updated_at = now()
    WHERE user_id = p_user_id AND item_id = p_item_id;
  END IF;

  -- Always insert into history
  INSERT INTO public.watch_history (user_id, item_id, item_type, watch_number)
  VALUES (p_user_id, p_item_id, p_item_type, COALESCE(current_count, 0) + 1);
END;
$$;


--
-- Name: recount_user_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recount_user_stats(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: related_by_audience(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.related_by_audience(p_item_id text, p_item_type text, p_limit integer DEFAULT 200) RETURNS TABLE(item_id text, item_type text, co_watchers integer, seed_watchers integer, score numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH seed AS (
    -- Who engaged with the title being viewed, public profiles only.
    SELECT a.user_id, a.weight
      FROM public.user_title_affinity a
      JOIN public.users u ON u.id = a.user_id
     WHERE a.item_id = p_item_id
       AND a.item_type = p_item_type
       AND lower(trim(coalesce(u.visibility::text, 'public'))) = 'public'
  ),
  gate AS (
    -- One row iff the seed's audience clears the k-anonymity floor. Joining
    -- against this is what makes the floor unskippable rather than advisory.
    SELECT count(*)::int AS n FROM seed HAVING count(*) >= 5
  )
  SELECT
    o.item_id                                            AS item_id,
    o.item_type                                          AS item_type,
    count(*)::int                                        AS co_watchers,
    (SELECT n FROM gate)                                 AS seed_watchers,
    -- Shrunk toward zero so one co-watcher out of forty is not ranked as
    -- confidently as twenty are, the same instinct as 043's |S|/(|S|+3).
    round(
      (count(*)::numeric / (SELECT n FROM gate))
      * (count(*)::numeric / (count(*)::numeric + 2)),
      4
    )                                                    AS score
    FROM public.user_title_affinity o
    JOIN seed s ON s.user_id = o.user_id
   CROSS JOIN gate
   WHERE NOT (o.item_id = p_item_id AND o.item_type = p_item_type)
   GROUP BY o.item_id, o.item_type
  HAVING count(*) >= 2
   -- Aliased above so these names resolve to the select list rather than to
   -- the RETURNS TABLE output parameters, which is the difference between
   -- sorting on what you meant and failing at CREATE FUNCTION time.
   ORDER BY score DESC, co_watchers DESC, o.item_id
   LIMIT greatest(1, least(coalesce(p_limit, 200), 500));
$$;


--
-- Name: FUNCTION related_by_audience(p_item_id text, p_item_type text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.related_by_audience(p_item_id text, p_item_type text, p_limit integer) IS 'Co-engagement counts for one title, public profiles only, floored at 5 seed watchers and 2 co-watchers. Returns counts, never identities.';


--
-- Name: remove_watched_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_watched_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.user_activity
   where user_id = old.user_id
     and item_id = old.item_id
     and activity_type in ('watched', 'reviewed');
  return old;
end;
$$;


--
-- Name: reviews_for_title(text, text, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reviews_for_title(p_item_id text, p_item_type text, p_viewer uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0) RETURNS TABLE(id bigint, user_id uuid, username text, avatar_url text, review_text text, watched_at timestamp with time zone, score smallint, reaction_count bigint, viewer_reacted boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_club_member_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_club_member_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.clubs c
  SET member_count = (
    SELECT count(*) FROM public.club_members m
    WHERE m.club_id = c.id AND m.status = 'active'
  )
  WHERE c.id = COALESCE(NEW.club_id, OLD.club_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: sync_user_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM affected_users WHERE user_id IS NOT NULL LOOP
    PERFORM public.recount_user_stats(r.user_id);
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: taste_compatibility(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.taste_compatibility(p_a uuid, p_b uuid) RETURNS TABLE(score numeric, shared_count integer, top_shared jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
-- (The pragma is first because plpgsql only accepts it ahead of the body.)
-- RETURNS TABLE declares OUT variables named score/shared_count/top_shared, and
-- the final SELECT aliases three columns to those same names. Nothing below
-- references the variables, so make columns win explicitly rather than relying
-- on every reference staying qualified forever.
BEGIN
  -- 1. Only ever about the caller.
  IF auth.uid() IS NULL OR p_a IS DISTINCT FROM auth.uid() THEN
    RETURN;
  END IF;

  -- 2. The other profile has to be one the caller may see at all.
  IF p_a IS DISTINCT FROM p_b AND NOT public.profile_visible_to_viewer(p_b) THEN
    RETURN;
  END IF;

  -- 3. A block in either direction ends the conversation.
  IF public.is_blocked(p_a, p_b) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH totals AS (
    SELECT count(DISTINCT a.user_id)::numeric AS n_users FROM user_title_affinity a
  ),
  idf AS (
    SELECT a.item_type, a.item_id,
           ln(1 + (SELECT n_users FROM totals) / count(DISTINCT a.user_id)::numeric) AS idf,
           count(DISTINCT a.user_id)::int AS viewers
    FROM user_title_affinity a
    GROUP BY a.item_type, a.item_id
  ),
  norms AS (
    SELECT a.user_id, sqrt(sum((a.weight * i.idf) ^ 2)) AS nrm
    FROM user_title_affinity a
    JOIN idf i ON i.item_type = a.item_type AND i.item_id = a.item_id
    WHERE a.user_id IN (p_a, p_b)
    GROUP BY a.user_id
  ),
  pairs AS (
    SELECT
      x.weight * y.weight * i.idf * i.idf
        * COALESCE(1 - abs(rx.score - ry.score) / 9.0, 1) AS contrib,
      i.idf,
      i.viewers,
      COALESCE(x.item_name, y.item_name, '') AS item_name,
      x.item_type, x.item_id
    FROM user_title_affinity x
    JOIN user_title_affinity y
      ON y.item_type = x.item_type AND y.item_id = x.item_id AND y.user_id = p_b
    JOIN idf i ON i.item_type = x.item_type AND i.item_id = x.item_id
    LEFT JOIN user_ratings rx
      ON rx.user_id = p_a AND rx.item_type = x.item_type AND rx.item_id = x.item_id
    LEFT JOIN user_ratings ry
      ON ry.user_id = p_b AND ry.item_type = x.item_type AND ry.item_id = x.item_id
    WHERE x.user_id = p_a
  )
  SELECT
    round(
      (COALESCE(sum(p.contrib), 0)
        / NULLIF(
            (SELECT nrm FROM norms WHERE norms.user_id = p_a)
            * (SELECT nrm FROM norms WHERE norms.user_id = p_b), 0))
        * (count(*)::numeric / (count(*) + 3)),
      4
    ) AS score,
    count(*)::int AS shared_count,
    to_jsonb((array_agg(
      jsonb_build_object(
        'itemId', p.item_id,
        'itemType', p.item_type,
        'name', p.item_name,
        'rarity', round(p.idf, 3),
        'viewers', p.viewers,
        'totalUsers', (SELECT n_users::int FROM totals)
      ) ORDER BY p.idf DESC, p.item_name
    ))[1:3]) AS top_shared
  FROM pairs p;
END;
$$;


--
-- Name: taste_matches(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.taste_matches(p_user uuid, p_limit integer DEFAULT 10) RETURNS TABLE(user_id uuid, username text, avatar_url text, about text, score numeric, shared_count integer, top_shared jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH totals AS (
    SELECT count(DISTINCT a.user_id)::numeric AS n_users FROM user_title_affinity a
  ),
  idf AS (
    SELECT a.item_type, a.item_id,
           ln(1 + (SELECT n_users FROM totals) / count(DISTINCT a.user_id)::numeric) AS idf,
           count(DISTINCT a.user_id)::int AS viewers
    FROM user_title_affinity a
    GROUP BY a.item_type, a.item_id
  ),
  norms AS (
    SELECT a.user_id, sqrt(sum((a.weight * i.idf) ^ 2)) AS nrm
    FROM user_title_affinity a
    JOIN idf i ON i.item_type = a.item_type AND i.item_id = a.item_id
    GROUP BY a.user_id
  ),
  mine AS (
    SELECT a.item_type, a.item_id, a.weight, i.idf, i.viewers
    FROM user_title_affinity a
    JOIN idf i ON i.item_type = a.item_type AND i.item_id = a.item_id
    WHERE a.user_id = p_user
  ),
  candidates AS (
    SELECT u.id, u.username, u.avatar_url, u.about
    FROM users u
    WHERE u.id <> p_user
      AND u.visibility = 'public'
      AND u.username IS NOT NULL
      AND u.username <> ''
      AND NOT public.is_blocked(p_user, u.id)
  ),
  pairs AS (
    SELECT
      t.user_id,
      m.weight * t.weight * m.idf * m.idf
        * COALESCE(1 - abs(mr.score - tr.score) / 9.0, 1) AS contrib,
      m.idf,
      m.viewers,
      COALESCE(t.item_name, m2.item_name, '') AS item_name,
      t.item_type,
      t.item_id
    FROM mine m
    JOIN user_title_affinity t
      ON t.item_type = m.item_type AND t.item_id = m.item_id AND t.user_id <> p_user
    JOIN candidates c ON c.id = t.user_id
    LEFT JOIN user_title_affinity m2
      ON m2.user_id = p_user AND m2.item_type = m.item_type AND m2.item_id = m.item_id
    LEFT JOIN user_ratings mr
      ON mr.user_id = p_user AND mr.item_type = m.item_type AND mr.item_id = m.item_id
    LEFT JOIN user_ratings tr
      ON tr.user_id = t.user_id AND tr.item_type = t.item_type AND tr.item_id = t.item_id
  ),
  agg AS (
    SELECT
      p.user_id,
      sum(p.contrib) AS raw,
      count(*)::int AS shared_count,
      (array_agg(
        jsonb_build_object(
          'itemId', p.item_id,
          'itemType', p.item_type,
          'name', p.item_name,
          'rarity', round(p.idf, 3),
          'viewers', p.viewers,
          'totalUsers', (SELECT n_users::int FROM totals)
        ) ORDER BY p.idf DESC, p.item_name
      ))[1:3] AS top3
    FROM pairs p
    GROUP BY p.user_id
  )
  SELECT
    c.id,
    c.username,
    c.avatar_url,
    c.about,
    round(
      (a.raw / NULLIF((SELECT nrm FROM norms WHERE norms.user_id = p_user) * n.nrm, 0))
        * (a.shared_count::numeric / (a.shared_count + 3)),
      4
    ) AS score,
    a.shared_count,
    to_jsonb(a.top3) AS top_shared
  FROM agg a
  JOIN candidates c ON c.id = a.user_id
  JOIN norms n ON n.user_id = a.user_id
  WHERE a.raw > 0
  ORDER BY score DESC NULLS LAST, a.shared_count DESC
  LIMIT greatest(p_limit, 1);
$$;


--
-- Name: title_audience(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.title_audience(p_item_id text, p_item_type text, p_viewer uuid DEFAULT NULL::uuid) RETURNS TABLE(viewers integer, total_users integer, sample jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH watchers AS (
    SELECT a.user_id
    FROM user_title_affinity a
    WHERE a.item_id = p_item_id
      AND a.item_type = p_item_type
      AND (p_viewer IS NULL OR a.user_id <> p_viewer)
      AND NOT public.is_blocked(COALESCE(p_viewer, a.user_id), a.user_id)
  ),
  visible AS (
    SELECT u.id, u.username, u.avatar_url
    FROM watchers w
    JOIN users u ON u.id = w.user_id
    WHERE u.visibility = 'public' AND u.username IS NOT NULL AND u.username <> ''
  )
  SELECT
    (SELECT count(*)::int FROM watchers),
    (SELECT count(DISTINCT a.user_id)::int FROM user_title_affinity a),
    COALESCE(
      (SELECT jsonb_agg(x) FROM (
        SELECT id AS "userId", username, avatar_url AS "avatarUrl"
        FROM visible
        LIMIT 5
      ) x),
      '[]'::jsonb
    );
$$;


--
-- Name: title_rating_histogram(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.title_rating_histogram(p_item_id text, p_item_type text) RETURNS TABLE(score smallint, count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- generate_series, not a GROUP BY over the rows, so a score nobody gave
  -- comes back as a zero rather than as a missing bar the caller has to
  -- reconstruct.
  SELECT s::smallint AS score,
         COALESCE(c.n, 0)::int AS count
  FROM generate_series(1, 10) AS s
  LEFT JOIN (
    SELECT r.score AS sc, COUNT(*) AS n
    FROM public.user_ratings r
    WHERE r.item_id = p_item_id
      AND r.item_type = p_item_type
      AND r.score BETWEEN 1 AND 10
    GROUP BY r.score
  ) c ON c.sc = s
  ORDER BY s;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    icon text NOT NULL,
    category text NOT NULL,
    CONSTRAINT achievements_category_check CHECK ((category = ANY (ARRAY['watching'::text, 'reviewing'::text, 'social'::text, 'exploration'::text, 'milestone'::text])))
);


--
-- Name: background_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.background_jobs (
    id bigint NOT NULL,
    job_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status public.job_status DEFAULT 'pending'::public.job_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    result jsonb,
    error text,
    scheduled_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: background_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.background_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: background_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.background_jobs_id_seq OWNED BY public.background_jobs.id;


--
-- Name: club_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_members (
    club_id bigint NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'moderator'::text, 'member'::text]))),
    CONSTRAINT club_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'banned'::text])))
);


--
-- Name: club_picks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_picks (
    id bigint NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    title text NOT NULL,
    image_url text,
    note text,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    picked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    club_id bigint,
    CONSTRAINT club_picks_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: club_picks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_picks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_picks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_picks_id_seq OWNED BY public.club_picks.id;


--
-- Name: clubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clubs (
    id bigint NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    join_policy text DEFAULT 'open'::text NOT NULL,
    created_by uuid NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clubs_join_policy_check CHECK ((join_policy = ANY (ARRAY['open'::text, 'request'::text])))
);


--
-- Name: clubs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clubs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clubs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clubs_id_seq OWNED BY public.clubs.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    parent_id bigint,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comments_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000))),
    CONSTRAINT comments_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text, 'review'::text, 'episode'::text, 'club_pick'::text, 'club'::text])))
);


--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: episode_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_ratings (
    user_id uuid NOT NULL,
    show_id text NOT NULL,
    season_number integer NOT NULL,
    episode_number integer NOT NULL,
    score integer,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT episode_ratings_score_check CHECK (((score >= 1) AND (score <= 10)))
);


--
-- Name: favorite_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorite_items (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_name text NOT NULL,
    item_type text NOT NULL,
    image_url text,
    item_adult boolean DEFAULT false NOT NULL,
    genres text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT favorite_items_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: favorite_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.favorite_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: favorite_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.favorite_items_id_seq OWNED BY public.favorite_items.id;


--
-- Name: import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_jobs (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    source text DEFAULT 'letterboxd'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    processed_rows integer DEFAULT 0 NOT NULL,
    resolved_rows integer DEFAULT 0 NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT import_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: import_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.import_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: import_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.import_jobs_id_seq OWNED BY public.import_jobs.id;


--
-- Name: import_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_rows (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    title text NOT NULL,
    year integer,
    letterboxd_uri text,
    watched boolean DEFAULT false NOT NULL,
    watchlist boolean DEFAULT false NOT NULL,
    favorite boolean DEFAULT false NOT NULL,
    rating smallint,
    review_text text,
    watched_date date,
    status text DEFAULT 'pending'::text NOT NULL,
    tmdb_id text,
    tmdb_type text,
    matched_title text,
    CONSTRAINT import_rows_rating_check CHECK (((rating >= 1) AND (rating <= 10))),
    CONSTRAINT import_rows_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'unresolved'::text, 'skipped'::text]))),
    CONSTRAINT import_rows_tmdb_type_check CHECK ((tmdb_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: import_rows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.import_rows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: import_rows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.import_rows_id_seq OWNED BY public.import_rows.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    content text NOT NULL,
    message_type public.message_type DEFAULT 'text'::public.message_type NOT NULL,
    metadata jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    notification_type text NOT NULL,
    actor_id uuid,
    target_type text,
    target_id bigint,
    metadata jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_notification_type_check CHECK ((notification_type = ANY (ARRAY['follow_request'::text, 'follow_accepted'::text, 'like'::text, 'friend_watched'::text, 'friend_reviewed'::text, 'friend_rated'::text, 'comment_reply'::text, 'dm_received'::text, 'new_follower'::text, 'friend_started_watching'::text, 'achievement_unlocked'::text, 'wave'::text, 'new_episode'::text])))
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


--
-- Name: COLUMN notifications.actor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.actor_id IS 'The user who caused this notification. NULL for system notifications such as new_episode, where nobody acted.';


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: notified_episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notified_episodes (
    user_id uuid NOT NULL,
    show_id text NOT NULL,
    season_number integer NOT NULL,
    episode_number integer NOT NULL,
    notified_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reactions (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reactions_target_type_check CHECK ((target_type = ANY (ARRAY['review'::text, 'watched'::text, 'rating'::text, 'list'::text, 'comment'::text, 'activity'::text, 'club_pick'::text])))
);


--
-- Name: reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reactions_id_seq OWNED BY public.reactions.id;


--
-- Name: recommendation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    name text NOT NULL,
    item_type text NOT NULL,
    image text,
    adult boolean DEFAULT false NOT NULL,
    recommended_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: recommendation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recommendation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recommendation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recommendation_id_seq OWNED BY public.recommendation.id;


--
-- Name: season_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.season_reviews (
    user_id uuid NOT NULL,
    show_id text NOT NULL,
    season_number integer NOT NULL,
    score smallint,
    review_text text,
    public_review_text text,
    show_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT season_reviews_score_check CHECK (((score >= 1) AND (score <= 10))),
    CONSTRAINT season_reviews_season_number_check CHECK ((season_number >= 0))
);


--
-- Name: takes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.takes (
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    scope text DEFAULT 'title'::text NOT NULL,
    season_number integer DEFAULT '-1'::integer NOT NULL,
    episode_number integer DEFAULT '-1'::integer NOT NULL,
    score smallint,
    body text,
    is_public boolean DEFAULT false NOT NULL,
    watched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT takes_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text]))),
    CONSTRAINT takes_not_empty CHECK (((score IS NOT NULL) OR (NULLIF(btrim(body), ''::text) IS NOT NULL))),
    CONSTRAINT takes_scope_check CHECK ((scope = ANY (ARRAY['title'::text, 'season'::text, 'episode'::text]))),
    CONSTRAINT takes_scope_shape CHECK ((((scope = 'title'::text) AND (season_number = '-1'::integer) AND (episode_number = '-1'::integer)) OR ((scope = 'season'::text) AND (season_number >= 0) AND (episode_number = '-1'::integer)) OR ((scope = 'episode'::text) AND (season_number >= 0) AND (episode_number >= 1)))),
    CONSTRAINT takes_score_check CHECK (((score >= 1) AND (score <= 10)))
);


--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievements (
    user_id uuid NOT NULL,
    achievement_id text NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL
);


--
-- Name: user_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    activity_type text NOT NULL,
    item_id text,
    item_type text,
    item_name text,
    image_url text,
    score smallint,
    review_text text,
    list_name text,
    list_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_activity_activity_type_check CHECK ((activity_type = ANY (ARRAY['watched'::text, 'rated'::text, 'reviewed'::text, 'list_created'::text, 'favored'::text, 'started_watching'::text]))),
    CONSTRAINT user_activity_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text]))),
    CONSTRAINT user_activity_score_check CHECK (((score >= 1) AND (score <= 10)))
);


--
-- Name: user_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_activity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_activity_id_seq OWNED BY public.user_activity.id;


--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_blocks (
    id bigint NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_blocks_check CHECK ((blocker_id <> blocked_id))
);


--
-- Name: user_blocks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_blocks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_blocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_blocks_id_seq OWNED BY public.user_blocks.id;


--
-- Name: user_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_connections (
    id bigint NOT NULL,
    follower_id uuid NOT NULL,
    followed_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_connections_check CHECK ((follower_id <> followed_id))
);


--
-- Name: user_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_connections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_connections_id_seq OWNED BY public.user_connections.id;


--
-- Name: user_cout_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_cout_stats (
    user_id uuid NOT NULL,
    watched_count integer DEFAULT 0 NOT NULL,
    favorites_count integer DEFAULT 0 NOT NULL,
    watchlist_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    watching_count integer DEFAULT 0 NOT NULL,
    episodes_count integer DEFAULT 0 NOT NULL
);


--
-- Name: user_favorite_display; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_favorite_display (
    user_id uuid NOT NULL,
    "position" smallint NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    image_url text,
    item_name text NOT NULL,
    CONSTRAINT user_favorite_display_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text]))),
    CONSTRAINT user_favorite_display_position_check CHECK ((("position" >= 1) AND ("position" <= 4)))
);


--
-- Name: user_follow_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_follow_requests (
    id bigint NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    status public.follow_request_status DEFAULT 'pending'::public.follow_request_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_follow_requests_check CHECK ((sender_id <> receiver_id))
);

ALTER TABLE ONLY public.user_follow_requests REPLICA IDENTITY FULL;


--
-- Name: user_follow_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_follow_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_follow_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_follow_requests_id_seq OWNED BY public.user_follow_requests.id;


--
-- Name: user_list_collaborators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_list_collaborators (
    list_id bigint NOT NULL,
    user_id uuid NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_list_follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_list_follows (
    list_id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_list_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_list_items (
    id bigint NOT NULL,
    list_id bigint NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    item_name text NOT NULL,
    image_url text,
    item_adult boolean DEFAULT false NOT NULL,
    genres text[],
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by uuid,
    CONSTRAINT user_list_items_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: user_list_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_list_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_list_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_list_items_id_seq OWNED BY public.user_list_items.id;


--
-- Name: user_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_lists (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    visibility public.visibility_level DEFAULT 'public'::public.visibility_level NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_lists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_lists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_lists_id_seq OWNED BY public.user_lists.id;


--
-- Name: user_media_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_media_status (
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    item_name text DEFAULT ''::text NOT NULL,
    image_url text,
    item_adult boolean DEFAULT false NOT NULL,
    genres text[],
    status text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    watch_count integer DEFAULT 1 NOT NULL,
    CONSTRAINT user_media_status_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text]))),
    CONSTRAINT user_media_status_status_check CHECK ((status = ANY (ARRAY['watchlist'::text, 'watching'::text, 'watched'::text, 'on_hold'::text, 'dropped'::text])))
);


--
-- Name: user_notification_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notification_prefs (
    user_id uuid NOT NULL,
    notify_streaming_changes boolean DEFAULT false NOT NULL,
    notify_new_episodes boolean DEFAULT false NOT NULL,
    notify_friend_activity boolean DEFAULT false NOT NULL,
    notify_digest text DEFAULT 'never'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_notification_prefs_notify_digest_check CHECK ((notify_digest = ANY (ARRAY['never'::text, 'daily'::text, 'weekly'::text])))
);


--
-- Name: user_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_providers (
    user_id uuid NOT NULL,
    provider_id integer NOT NULL,
    provider_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_ratings (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    score smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_ratings_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text]))),
    CONSTRAINT user_ratings_score_check CHECK (((score >= 1) AND (score <= 10)))
);


--
-- Name: user_ratings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_ratings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_ratings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_ratings_id_seq OWNED BY public.user_ratings.id;


--
-- Name: user_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_reports (
    id bigint NOT NULL,
    reporter_id uuid NOT NULL,
    reported_user_id uuid NOT NULL,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text])))
);


--
-- Name: user_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_reports_id_seq OWNED BY public.user_reports.id;


--
-- Name: user_title_affinity; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_title_affinity AS
 SELECT user_id,
    item_type,
    item_id,
    max(item_name) FILTER (WHERE (item_name IS NOT NULL)) AS item_name,
    sum(w) AS weight
   FROM ( SELECT user_media_status.user_id,
            user_media_status.item_type,
            user_media_status.item_id,
            user_media_status.item_name,
            1.0 AS w
           FROM public.user_media_status
          WHERE (user_media_status.status = ANY (ARRAY['watched'::text, 'watching'::text]))
        UNION ALL
         SELECT favorite_items.user_id,
            favorite_items.item_type,
            favorite_items.item_id,
            favorite_items.item_name,
            0.5 AS "numeric"
           FROM public.favorite_items
        UNION ALL
         SELECT user_ratings.user_id,
            user_ratings.item_type,
            user_ratings.item_id,
            NULL::text AS text,
            0.3 AS "numeric"
           FROM public.user_ratings
          WHERE (user_ratings.score >= 8)) s
  GROUP BY user_id, item_type, item_id;


--
-- Name: user_waves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_waves (
    id bigint NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_waves_no_self CHECK ((sender_id <> recipient_id))
);


--
-- Name: user_waves_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_waves_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_waves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_waves_id_seq OWNED BY public.user_waves.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    username text,
    about text,
    visibility public.visibility_level DEFAULT 'public'::public.visibility_level NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    banner_url text,
    tagline text,
    featured_list_id bigint,
    pinned_review_id bigint,
    profile_show_diary boolean DEFAULT true NOT NULL,
    profile_show_ratings boolean DEFAULT true NOT NULL,
    profile_show_public_reviews boolean DEFAULT true NOT NULL,
    default_tv_status text DEFAULT 'watching'::text NOT NULL,
    deleted_at timestamp with time zone,
    deletion_scheduled_at timestamp with time zone,
    watch_region text DEFAULT 'US'::text NOT NULL,
    CONSTRAINT users_default_tv_status_check CHECK ((default_tv_status = ANY (ARRAY['watching'::text, 'completed'::text, 'on_hold'::text, 'dropped'::text, 'plan_to_watch'::text])))
);


--
-- Name: COLUMN users.pinned_review_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.pinned_review_id IS 'watched_items.id; app must ensure it belongs to this user';


--
-- Name: COLUMN users.profile_show_diary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_show_diary IS 'When true, visitors who can see the profile see diary (review_text) on watched cards.';


--
-- Name: COLUMN users.profile_show_ratings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_show_ratings IS 'When true, visitors see ratings on profile.';


--
-- Name: COLUMN users.profile_show_public_reviews; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_show_public_reviews IS 'When true, visitors see public review snippets on profile.';


--
-- Name: COLUMN users.watch_region; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.watch_region IS 'ISO 3166-1 alpha-2. Which country''s streaming availability applies to this user.';


--
-- Name: watch_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watch_history (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    watched_at timestamp with time zone DEFAULT now() NOT NULL,
    watch_number integer DEFAULT 1 NOT NULL,
    CONSTRAINT watch_history_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: watch_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watch_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watch_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watch_history_id_seq OWNED BY public.watch_history.id;


--
-- Name: watch_session_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watch_session_participants (
    session_id bigint NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: watch_session_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watch_session_votes (
    session_id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    vote text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT watch_session_votes_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text]))),
    CONSTRAINT watch_session_votes_vote_check CHECK ((vote = ANY (ARRAY['in'::text, 'out'::text])))
);


--
-- Name: watch_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watch_sessions (
    id bigint NOT NULL,
    created_by uuid NOT NULL,
    region text DEFAULT 'US'::text NOT NULL,
    max_runtime integer,
    media_type text DEFAULT 'any'::text NOT NULL,
    moods text[] DEFAULT '{}'::text[] NOT NULL,
    allow_rewatch boolean DEFAULT false NOT NULL,
    decided_item_id text,
    decided_item_type text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT watch_sessions_decided_item_type_check CHECK ((decided_item_type = ANY (ARRAY['movie'::text, 'tv'::text]))),
    CONSTRAINT watch_sessions_media_type_check CHECK ((media_type = ANY (ARRAY['any'::text, 'movie'::text, 'tv'::text])))
);


--
-- Name: watch_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watch_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watch_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watch_sessions_id_seq OWNED BY public.watch_sessions.id;


--
-- Name: watched_episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watched_episodes (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    show_id text NOT NULL,
    season_number smallint NOT NULL,
    episode_number smallint NOT NULL,
    watched_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT watched_episodes_episode_number_check CHECK ((episode_number >= 1)),
    CONSTRAINT watched_episodes_season_number_check CHECK ((season_number >= 0))
);


--
-- Name: watched_episodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watched_episodes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watched_episodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watched_episodes_id_seq OWNED BY public.watched_episodes.id;


--
-- Name: watched_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watched_items (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_name text NOT NULL,
    item_type text NOT NULL,
    image_url text,
    item_adult boolean DEFAULT false NOT NULL,
    genres text[],
    watched_at timestamp with time zone DEFAULT now() NOT NULL,
    review_text text,
    public_review_text text,
    is_watched boolean DEFAULT true NOT NULL,
    CONSTRAINT watched_items_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: COLUMN watched_items.is_watched; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.watched_items.is_watched IS 'When false, item is not shown in Watched list but diary/public review row is kept.';


--
-- Name: watched_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watched_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watched_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watched_items_id_seq OWNED BY public.watched_items.id;


--
-- Name: watchlist_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watchlist_alerts (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    provider_name text NOT NULL,
    alert_type text NOT NULL,
    last_notified_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT watchlist_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['added'::text, 'removed'::text, 'price_drop'::text]))),
    CONSTRAINT watchlist_alerts_item_type_check CHECK ((item_type = ANY (ARRAY['movie'::text, 'tv'::text])))
);


--
-- Name: watchlist_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watchlist_alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watchlist_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watchlist_alerts_id_seq OWNED BY public.watchlist_alerts.id;


--
-- Name: year_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.year_reviews (
    user_id uuid NOT NULL,
    year integer NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT year_reviews_year_check CHECK (((year >= 1900) AND (year <= 2200)))
);


--
-- Name: background_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.background_jobs ALTER COLUMN id SET DEFAULT nextval('public.background_jobs_id_seq'::regclass);


--
-- Name: club_picks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_picks ALTER COLUMN id SET DEFAULT nextval('public.club_picks_id_seq'::regclass);


--
-- Name: clubs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs ALTER COLUMN id SET DEFAULT nextval('public.clubs_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: favorite_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items ALTER COLUMN id SET DEFAULT nextval('public.favorite_items_id_seq'::regclass);


--
-- Name: import_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs ALTER COLUMN id SET DEFAULT nextval('public.import_jobs_id_seq'::regclass);


--
-- Name: import_rows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_rows ALTER COLUMN id SET DEFAULT nextval('public.import_rows_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: reactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions ALTER COLUMN id SET DEFAULT nextval('public.reactions_id_seq'::regclass);


--
-- Name: recommendation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation ALTER COLUMN id SET DEFAULT nextval('public.recommendation_id_seq'::regclass);


--
-- Name: user_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity ALTER COLUMN id SET DEFAULT nextval('public.user_activity_id_seq'::regclass);


--
-- Name: user_blocks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks ALTER COLUMN id SET DEFAULT nextval('public.user_blocks_id_seq'::regclass);


--
-- Name: user_connections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections ALTER COLUMN id SET DEFAULT nextval('public.user_connections_id_seq'::regclass);


--
-- Name: user_follow_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests ALTER COLUMN id SET DEFAULT nextval('public.user_follow_requests_id_seq'::regclass);


--
-- Name: user_list_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_items ALTER COLUMN id SET DEFAULT nextval('public.user_list_items_id_seq'::regclass);


--
-- Name: user_lists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_lists ALTER COLUMN id SET DEFAULT nextval('public.user_lists_id_seq'::regclass);


--
-- Name: user_ratings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ratings ALTER COLUMN id SET DEFAULT nextval('public.user_ratings_id_seq'::regclass);


--
-- Name: user_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_reports ALTER COLUMN id SET DEFAULT nextval('public.user_reports_id_seq'::regclass);


--
-- Name: user_waves id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_waves ALTER COLUMN id SET DEFAULT nextval('public.user_waves_id_seq'::regclass);


--
-- Name: watch_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_history ALTER COLUMN id SET DEFAULT nextval('public.watch_history_id_seq'::regclass);


--
-- Name: watch_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_sessions ALTER COLUMN id SET DEFAULT nextval('public.watch_sessions_id_seq'::regclass);


--
-- Name: watched_episodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_episodes ALTER COLUMN id SET DEFAULT nextval('public.watched_episodes_id_seq'::regclass);


--
-- Name: watched_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_items ALTER COLUMN id SET DEFAULT nextval('public.watched_items_id_seq'::regclass);


--
-- Name: watchlist_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_alerts ALTER COLUMN id SET DEFAULT nextval('public.watchlist_alerts_id_seq'::regclass);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: background_jobs background_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);


--
-- Name: club_members club_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_pkey PRIMARY KEY (club_id, user_id);


--
-- Name: club_picks club_picks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_picks
    ADD CONSTRAINT club_picks_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_slug_key UNIQUE (slug);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: episode_ratings episode_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_ratings
    ADD CONSTRAINT episode_ratings_pkey PRIMARY KEY (user_id, show_id, season_number, episode_number);


--
-- Name: favorite_items favorite_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_pkey PRIMARY KEY (id);


--
-- Name: favorite_items favorite_items_user_item_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_user_item_type_key UNIQUE (user_id, item_id, item_type);


--
-- Name: import_jobs import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);


--
-- Name: import_rows import_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_rows
    ADD CONSTRAINT import_rows_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: notified_episodes notified_episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notified_episodes
    ADD CONSTRAINT notified_episodes_pkey PRIMARY KEY (user_id, show_id, season_number, episode_number);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_user_id_target_type_target_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_target_type_target_id_key UNIQUE (user_id, target_type, target_id);


--
-- Name: recommendation recommendation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation
    ADD CONSTRAINT recommendation_pkey PRIMARY KEY (id);


--
-- Name: season_reviews season_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_reviews
    ADD CONSTRAINT season_reviews_pkey PRIMARY KEY (user_id, show_id, season_number);


--
-- Name: takes takes_identity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.takes
    ADD CONSTRAINT takes_identity_key UNIQUE (user_id, item_id, item_type, scope, season_number, episode_number, is_public);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (user_id, achievement_id);


--
-- Name: user_activity user_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity
    ADD CONSTRAINT user_activity_pkey PRIMARY KEY (id);


--
-- Name: user_blocks user_blocks_blocker_id_blocked_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);


--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (id);


--
-- Name: user_connections user_connections_follower_id_followed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections
    ADD CONSTRAINT user_connections_follower_id_followed_id_key UNIQUE (follower_id, followed_id);


--
-- Name: user_connections user_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections
    ADD CONSTRAINT user_connections_pkey PRIMARY KEY (id);


--
-- Name: user_cout_stats user_cout_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cout_stats
    ADD CONSTRAINT user_cout_stats_pkey PRIMARY KEY (user_id);


--
-- Name: user_favorite_display user_favorite_display_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_display
    ADD CONSTRAINT user_favorite_display_pkey PRIMARY KEY (user_id, "position");


--
-- Name: user_follow_requests user_follow_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests
    ADD CONSTRAINT user_follow_requests_pkey PRIMARY KEY (id);


--
-- Name: user_follow_requests user_follow_requests_sender_id_receiver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests
    ADD CONSTRAINT user_follow_requests_sender_id_receiver_id_key UNIQUE (sender_id, receiver_id);


--
-- Name: user_list_collaborators user_list_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_collaborators
    ADD CONSTRAINT user_list_collaborators_pkey PRIMARY KEY (list_id, user_id);


--
-- Name: user_list_follows user_list_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_follows
    ADD CONSTRAINT user_list_follows_pkey PRIMARY KEY (list_id, user_id);


--
-- Name: user_list_items user_list_items_list_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_items
    ADD CONSTRAINT user_list_items_list_id_item_id_key UNIQUE (list_id, item_id);


--
-- Name: user_list_items user_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_items
    ADD CONSTRAINT user_list_items_pkey PRIMARY KEY (id);


--
-- Name: user_lists user_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_lists
    ADD CONSTRAINT user_lists_pkey PRIMARY KEY (id);


--
-- Name: user_media_status user_media_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_media_status
    ADD CONSTRAINT user_media_status_pkey PRIMARY KEY (user_id, item_id, item_type);


--
-- Name: user_notification_prefs user_notification_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_prefs
    ADD CONSTRAINT user_notification_prefs_pkey PRIMARY KEY (user_id);


--
-- Name: user_providers user_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_providers
    ADD CONSTRAINT user_providers_pkey PRIMARY KEY (user_id, provider_id);


--
-- Name: user_ratings user_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ratings
    ADD CONSTRAINT user_ratings_pkey PRIMARY KEY (id);


--
-- Name: user_ratings user_ratings_user_item_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ratings
    ADD CONSTRAINT user_ratings_user_item_type_key UNIQUE (user_id, item_id, item_type);


--
-- Name: user_reports user_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_pkey PRIMARY KEY (id);


--
-- Name: user_waves user_waves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_waves
    ADD CONSTRAINT user_waves_pkey PRIMARY KEY (id);


--
-- Name: user_waves user_waves_unique_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_waves
    ADD CONSTRAINT user_waves_unique_pair UNIQUE (sender_id, recipient_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: watch_history watch_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_history
    ADD CONSTRAINT watch_history_pkey PRIMARY KEY (id);


--
-- Name: watch_session_participants watch_session_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_session_participants
    ADD CONSTRAINT watch_session_participants_pkey PRIMARY KEY (session_id, user_id);


--
-- Name: watch_session_votes watch_session_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_session_votes
    ADD CONSTRAINT watch_session_votes_pkey PRIMARY KEY (session_id, user_id, item_id);


--
-- Name: watch_sessions watch_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_sessions
    ADD CONSTRAINT watch_sessions_pkey PRIMARY KEY (id);


--
-- Name: watched_episodes watched_episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_episodes
    ADD CONSTRAINT watched_episodes_pkey PRIMARY KEY (id);


--
-- Name: watched_episodes watched_episodes_user_id_show_id_season_number_episode_numb_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_episodes
    ADD CONSTRAINT watched_episodes_user_id_show_id_season_number_episode_numb_key UNIQUE (user_id, show_id, season_number, episode_number);


--
-- Name: watched_items watched_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_items
    ADD CONSTRAINT watched_items_pkey PRIMARY KEY (id);


--
-- Name: watched_items watched_items_user_item_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_items
    ADD CONSTRAINT watched_items_user_item_type_key UNIQUE (user_id, item_id, item_type);


--
-- Name: watchlist_alerts watchlist_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_alerts
    ADD CONSTRAINT watchlist_alerts_pkey PRIMARY KEY (id);


--
-- Name: watchlist_alerts watchlist_alerts_user_id_item_id_provider_name_alert_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_alerts
    ADD CONSTRAINT watchlist_alerts_user_id_item_id_provider_name_alert_type_key UNIQUE (user_id, item_id, provider_name, alert_type);


--
-- Name: year_reviews year_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_reviews
    ADD CONSTRAINT year_reviews_pkey PRIMARY KEY (user_id, year);


--
-- Name: background_jobs_scheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX background_jobs_scheduled_idx ON public.background_jobs USING btree (scheduled_at) WHERE (status = 'pending'::public.job_status);


--
-- Name: background_jobs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX background_jobs_status_idx ON public.background_jobs USING btree (status);


--
-- Name: background_jobs_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX background_jobs_type_idx ON public.background_jobs USING btree (job_type);


--
-- Name: club_members_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_members_user_active_idx ON public.club_members USING btree (user_id) WHERE (status = 'active'::text);


--
-- Name: club_picks_club_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_picks_club_idx ON public.club_picks USING btree (club_id, starts_at DESC);


--
-- Name: club_picks_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_picks_starts_at_idx ON public.club_picks USING btree (starts_at DESC);


--
-- Name: comments_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_item_idx ON public.comments USING btree (item_id, item_type, created_at DESC);


--
-- Name: comments_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_parent_idx ON public.comments USING btree (parent_id) WHERE (parent_id IS NOT NULL);


--
-- Name: comments_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_user_idx ON public.comments USING btree (user_id, created_at DESC);


--
-- Name: favorite_items_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favorite_items_item_idx ON public.favorite_items USING btree (item_id, item_type);


--
-- Name: favorite_items_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favorite_items_user_id_idx ON public.favorite_items USING btree (user_id);


--
-- Name: import_jobs_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX import_jobs_user_idx ON public.import_jobs USING btree (user_id, created_at DESC);


--
-- Name: import_rows_job_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX import_rows_job_status_idx ON public.import_rows USING btree (job_id, status);


--
-- Name: import_rows_job_title_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX import_rows_job_title_year_idx ON public.import_rows USING btree (job_id, lower(title), COALESCE(year, 0));


--
-- Name: messages_is_read_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_is_read_idx ON public.messages USING btree (is_read);


--
-- Name: messages_recipient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_recipient_id_idx ON public.messages USING btree (recipient_id);


--
-- Name: messages_sender_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_sender_id_idx ON public.messages USING btree (sender_id);


--
-- Name: notifications_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_created_at_idx ON public.notifications USING btree (created_at DESC);


--
-- Name: notifications_user_all_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_all_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: notifications_user_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id, is_read) WHERE (NOT is_read);


--
-- Name: notified_episodes_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notified_episodes_user_idx ON public.notified_episodes USING btree (user_id, notified_at DESC);


--
-- Name: reactions_review_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reactions_review_recent_idx ON public.reactions USING btree (target_type, created_at DESC) WHERE (target_type = 'review'::text);


--
-- Name: reactions_target_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reactions_target_count_idx ON public.reactions USING btree (target_type, target_id, user_id);


--
-- Name: reactions_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reactions_target_idx ON public.reactions USING btree (target_type, target_id);


--
-- Name: reactions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reactions_user_idx ON public.reactions USING btree (user_id);


--
-- Name: recommendation_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_user_id_idx ON public.recommendation USING btree (user_id);


--
-- Name: season_reviews_show_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX season_reviews_show_idx ON public.season_reviews USING btree (show_id, season_number);


--
-- Name: takes_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX takes_item_idx ON public.takes USING btree (item_id, item_type, scope);


--
-- Name: takes_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX takes_public_idx ON public.takes USING btree (item_id, item_type, scope) WHERE is_public;


--
-- Name: takes_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX takes_user_idx ON public.takes USING btree (user_id, updated_at DESC);


--
-- Name: user_achievements_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_achievements_user_idx ON public.user_achievements USING btree (user_id);


--
-- Name: user_activity_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_activity_created_at_idx ON public.user_activity USING btree (created_at DESC);


--
-- Name: user_activity_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_activity_user_id_created_at_idx ON public.user_activity USING btree (user_id, created_at DESC);


--
-- Name: user_blocks_blocked_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_blocks_blocked_idx ON public.user_blocks USING btree (blocked_id);


--
-- Name: user_blocks_blocker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_blocks_blocker_idx ON public.user_blocks USING btree (blocker_id);


--
-- Name: user_connections_followed_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_connections_followed_id_idx ON public.user_connections USING btree (followed_id);


--
-- Name: user_connections_follower_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_connections_follower_id_idx ON public.user_connections USING btree (follower_id);


--
-- Name: user_favorite_display_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_favorite_display_user_id_idx ON public.user_favorite_display USING btree (user_id);


--
-- Name: user_follow_requests_receiver_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_follow_requests_receiver_id_idx ON public.user_follow_requests USING btree (receiver_id);


--
-- Name: user_follow_requests_sender_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_follow_requests_sender_id_idx ON public.user_follow_requests USING btree (sender_id);


--
-- Name: user_list_collaborators_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_list_collaborators_user_idx ON public.user_list_collaborators USING btree (user_id);


--
-- Name: user_list_follows_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_list_follows_user_idx ON public.user_list_follows USING btree (user_id);


--
-- Name: user_list_items_list_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_list_items_list_id_idx ON public.user_list_items USING btree (list_id);


--
-- Name: user_lists_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_lists_user_id_idx ON public.user_lists USING btree (user_id);


--
-- Name: user_media_status_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_media_status_item_idx ON public.user_media_status USING btree (item_id, item_type);


--
-- Name: user_media_status_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_media_status_user_id_idx ON public.user_media_status USING btree (user_id);


--
-- Name: user_media_status_user_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_media_status_user_status_idx ON public.user_media_status USING btree (user_id, status);


--
-- Name: user_providers_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_providers_user_idx ON public.user_providers USING btree (user_id);


--
-- Name: user_ratings_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_ratings_item_idx ON public.user_ratings USING btree (item_id, item_type);


--
-- Name: user_waves_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_waves_recipient_idx ON public.user_waves USING btree (recipient_id);


--
-- Name: watch_history_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watch_history_user_id_idx ON public.watch_history USING btree (user_id, watched_at DESC);


--
-- Name: watch_history_user_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watch_history_user_item_idx ON public.watch_history USING btree (user_id, item_id);


--
-- Name: watch_session_participants_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watch_session_participants_user_idx ON public.watch_session_participants USING btree (user_id);


--
-- Name: watch_session_votes_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watch_session_votes_session_idx ON public.watch_session_votes USING btree (session_id);


--
-- Name: watch_sessions_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watch_sessions_creator_idx ON public.watch_sessions USING btree (created_by, created_at DESC);


--
-- Name: watched_episodes_show_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_episodes_show_id_idx ON public.watched_episodes USING btree (show_id);


--
-- Name: watched_episodes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_episodes_user_id_idx ON public.watched_episodes USING btree (user_id);


--
-- Name: watched_episodes_user_show_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_episodes_user_show_idx ON public.watched_episodes USING btree (user_id, show_id);


--
-- Name: watched_items_item_id_item_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_items_item_id_item_type_idx ON public.watched_items USING btree (item_id, item_type);


--
-- Name: watched_items_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watched_items_user_id_idx ON public.watched_items USING btree (user_id);


--
-- Name: watchlist_alerts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watchlist_alerts_user_id_idx ON public.watchlist_alerts USING btree (user_id);


--
-- Name: year_reviews_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX year_reviews_public_idx ON public.year_reviews USING btree (year) WHERE is_public;


--
-- Name: users create_user_cout_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_user_cout_stats AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.ensure_user_cout_stats();


--
-- Name: reactions notify_reaction_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_reaction_trigger AFTER INSERT ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.notify_reaction();


--
-- Name: comments set_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: season_reviews set_season_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_season_reviews_updated_at BEFORE UPDATE ON public.season_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: takes set_takes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_takes_updated_at BEFORE UPDATE ON public.takes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: episode_ratings set_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.episode_ratings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_cout_stats set_user_cout_stats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_cout_stats_updated_at BEFORE UPDATE ON public.user_cout_stats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_lists set_user_lists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_lists_updated_at BEFORE UPDATE ON public.user_lists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_notification_prefs set_user_notification_prefs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_notification_prefs_updated_at BEFORE UPDATE ON public.user_notification_prefs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users set_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: watched_episodes sync_stats_eps_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_eps_del AFTER DELETE ON public.watched_episodes REFERENCING OLD TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: watched_episodes sync_stats_eps_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_eps_ins AFTER INSERT ON public.watched_episodes REFERENCING NEW TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: watched_episodes sync_stats_eps_upd_new; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_eps_upd_new AFTER UPDATE ON public.watched_episodes REFERENCING NEW TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: watched_episodes sync_stats_eps_upd_old; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_eps_upd_old AFTER UPDATE ON public.watched_episodes REFERENCING OLD TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: favorite_items sync_stats_fav_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_fav_del AFTER DELETE ON public.favorite_items REFERENCING OLD TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: favorite_items sync_stats_fav_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_fav_ins AFTER INSERT ON public.favorite_items REFERENCING NEW TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: user_media_status sync_stats_ums_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_ums_del AFTER DELETE ON public.user_media_status REFERENCING OLD TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: user_media_status sync_stats_ums_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_ums_ins AFTER INSERT ON public.user_media_status REFERENCING NEW TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: user_media_status sync_stats_ums_upd_new; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_ums_upd_new AFTER UPDATE ON public.user_media_status REFERENCING NEW TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: user_media_status sync_stats_ums_upd_old; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_stats_ums_upd_old AFTER UPDATE ON public.user_media_status REFERENCING OLD TABLE AS affected_users FOR EACH STATEMENT EXECUTE FUNCTION public.sync_user_stats();


--
-- Name: messages trg_cleanup_dm_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cleanup_dm_notification AFTER DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.cleanup_dm_notification();


--
-- Name: clubs trg_club_owner_on_create; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_club_owner_on_create AFTER INSERT ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.club_owner_on_create();


--
-- Name: clubs trg_clubs_created_by_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clubs_created_by_immutable BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.clubs_created_by_immutable();


--
-- Name: user_lists trg_log_list_created_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_list_created_activity AFTER INSERT ON public.user_lists FOR EACH ROW EXECUTE FUNCTION public.log_list_created_activity();


--
-- Name: user_ratings trg_log_rated_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_rated_activity AFTER INSERT OR UPDATE ON public.user_ratings FOR EACH ROW EXECUTE FUNCTION public.log_rated_activity();


--
-- Name: watched_items trg_log_reviewed_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_reviewed_activity AFTER INSERT OR UPDATE ON public.watched_items FOR EACH ROW EXECUTE FUNCTION public.log_reviewed_activity();


--
-- Name: watched_items trg_log_watched_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_watched_activity AFTER INSERT OR UPDATE OF is_watched, watched_at ON public.watched_items FOR EACH ROW EXECUTE FUNCTION public.log_watched_activity();


--
-- Name: comments trg_notify_comment_reply; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_comment_reply AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_comment_reply();


--
-- Name: messages trg_notify_dm_received; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_dm_received AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_dm_received();


--
-- Name: user_follow_requests trg_notify_follow_accepted; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_follow_accepted AFTER UPDATE ON public.user_follow_requests FOR EACH ROW EXECUTE FUNCTION public.notify_follow_accepted();


--
-- Name: user_follow_requests trg_notify_follow_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_follow_request AFTER INSERT ON public.user_follow_requests FOR EACH ROW EXECUTE FUNCTION public.notify_follow_request();


--
-- Name: watched_items trg_notify_friend_watched; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_friend_watched AFTER INSERT ON public.watched_items FOR EACH ROW EXECUTE FUNCTION public.notify_friend_watched();


--
-- Name: reactions trg_notify_like; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_like AFTER INSERT ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.notify_like();


--
-- Name: user_connections trg_notify_new_follower; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_new_follower AFTER INSERT ON public.user_connections FOR EACH ROW EXECUTE FUNCTION public.notify_new_follower();


--
-- Name: user_media_status trg_notify_started_watching; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_started_watching AFTER INSERT OR UPDATE ON public.user_media_status FOR EACH ROW EXECUTE FUNCTION public.notify_started_watching();


--
-- Name: user_waves trg_notify_wave; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_wave AFTER INSERT ON public.user_waves FOR EACH ROW EXECUTE FUNCTION public.notify_wave();


--
-- Name: watched_items trg_remove_watched_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_remove_watched_activity AFTER DELETE ON public.watched_items FOR EACH ROW EXECUTE FUNCTION public.remove_watched_activity();


--
-- Name: club_members trg_sync_club_member_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_club_member_count AFTER INSERT OR DELETE OR UPDATE ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.sync_club_member_count();


--
-- Name: club_members club_members_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_members club_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: club_picks club_picks_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_picks
    ADD CONSTRAINT club_picks_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_picks club_picks_picked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_picks
    ADD CONSTRAINT club_picks_picked_by_fkey FOREIGN KEY (picked_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: clubs clubs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: episode_ratings episode_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_ratings
    ADD CONSTRAINT episode_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: favorite_items favorite_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: import_jobs import_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: import_rows import_rows_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_rows
    ADD CONSTRAINT import_rows_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.import_jobs(id) ON DELETE CASCADE;


--
-- Name: messages messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notified_episodes notified_episodes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notified_episodes
    ADD CONSTRAINT notified_episodes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recommendation recommendation_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation
    ADD CONSTRAINT recommendation_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: season_reviews season_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_reviews
    ADD CONSTRAINT season_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: takes takes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.takes
    ADD CONSTRAINT takes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_activity user_activity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity
    ADD CONSTRAINT user_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_connections user_connections_followed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections
    ADD CONSTRAINT user_connections_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_connections user_connections_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connections
    ADD CONSTRAINT user_connections_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_cout_stats user_cout_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cout_stats
    ADD CONSTRAINT user_cout_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_favorite_display user_favorite_display_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorite_display
    ADD CONSTRAINT user_favorite_display_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_follow_requests user_follow_requests_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests
    ADD CONSTRAINT user_follow_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_follow_requests user_follow_requests_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follow_requests
    ADD CONSTRAINT user_follow_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_list_collaborators user_list_collaborators_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_collaborators
    ADD CONSTRAINT user_list_collaborators_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_list_collaborators user_list_collaborators_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_collaborators
    ADD CONSTRAINT user_list_collaborators_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.user_lists(id) ON DELETE CASCADE;


--
-- Name: user_list_collaborators user_list_collaborators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_collaborators
    ADD CONSTRAINT user_list_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_list_follows user_list_follows_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_follows
    ADD CONSTRAINT user_list_follows_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.user_lists(id) ON DELETE CASCADE;


--
-- Name: user_list_follows user_list_follows_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_follows
    ADD CONSTRAINT user_list_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_list_items user_list_items_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_items
    ADD CONSTRAINT user_list_items_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_list_items user_list_items_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_list_items
    ADD CONSTRAINT user_list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.user_lists(id) ON DELETE CASCADE;


--
-- Name: user_lists user_lists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_lists
    ADD CONSTRAINT user_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_media_status user_media_status_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_media_status
    ADD CONSTRAINT user_media_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_notification_prefs user_notification_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_prefs
    ADD CONSTRAINT user_notification_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_providers user_providers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_providers
    ADD CONSTRAINT user_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_ratings user_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ratings
    ADD CONSTRAINT user_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_reports user_reports_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_reports user_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_waves user_waves_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_waves
    ADD CONSTRAINT user_waves_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_waves user_waves_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_waves
    ADD CONSTRAINT user_waves_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_featured_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_featured_list_id_fkey FOREIGN KEY (featured_list_id) REFERENCES public.user_lists(id) ON DELETE SET NULL;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: watch_history watch_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_history
    ADD CONSTRAINT watch_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watch_session_participants watch_session_participants_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_session_participants
    ADD CONSTRAINT watch_session_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.watch_sessions(id) ON DELETE CASCADE;


--
-- Name: watch_session_participants watch_session_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_session_participants
    ADD CONSTRAINT watch_session_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watch_session_votes watch_session_votes_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_session_votes
    ADD CONSTRAINT watch_session_votes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.watch_sessions(id) ON DELETE CASCADE;


--
-- Name: watch_session_votes watch_session_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_session_votes
    ADD CONSTRAINT watch_session_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watch_sessions watch_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_sessions
    ADD CONSTRAINT watch_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watched_episodes watched_episodes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_episodes
    ADD CONSTRAINT watched_episodes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watched_items watched_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watched_items
    ADD CONSTRAINT watched_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watchlist_alerts watchlist_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_alerts
    ADD CONSTRAINT watchlist_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: year_reviews year_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_reviews
    ADD CONSTRAINT year_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: episode_ratings Users can delete their own episode ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own episode ratings" ON public.episode_ratings FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: episode_ratings Users can insert/update their own episode ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert/update their own episode ratings" ON public.episode_ratings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: episode_ratings Users can update their own episode ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own episode ratings" ON public.episode_ratings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: episode_ratings Users can view their own episode ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own episode ratings" ON public.episode_ratings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: achievements achievements_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY achievements_select_all ON public.achievements FOR SELECT USING (true);


--
-- Name: background_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: background_jobs background_jobs_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY background_jobs_admin ON public.background_jobs USING ((auth.role() = 'service_role'::text));


--
-- Name: club_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

--
-- Name: club_members club_members_delete_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_members_delete_self_or_admin ON public.club_members FOR DELETE USING (((auth.uid() = user_id) OR public.is_club_admin(club_id, auth.uid())));


--
-- Name: club_members club_members_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_members_insert_self ON public.club_members FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (role = 'member'::text) AND (status =
CASE
    WHEN (( SELECT c.join_policy
       FROM public.clubs c
      WHERE (c.id = club_members.club_id)) = 'open'::text) THEN 'active'::text
    ELSE 'pending'::text
END)));


--
-- Name: club_members club_members_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_members_select_all ON public.club_members FOR SELECT USING (true);


--
-- Name: club_members club_members_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_members_update_admin ON public.club_members FOR UPDATE USING (public.is_club_admin(club_id, auth.uid())) WITH CHECK ((public.is_club_admin(club_id, auth.uid()) AND ((role <> 'owner'::text) OR public.is_club_owner(club_id, auth.uid()))));


--
-- Name: club_picks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_picks ENABLE ROW LEVEL SECURITY;

--
-- Name: club_picks club_picks_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_picks_delete_admin ON public.club_picks FOR DELETE USING (((club_id IS NOT NULL) AND public.is_club_admin(club_id, auth.uid())));


--
-- Name: club_picks club_picks_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_picks_select_all ON public.club_picks FOR SELECT USING (true);


--
-- Name: club_picks club_picks_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_picks_update_admin ON public.club_picks FOR UPDATE USING (((club_id IS NOT NULL) AND public.is_club_admin(club_id, auth.uid()))) WITH CHECK (((club_id IS NOT NULL) AND public.is_club_admin(club_id, auth.uid())));


--
-- Name: club_picks club_picks_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_picks_write_admin ON public.club_picks FOR INSERT WITH CHECK (((club_id IS NOT NULL) AND public.is_club_admin(club_id, auth.uid())));


--
-- Name: clubs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

--
-- Name: clubs clubs_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_delete_owner ON public.clubs FOR DELETE USING ((auth.uid() = created_by));


--
-- Name: clubs clubs_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_insert_self ON public.clubs FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: clubs clubs_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_select_all ON public.clubs FOR SELECT USING (true);


--
-- Name: clubs clubs_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_update_admin ON public.clubs FOR UPDATE USING (public.is_club_admin(id, auth.uid())) WITH CHECK (public.is_club_admin(id, auth.uid()));


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: comments comments_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_delete_self ON public.comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: comments comments_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_insert_self ON public.comments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: comments comments_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_select_public ON public.comments FOR SELECT USING (true);


--
-- Name: comments comments_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_update_self ON public.comments FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: episode_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.episode_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorite_items ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_items favorite_items_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY favorite_items_select_profile_visible ON public.favorite_items FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: favorite_items favorite_items_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY favorite_items_self ON public.favorite_items USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: import_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: import_jobs import_jobs_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_jobs_self ON public.import_jobs USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: import_rows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: import_rows import_rows_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_rows_self ON public.import_rows USING (public.owns_import_job(job_id)) WITH CHECK (public.owns_import_job(job_id));


--
-- Name: user_list_collaborators list_collaborators_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY list_collaborators_delete ON public.user_list_collaborators FOR DELETE USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.user_lists l
  WHERE ((l.id = user_list_collaborators.list_id) AND (l.user_id = auth.uid()))))));


--
-- Name: user_list_collaborators list_collaborators_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY list_collaborators_select ON public.user_list_collaborators FOR SELECT USING (true);


--
-- Name: user_list_collaborators list_collaborators_write_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY list_collaborators_write_owner ON public.user_list_collaborators FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_lists l
  WHERE ((l.id = user_list_collaborators.list_id) AND (l.user_id = auth.uid())))));


--
-- Name: user_list_follows list_follows_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY list_follows_delete_self ON public.user_list_follows FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_list_follows list_follows_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY list_follows_insert_self ON public.user_list_follows FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_list_follows list_follows_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY list_follows_select ON public.user_list_follows FOR SELECT USING (true);


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_delete_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_delete_participants ON public.messages FOR DELETE USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));


--
-- Name: messages messages_insert_sender; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert_sender ON public.messages FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (NOT public.is_blocked(sender_id, recipient_id))));


--
-- Name: messages messages_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select_participants ON public.messages FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));


--
-- Name: messages messages_update_recipient; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_update_recipient ON public.messages FOR UPDATE USING ((auth.uid() = recipient_id));


--
-- Name: user_notification_prefs notification_prefs_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_prefs_self ON public.user_notification_prefs USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_delete_self ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications notifications_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_self ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications notifications_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_self ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notified_episodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notified_episodes ENABLE ROW LEVEL SECURITY;

--
-- Name: notified_episodes notified_episodes_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notified_episodes_self_read ON public.notified_episodes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: reactions reactions_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reactions_delete_self ON public.reactions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: reactions reactions_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reactions_insert_self ON public.reactions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: reactions reactions_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reactions_select_all ON public.reactions FOR SELECT USING (true);


--
-- Name: recommendation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recommendation ENABLE ROW LEVEL SECURITY;

--
-- Name: recommendation recommendation_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recommendation_select_profile_visible ON public.recommendation FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: recommendation recommendation_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recommendation_self ON public.recommendation USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: season_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.season_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: season_reviews season_reviews_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY season_reviews_public_read ON public.season_reviews FOR SELECT USING (((public_review_text IS NOT NULL) AND public.profile_visible_to_viewer(user_id)));


--
-- Name: season_reviews season_reviews_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY season_reviews_self ON public.season_reviews USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: takes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.takes ENABLE ROW LEVEL SECURITY;

--
-- Name: takes takes_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY takes_public_read ON public.takes FOR SELECT USING ((is_public AND public.profile_visible_to_viewer(user_id)));


--
-- Name: takes takes_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY takes_self ON public.takes USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_achievements user_achievements_modify_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_achievements_modify_self ON public.user_achievements FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_achievements user_achievements_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_achievements_select_public ON public.user_achievements FOR SELECT USING ((public.profile_visible_to_viewer(user_id) OR (auth.uid() = user_id)));


--
-- Name: user_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: user_activity user_activity_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_activity_insert_self ON public.user_activity FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_activity user_activity_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_activity_select_visible ON public.user_activity FOR SELECT USING (public.profile_visible_to_viewer(user_id));


--
-- Name: user_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_blocks user_blocks_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_blocks_self ON public.user_blocks USING ((auth.uid() = blocker_id)) WITH CHECK ((auth.uid() = blocker_id));


--
-- Name: user_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: user_connections user_connections_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_connections_delete_self ON public.user_connections FOR DELETE USING ((auth.uid() = follower_id));


--
-- Name: user_connections user_connections_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_connections_insert_self ON public.user_connections FOR INSERT WITH CHECK (((auth.uid() = follower_id) AND (NOT public.is_blocked(follower_id, followed_id))));


--
-- Name: user_connections user_connections_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_connections_select_public ON public.user_connections FOR SELECT USING (true);


--
-- Name: user_cout_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_cout_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: user_cout_stats user_cout_stats_modify_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_cout_stats_modify_self ON public.user_cout_stats USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_cout_stats user_cout_stats_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_cout_stats_select_public ON public.user_cout_stats FOR SELECT USING (true);


--
-- Name: user_favorite_display; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_favorite_display ENABLE ROW LEVEL SECURITY;

--
-- Name: user_favorite_display user_favorite_display_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_favorite_display_delete_self ON public.user_favorite_display FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_favorite_display user_favorite_display_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_favorite_display_insert_self ON public.user_favorite_display FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_favorite_display user_favorite_display_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_favorite_display_select ON public.user_favorite_display FOR SELECT USING (true);


--
-- Name: user_favorite_display user_favorite_display_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_favorite_display_update_self ON public.user_favorite_display FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_follow_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_follow_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: user_follow_requests user_follow_requests_delete_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follow_requests_delete_participants ON public.user_follow_requests FOR DELETE USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: user_follow_requests user_follow_requests_insert_sender; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follow_requests_insert_sender ON public.user_follow_requests FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (NOT public.is_blocked(sender_id, receiver_id))));


--
-- Name: user_follow_requests user_follow_requests_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follow_requests_select_participants ON public.user_follow_requests FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: user_follow_requests user_follow_requests_update_receiver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follow_requests_update_receiver ON public.user_follow_requests FOR UPDATE USING ((auth.uid() = receiver_id));


--
-- Name: user_list_collaborators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_list_collaborators ENABLE ROW LEVEL SECURITY;

--
-- Name: user_list_follows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_list_follows ENABLE ROW LEVEL SECURITY;

--
-- Name: user_list_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_list_items ENABLE ROW LEVEL SECURITY;

--
-- Name: user_list_items user_list_items_delete_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_list_items_delete_editor ON public.user_list_items FOR DELETE USING (public.is_list_editor(list_id, auth.uid()));


--
-- Name: user_list_items user_list_items_insert_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_list_items_insert_editor ON public.user_list_items FOR INSERT WITH CHECK (public.is_list_editor(list_id, auth.uid()));


--
-- Name: user_list_items user_list_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_list_items_select ON public.user_list_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_lists l
  WHERE ((l.id = user_list_items.list_id) AND ((l.user_id = auth.uid()) OR (l.visibility = 'public'::public.visibility_level) OR ((l.visibility = 'followers'::public.visibility_level) AND (l.user_id IN ( SELECT user_connections.followed_id
           FROM public.user_connections
          WHERE (user_connections.follower_id = auth.uid())))))))));


--
-- Name: user_list_items user_list_items_update_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_list_items_update_editor ON public.user_list_items FOR UPDATE USING (public.is_list_editor(list_id, auth.uid()));


--
-- Name: user_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: user_lists user_lists_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_delete_self ON public.user_lists FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_lists user_lists_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_insert_self ON public.user_lists FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_lists user_lists_select_collaborator; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_select_collaborator ON public.user_lists FOR SELECT USING (((visibility = 'public'::public.visibility_level) OR (auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.user_list_collaborators c
  WHERE ((c.list_id = user_lists.id) AND (c.user_id = auth.uid()))))));


--
-- Name: user_lists user_lists_select_followers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_select_followers ON public.user_lists FOR SELECT USING (((visibility = 'followers'::public.visibility_level) AND (user_id IN ( SELECT user_connections.followed_id
   FROM public.user_connections
  WHERE (user_connections.follower_id = auth.uid())))));


--
-- Name: user_lists user_lists_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_select_own ON public.user_lists FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_lists user_lists_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_select_public ON public.user_lists FOR SELECT USING ((visibility = 'public'::public.visibility_level));


--
-- Name: user_lists user_lists_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_lists_update_self ON public.user_lists FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_media_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_media_status ENABLE ROW LEVEL SECURITY;

--
-- Name: user_media_status user_media_status_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_media_status_select_profile_visible ON public.user_media_status FOR SELECT USING (public.profile_visible_to_viewer(user_id));


--
-- Name: user_media_status user_media_status_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_media_status_self ON public.user_media_status USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_notification_prefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_providers user_providers_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_providers_select_profile_visible ON public.user_providers FOR SELECT USING (public.profile_visible_to_viewer(user_id));


--
-- Name: user_providers user_providers_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_providers_self ON public.user_providers USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_ratings user_ratings_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_ratings_select_profile_visible ON public.user_ratings FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: user_ratings user_ratings_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_ratings_self ON public.user_ratings USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: user_reports user_reports_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_reports_self ON public.user_reports USING ((auth.uid() = reporter_id)) WITH CHECK ((auth.uid() = reporter_id));


--
-- Name: user_waves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_waves ENABLE ROW LEVEL SECURITY;

--
-- Name: user_waves user_waves_delete_sender; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_waves_delete_sender ON public.user_waves FOR DELETE USING ((auth.uid() = sender_id));


--
-- Name: user_waves user_waves_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_waves_insert_self ON public.user_waves FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (NOT public.is_blocked(sender_id, recipient_id))));


--
-- Name: user_waves user_waves_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_waves_select_participants ON public.user_waves FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert_self ON public.users FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: users users_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_public ON public.users FOR SELECT USING (((deleted_at IS NULL) OR (auth.uid() = id)));


--
-- Name: users users_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_self ON public.users FOR UPDATE USING ((auth.uid() = id));


--
-- Name: watch_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

--
-- Name: watch_history watch_history_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watch_history_profile_visible ON public.watch_history FOR SELECT USING (public.profile_visible_to_viewer(user_id));


--
-- Name: watch_history watch_history_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watch_history_self ON public.watch_history USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: watch_session_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watch_session_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: watch_session_participants watch_session_participants_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watch_session_participants_owner_write ON public.watch_session_participants USING ((EXISTS ( SELECT 1
   FROM public.watch_sessions s
  WHERE ((s.id = watch_session_participants.session_id) AND (s.created_by = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.watch_sessions s
  WHERE ((s.id = watch_session_participants.session_id) AND (s.created_by = auth.uid())))));


--
-- Name: watch_session_participants watch_session_participants_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watch_session_participants_read ON public.watch_session_participants FOR SELECT USING (public.is_session_participant(session_id, auth.uid()));


--
-- Name: watch_session_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watch_session_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: watch_session_votes watch_session_votes_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watch_session_votes_read ON public.watch_session_votes FOR SELECT USING (public.is_session_participant(session_id, auth.uid()));


--
-- Name: watch_session_votes watch_session_votes_self_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watch_session_votes_self_write ON public.watch_session_votes USING (((auth.uid() = user_id) AND public.is_session_participant(session_id, auth.uid()))) WITH CHECK (((auth.uid() = user_id) AND public.is_session_participant(session_id, auth.uid())));


--
-- Name: watch_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watch_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: watch_sessions watch_sessions_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watch_sessions_owner_write ON public.watch_sessions USING ((auth.uid() = created_by)) WITH CHECK ((auth.uid() = created_by));


--
-- Name: watch_sessions watch_sessions_participant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watch_sessions_participant_read ON public.watch_sessions FOR SELECT USING (public.is_session_participant(id, auth.uid()));


--
-- Name: watched_episodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watched_episodes ENABLE ROW LEVEL SECURITY;

--
-- Name: watched_episodes watched_episodes_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watched_episodes_select_profile_visible ON public.watched_episodes FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: watched_episodes watched_episodes_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watched_episodes_self ON public.watched_episodes USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: watched_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watched_items ENABLE ROW LEVEL SECURITY;

--
-- Name: watched_items watched_items_select_profile_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watched_items_select_profile_visible ON public.watched_items FOR SELECT USING (((auth.uid() = user_id) OR public.profile_visible_to_viewer(user_id)));


--
-- Name: watched_items watched_items_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watched_items_self ON public.watched_items USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: watchlist_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watchlist_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: watchlist_alerts watchlist_alerts_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY watchlist_alerts_self ON public.watchlist_alerts USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: year_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.year_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: year_reviews year_reviews_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY year_reviews_public_read ON public.year_reviews FOR SELECT USING (is_public);


--
-- Name: year_reviews year_reviews_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY year_reviews_self ON public.year_reviews USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION accept_follow_request(p_request_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_follow_request(p_request_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_follow_request(p_request_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.accept_follow_request(p_request_id bigint) TO service_role;


--
-- Name: FUNCTION award_achievement(p_user_id uuid, p_achievement_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.award_achievement(p_user_id uuid, p_achievement_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.award_achievement(p_user_id uuid, p_achievement_id text) TO authenticated;
GRANT ALL ON FUNCTION public.award_achievement(p_user_id uuid, p_achievement_id text) TO service_role;


--
-- Name: FUNCTION backfill_watched_episodes_for_show(p_user_id uuid, p_show_id text, p_episodes jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.backfill_watched_episodes_for_show(p_user_id uuid, p_show_id text, p_episodes jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.backfill_watched_episodes_for_show(p_user_id uuid, p_show_id text, p_episodes jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.backfill_watched_episodes_for_show(p_user_id uuid, p_show_id text, p_episodes jsonb) TO service_role;


--
-- Name: FUNCTION block_user(p_blocked uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.block_user(p_blocked uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.block_user(p_blocked uuid) TO authenticated;
GRANT ALL ON FUNCTION public.block_user(p_blocked uuid) TO service_role;


--
-- Name: FUNCTION check_achievements(p_user_id uuid, p_action text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_achievements(p_user_id uuid, p_action text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_achievements(p_user_id uuid, p_action text) TO authenticated;
GRANT ALL ON FUNCTION public.check_achievements(p_user_id uuid, p_action text) TO service_role;


--
-- Name: FUNCTION cleanup_dm_notification(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_dm_notification() TO anon;
GRANT ALL ON FUNCTION public.cleanup_dm_notification() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_dm_notification() TO service_role;


--
-- Name: FUNCTION club_owner_on_create(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.club_owner_on_create() TO anon;
GRANT ALL ON FUNCTION public.club_owner_on_create() TO authenticated;
GRANT ALL ON FUNCTION public.club_owner_on_create() TO service_role;


--
-- Name: FUNCTION clubs_created_by_immutable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.clubs_created_by_immutable() TO anon;
GRANT ALL ON FUNCTION public.clubs_created_by_immutable() TO authenticated;
GRANT ALL ON FUNCTION public.clubs_created_by_immutable() TO service_role;


--
-- Name: FUNCTION conversation_list(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.conversation_list(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.conversation_list(p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.conversation_list(p_user uuid) TO service_role;


--
-- Name: FUNCTION decrement_favorites_count(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decrement_favorites_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decrement_favorites_count(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.decrement_favorites_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION decrement_watched_count(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decrement_watched_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decrement_watched_count(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.decrement_watched_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION decrement_watching_count(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decrement_watching_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decrement_watching_count(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.decrement_watching_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION decrement_watchlist_count(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decrement_watchlist_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decrement_watchlist_count(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.decrement_watchlist_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION ensure_user_cout_stats(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.ensure_user_cout_stats() TO anon;
GRANT ALL ON FUNCTION public.ensure_user_cout_stats() TO authenticated;
GRANT ALL ON FUNCTION public.ensure_user_cout_stats() TO service_role;


--
-- Name: FUNCTION get_user_stats(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_stats(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_stats(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_stats(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION increment_favorites_count(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_favorites_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_favorites_count(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_favorites_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION increment_watched_count(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_watched_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_watched_count(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_watched_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION increment_watching_count(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_watching_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_watching_count(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_watching_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION increment_watchlist_count(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_watchlist_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_watchlist_count(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_watchlist_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_blocked(p_viewer_id uuid, p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_blocked(p_viewer_id uuid, p_profile_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_blocked(p_viewer_id uuid, p_profile_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_blocked(p_viewer_id uuid, p_profile_id uuid) TO service_role;


--
-- Name: FUNCTION is_club_admin(p_club bigint, p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_club_admin(p_club bigint, p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.is_club_admin(p_club bigint, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_club_admin(p_club bigint, p_user uuid) TO service_role;


--
-- Name: FUNCTION is_club_member(p_club bigint, p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_club_member(p_club bigint, p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.is_club_member(p_club bigint, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_club_member(p_club bigint, p_user uuid) TO service_role;


--
-- Name: FUNCTION is_club_owner(p_club bigint, p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_club_owner(p_club bigint, p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.is_club_owner(p_club bigint, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_club_owner(p_club bigint, p_user uuid) TO service_role;


--
-- Name: FUNCTION is_list_editor(p_list bigint, p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_list_editor(p_list bigint, p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.is_list_editor(p_list bigint, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_list_editor(p_list bigint, p_user uuid) TO service_role;


--
-- Name: FUNCTION is_session_participant(p_session bigint, p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_session_participant(p_session bigint, p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.is_session_participant(p_session bigint, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_session_participant(p_session bigint, p_user uuid) TO service_role;


--
-- Name: FUNCTION log_list_created_activity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_list_created_activity() TO anon;
GRANT ALL ON FUNCTION public.log_list_created_activity() TO authenticated;
GRANT ALL ON FUNCTION public.log_list_created_activity() TO service_role;


--
-- Name: FUNCTION log_rated_activity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_rated_activity() TO anon;
GRANT ALL ON FUNCTION public.log_rated_activity() TO authenticated;
GRANT ALL ON FUNCTION public.log_rated_activity() TO service_role;


--
-- Name: FUNCTION log_reviewed_activity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_reviewed_activity() TO anon;
GRANT ALL ON FUNCTION public.log_reviewed_activity() TO authenticated;
GRANT ALL ON FUNCTION public.log_reviewed_activity() TO service_role;


--
-- Name: FUNCTION log_watched_activity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_watched_activity() TO anon;
GRANT ALL ON FUNCTION public.log_watched_activity() TO authenticated;
GRANT ALL ON FUNCTION public.log_watched_activity() TO service_role;


--
-- Name: FUNCTION my_diary_notes(p_item_ids text[], p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_diary_notes(p_item_ids text[], p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_diary_notes(p_item_ids text[], p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.my_diary_notes(p_item_ids text[], p_limit integer) TO service_role;


--
-- Name: FUNCTION notify_comment_reply(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_comment_reply() TO anon;
GRANT ALL ON FUNCTION public.notify_comment_reply() TO authenticated;
GRANT ALL ON FUNCTION public.notify_comment_reply() TO service_role;


--
-- Name: FUNCTION notify_dm_received(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_dm_received() TO anon;
GRANT ALL ON FUNCTION public.notify_dm_received() TO authenticated;
GRANT ALL ON FUNCTION public.notify_dm_received() TO service_role;


--
-- Name: FUNCTION notify_follow_accepted(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_follow_accepted() TO anon;
GRANT ALL ON FUNCTION public.notify_follow_accepted() TO authenticated;
GRANT ALL ON FUNCTION public.notify_follow_accepted() TO service_role;


--
-- Name: FUNCTION notify_follow_request(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_follow_request() TO anon;
GRANT ALL ON FUNCTION public.notify_follow_request() TO authenticated;
GRANT ALL ON FUNCTION public.notify_follow_request() TO service_role;


--
-- Name: FUNCTION notify_friend_watched(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_friend_watched() TO anon;
GRANT ALL ON FUNCTION public.notify_friend_watched() TO authenticated;
GRANT ALL ON FUNCTION public.notify_friend_watched() TO service_role;


--
-- Name: FUNCTION notify_like(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_like() TO anon;
GRANT ALL ON FUNCTION public.notify_like() TO authenticated;
GRANT ALL ON FUNCTION public.notify_like() TO service_role;


--
-- Name: FUNCTION notify_new_follower(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_new_follower() TO anon;
GRANT ALL ON FUNCTION public.notify_new_follower() TO authenticated;
GRANT ALL ON FUNCTION public.notify_new_follower() TO service_role;


--
-- Name: FUNCTION notify_reaction(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_reaction() TO anon;
GRANT ALL ON FUNCTION public.notify_reaction() TO authenticated;
GRANT ALL ON FUNCTION public.notify_reaction() TO service_role;


--
-- Name: FUNCTION notify_started_watching(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_started_watching() TO anon;
GRANT ALL ON FUNCTION public.notify_started_watching() TO authenticated;
GRANT ALL ON FUNCTION public.notify_started_watching() TO service_role;


--
-- Name: FUNCTION notify_wave(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_wave() TO anon;
GRANT ALL ON FUNCTION public.notify_wave() TO authenticated;
GRANT ALL ON FUNCTION public.notify_wave() TO service_role;


--
-- Name: FUNCTION owns_import_job(p_job bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.owns_import_job(p_job bigint) TO anon;
GRANT ALL ON FUNCTION public.owns_import_job(p_job bigint) TO authenticated;
GRANT ALL ON FUNCTION public.owns_import_job(p_job bigint) TO service_role;


--
-- Name: FUNCTION popular_reviews(p_days integer, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.popular_reviews(p_days integer, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.popular_reviews(p_days integer, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.popular_reviews(p_days integer, p_limit integer) TO service_role;


--
-- Name: FUNCTION profile_visible_to_viewer(owner_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.profile_visible_to_viewer(owner_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.profile_visible_to_viewer(owner_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.profile_visible_to_viewer(owner_user_id uuid) TO service_role;


--
-- Name: FUNCTION record_rewatch(p_user_id uuid, p_item_id text, p_item_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_rewatch(p_user_id uuid, p_item_id text, p_item_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_rewatch(p_user_id uuid, p_item_id text, p_item_type text) TO authenticated;
GRANT ALL ON FUNCTION public.record_rewatch(p_user_id uuid, p_item_id text, p_item_type text) TO service_role;


--
-- Name: FUNCTION recount_user_stats(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recount_user_stats(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recount_user_stats(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recount_user_stats(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION related_by_audience(p_item_id text, p_item_type text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.related_by_audience(p_item_id text, p_item_type text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.related_by_audience(p_item_id text, p_item_type text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.related_by_audience(p_item_id text, p_item_type text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.related_by_audience(p_item_id text, p_item_type text, p_limit integer) TO service_role;


--
-- Name: FUNCTION remove_watched_activity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.remove_watched_activity() TO anon;
GRANT ALL ON FUNCTION public.remove_watched_activity() TO authenticated;
GRANT ALL ON FUNCTION public.remove_watched_activity() TO service_role;


--
-- Name: FUNCTION reviews_for_title(p_item_id text, p_item_type text, p_viewer uuid, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reviews_for_title(p_item_id text, p_item_type text, p_viewer uuid, p_limit integer, p_offset integer) TO anon;
GRANT ALL ON FUNCTION public.reviews_for_title(p_item_id text, p_item_type text, p_viewer uuid, p_limit integer, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.reviews_for_title(p_item_id text, p_item_type text, p_viewer uuid, p_limit integer, p_offset integer) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION sync_club_member_count(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_club_member_count() TO anon;
GRANT ALL ON FUNCTION public.sync_club_member_count() TO authenticated;
GRANT ALL ON FUNCTION public.sync_club_member_count() TO service_role;


--
-- Name: FUNCTION sync_user_stats(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_user_stats() TO anon;
GRANT ALL ON FUNCTION public.sync_user_stats() TO authenticated;
GRANT ALL ON FUNCTION public.sync_user_stats() TO service_role;


--
-- Name: FUNCTION taste_compatibility(p_a uuid, p_b uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.taste_compatibility(p_a uuid, p_b uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.taste_compatibility(p_a uuid, p_b uuid) TO authenticated;
GRANT ALL ON FUNCTION public.taste_compatibility(p_a uuid, p_b uuid) TO service_role;


--
-- Name: FUNCTION taste_matches(p_user uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.taste_matches(p_user uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.taste_matches(p_user uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.taste_matches(p_user uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION title_audience(p_item_id text, p_item_type text, p_viewer uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.title_audience(p_item_id text, p_item_type text, p_viewer uuid) TO anon;
GRANT ALL ON FUNCTION public.title_audience(p_item_id text, p_item_type text, p_viewer uuid) TO authenticated;
GRANT ALL ON FUNCTION public.title_audience(p_item_id text, p_item_type text, p_viewer uuid) TO service_role;


--
-- Name: FUNCTION title_rating_histogram(p_item_id text, p_item_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.title_rating_histogram(p_item_id text, p_item_type text) TO anon;
GRANT ALL ON FUNCTION public.title_rating_histogram(p_item_id text, p_item_type text) TO authenticated;
GRANT ALL ON FUNCTION public.title_rating_histogram(p_item_id text, p_item_type text) TO service_role;


--
-- Name: TABLE achievements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.achievements TO anon;
GRANT ALL ON TABLE public.achievements TO authenticated;
GRANT ALL ON TABLE public.achievements TO service_role;


--
-- Name: TABLE background_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.background_jobs TO anon;
GRANT ALL ON TABLE public.background_jobs TO authenticated;
GRANT ALL ON TABLE public.background_jobs TO service_role;


--
-- Name: SEQUENCE background_jobs_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.background_jobs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.background_jobs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.background_jobs_id_seq TO service_role;


--
-- Name: TABLE club_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.club_members TO anon;
GRANT ALL ON TABLE public.club_members TO authenticated;
GRANT ALL ON TABLE public.club_members TO service_role;


--
-- Name: TABLE club_picks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.club_picks TO anon;
GRANT ALL ON TABLE public.club_picks TO authenticated;
GRANT ALL ON TABLE public.club_picks TO service_role;


--
-- Name: SEQUENCE club_picks_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.club_picks_id_seq TO anon;
GRANT ALL ON SEQUENCE public.club_picks_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.club_picks_id_seq TO service_role;


--
-- Name: TABLE clubs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clubs TO anon;
GRANT ALL ON TABLE public.clubs TO authenticated;
GRANT ALL ON TABLE public.clubs TO service_role;


--
-- Name: SEQUENCE clubs_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.clubs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.clubs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.clubs_id_seq TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comments TO anon;
GRANT ALL ON TABLE public.comments TO authenticated;
GRANT ALL ON TABLE public.comments TO service_role;


--
-- Name: SEQUENCE comments_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.comments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.comments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.comments_id_seq TO service_role;


--
-- Name: TABLE episode_ratings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.episode_ratings TO anon;
GRANT ALL ON TABLE public.episode_ratings TO authenticated;
GRANT ALL ON TABLE public.episode_ratings TO service_role;


--
-- Name: TABLE favorite_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.favorite_items TO anon;
GRANT ALL ON TABLE public.favorite_items TO authenticated;
GRANT ALL ON TABLE public.favorite_items TO service_role;


--
-- Name: SEQUENCE favorite_items_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.favorite_items_id_seq TO anon;
GRANT ALL ON SEQUENCE public.favorite_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.favorite_items_id_seq TO service_role;


--
-- Name: TABLE import_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.import_jobs TO anon;
GRANT ALL ON TABLE public.import_jobs TO authenticated;
GRANT ALL ON TABLE public.import_jobs TO service_role;


--
-- Name: SEQUENCE import_jobs_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.import_jobs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.import_jobs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.import_jobs_id_seq TO service_role;


--
-- Name: TABLE import_rows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.import_rows TO anon;
GRANT ALL ON TABLE public.import_rows TO authenticated;
GRANT ALL ON TABLE public.import_rows TO service_role;


--
-- Name: SEQUENCE import_rows_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.import_rows_id_seq TO anon;
GRANT ALL ON SEQUENCE public.import_rows_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.import_rows_id_seq TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: SEQUENCE notifications_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.notifications_id_seq TO anon;
GRANT ALL ON SEQUENCE public.notifications_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.notifications_id_seq TO service_role;


--
-- Name: TABLE notified_episodes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notified_episodes TO anon;
GRANT ALL ON TABLE public.notified_episodes TO authenticated;
GRANT ALL ON TABLE public.notified_episodes TO service_role;


--
-- Name: TABLE reactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reactions TO anon;
GRANT ALL ON TABLE public.reactions TO authenticated;
GRANT ALL ON TABLE public.reactions TO service_role;


--
-- Name: SEQUENCE reactions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.reactions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.reactions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.reactions_id_seq TO service_role;


--
-- Name: TABLE recommendation; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recommendation TO anon;
GRANT ALL ON TABLE public.recommendation TO authenticated;
GRANT ALL ON TABLE public.recommendation TO service_role;


--
-- Name: SEQUENCE recommendation_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.recommendation_id_seq TO anon;
GRANT ALL ON SEQUENCE public.recommendation_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.recommendation_id_seq TO service_role;


--
-- Name: TABLE season_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.season_reviews TO anon;
GRANT ALL ON TABLE public.season_reviews TO authenticated;
GRANT ALL ON TABLE public.season_reviews TO service_role;


--
-- Name: TABLE takes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.takes TO anon;
GRANT ALL ON TABLE public.takes TO authenticated;
GRANT ALL ON TABLE public.takes TO service_role;


--
-- Name: TABLE user_achievements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_achievements TO anon;
GRANT ALL ON TABLE public.user_achievements TO authenticated;
GRANT ALL ON TABLE public.user_achievements TO service_role;


--
-- Name: TABLE user_activity; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_activity TO anon;
GRANT ALL ON TABLE public.user_activity TO authenticated;
GRANT ALL ON TABLE public.user_activity TO service_role;


--
-- Name: SEQUENCE user_activity_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_activity_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_activity_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_activity_id_seq TO service_role;


--
-- Name: TABLE user_blocks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_blocks TO anon;
GRANT ALL ON TABLE public.user_blocks TO authenticated;
GRANT ALL ON TABLE public.user_blocks TO service_role;


--
-- Name: SEQUENCE user_blocks_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_blocks_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_blocks_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_blocks_id_seq TO service_role;


--
-- Name: TABLE user_connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_connections TO anon;
GRANT ALL ON TABLE public.user_connections TO authenticated;
GRANT ALL ON TABLE public.user_connections TO service_role;


--
-- Name: SEQUENCE user_connections_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_connections_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_connections_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_connections_id_seq TO service_role;


--
-- Name: TABLE user_cout_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_cout_stats TO anon;
GRANT ALL ON TABLE public.user_cout_stats TO authenticated;
GRANT ALL ON TABLE public.user_cout_stats TO service_role;


--
-- Name: TABLE user_favorite_display; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_favorite_display TO anon;
GRANT ALL ON TABLE public.user_favorite_display TO authenticated;
GRANT ALL ON TABLE public.user_favorite_display TO service_role;


--
-- Name: TABLE user_follow_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_follow_requests TO anon;
GRANT ALL ON TABLE public.user_follow_requests TO authenticated;
GRANT ALL ON TABLE public.user_follow_requests TO service_role;


--
-- Name: SEQUENCE user_follow_requests_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_follow_requests_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_follow_requests_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_follow_requests_id_seq TO service_role;


--
-- Name: TABLE user_list_collaborators; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_list_collaborators TO anon;
GRANT ALL ON TABLE public.user_list_collaborators TO authenticated;
GRANT ALL ON TABLE public.user_list_collaborators TO service_role;


--
-- Name: TABLE user_list_follows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_list_follows TO anon;
GRANT ALL ON TABLE public.user_list_follows TO authenticated;
GRANT ALL ON TABLE public.user_list_follows TO service_role;


--
-- Name: TABLE user_list_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_list_items TO anon;
GRANT ALL ON TABLE public.user_list_items TO authenticated;
GRANT ALL ON TABLE public.user_list_items TO service_role;


--
-- Name: SEQUENCE user_list_items_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_list_items_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_list_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_list_items_id_seq TO service_role;


--
-- Name: TABLE user_lists; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_lists TO anon;
GRANT ALL ON TABLE public.user_lists TO authenticated;
GRANT ALL ON TABLE public.user_lists TO service_role;


--
-- Name: SEQUENCE user_lists_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_lists_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_lists_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_lists_id_seq TO service_role;


--
-- Name: TABLE user_media_status; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_media_status TO anon;
GRANT ALL ON TABLE public.user_media_status TO authenticated;
GRANT ALL ON TABLE public.user_media_status TO service_role;


--
-- Name: TABLE user_notification_prefs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_notification_prefs TO anon;
GRANT ALL ON TABLE public.user_notification_prefs TO authenticated;
GRANT ALL ON TABLE public.user_notification_prefs TO service_role;


--
-- Name: TABLE user_providers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_providers TO anon;
GRANT ALL ON TABLE public.user_providers TO authenticated;
GRANT ALL ON TABLE public.user_providers TO service_role;


--
-- Name: TABLE user_ratings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_ratings TO anon;
GRANT ALL ON TABLE public.user_ratings TO authenticated;
GRANT ALL ON TABLE public.user_ratings TO service_role;


--
-- Name: SEQUENCE user_ratings_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_ratings_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_ratings_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_ratings_id_seq TO service_role;


--
-- Name: TABLE user_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_reports TO anon;
GRANT ALL ON TABLE public.user_reports TO authenticated;
GRANT ALL ON TABLE public.user_reports TO service_role;


--
-- Name: SEQUENCE user_reports_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_reports_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_reports_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_reports_id_seq TO service_role;


--
-- Name: TABLE user_title_affinity; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_title_affinity TO service_role;


--
-- Name: TABLE user_waves; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_waves TO anon;
GRANT ALL ON TABLE public.user_waves TO authenticated;
GRANT ALL ON TABLE public.user_waves TO service_role;


--
-- Name: SEQUENCE user_waves_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_waves_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_waves_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_waves_id_seq TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.users TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: COLUMN users.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.users TO anon;
GRANT SELECT(id) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.username; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(username) ON TABLE public.users TO anon;
GRANT SELECT(username) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.about; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(about) ON TABLE public.users TO anon;
GRANT SELECT(about) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.visibility; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(visibility) ON TABLE public.users TO anon;
GRANT SELECT(visibility) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.users TO anon;
GRANT SELECT(created_at) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.users TO anon;
GRANT SELECT(updated_at) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(avatar_url) ON TABLE public.users TO anon;
GRANT SELECT(avatar_url) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.banner_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(banner_url) ON TABLE public.users TO anon;
GRANT SELECT(banner_url) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.tagline; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(tagline) ON TABLE public.users TO anon;
GRANT SELECT(tagline) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.featured_list_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(featured_list_id) ON TABLE public.users TO anon;
GRANT SELECT(featured_list_id) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.pinned_review_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pinned_review_id) ON TABLE public.users TO anon;
GRANT SELECT(pinned_review_id) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.profile_show_diary; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(profile_show_diary) ON TABLE public.users TO anon;
GRANT SELECT(profile_show_diary) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.profile_show_ratings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(profile_show_ratings) ON TABLE public.users TO anon;
GRANT SELECT(profile_show_ratings) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.profile_show_public_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(profile_show_public_reviews) ON TABLE public.users TO anon;
GRANT SELECT(profile_show_public_reviews) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.default_tv_status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(default_tv_status) ON TABLE public.users TO anon;
GRANT SELECT(default_tv_status) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.deleted_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(deleted_at) ON TABLE public.users TO anon;
GRANT SELECT(deleted_at) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.deletion_scheduled_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(deletion_scheduled_at) ON TABLE public.users TO anon;
GRANT SELECT(deletion_scheduled_at) ON TABLE public.users TO authenticated;


--
-- Name: COLUMN users.watch_region; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(watch_region) ON TABLE public.users TO anon;
GRANT SELECT(watch_region) ON TABLE public.users TO authenticated;


--
-- Name: TABLE watch_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.watch_history TO anon;
GRANT ALL ON TABLE public.watch_history TO authenticated;
GRANT ALL ON TABLE public.watch_history TO service_role;


--
-- Name: SEQUENCE watch_history_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.watch_history_id_seq TO anon;
GRANT ALL ON SEQUENCE public.watch_history_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.watch_history_id_seq TO service_role;


--
-- Name: TABLE watch_session_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.watch_session_participants TO anon;
GRANT ALL ON TABLE public.watch_session_participants TO authenticated;
GRANT ALL ON TABLE public.watch_session_participants TO service_role;


--
-- Name: TABLE watch_session_votes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.watch_session_votes TO anon;
GRANT ALL ON TABLE public.watch_session_votes TO authenticated;
GRANT ALL ON TABLE public.watch_session_votes TO service_role;


--
-- Name: TABLE watch_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.watch_sessions TO anon;
GRANT ALL ON TABLE public.watch_sessions TO authenticated;
GRANT ALL ON TABLE public.watch_sessions TO service_role;


--
-- Name: SEQUENCE watch_sessions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.watch_sessions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.watch_sessions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.watch_sessions_id_seq TO service_role;


--
-- Name: TABLE watched_episodes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.watched_episodes TO anon;
GRANT ALL ON TABLE public.watched_episodes TO authenticated;
GRANT ALL ON TABLE public.watched_episodes TO service_role;


--
-- Name: SEQUENCE watched_episodes_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.watched_episodes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.watched_episodes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.watched_episodes_id_seq TO service_role;


--
-- Name: TABLE watched_items; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.watched_items TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.watched_items TO authenticated;
GRANT ALL ON TABLE public.watched_items TO service_role;


--
-- Name: COLUMN watched_items.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.watched_items TO anon;
GRANT SELECT(id) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(user_id) ON TABLE public.watched_items TO anon;
GRANT SELECT(user_id) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.item_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(item_id) ON TABLE public.watched_items TO anon;
GRANT SELECT(item_id) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.item_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(item_name) ON TABLE public.watched_items TO anon;
GRANT SELECT(item_name) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.item_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(item_type) ON TABLE public.watched_items TO anon;
GRANT SELECT(item_type) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.image_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(image_url) ON TABLE public.watched_items TO anon;
GRANT SELECT(image_url) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.item_adult; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(item_adult) ON TABLE public.watched_items TO anon;
GRANT SELECT(item_adult) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.genres; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(genres) ON TABLE public.watched_items TO anon;
GRANT SELECT(genres) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.watched_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(watched_at) ON TABLE public.watched_items TO anon;
GRANT SELECT(watched_at) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.public_review_text; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(public_review_text) ON TABLE public.watched_items TO anon;
GRANT SELECT(public_review_text) ON TABLE public.watched_items TO authenticated;


--
-- Name: COLUMN watched_items.is_watched; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_watched) ON TABLE public.watched_items TO anon;
GRANT SELECT(is_watched) ON TABLE public.watched_items TO authenticated;


--
-- Name: SEQUENCE watched_items_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.watched_items_id_seq TO anon;
GRANT ALL ON SEQUENCE public.watched_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.watched_items_id_seq TO service_role;


--
-- Name: TABLE watchlist_alerts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.watchlist_alerts TO anon;
GRANT ALL ON TABLE public.watchlist_alerts TO authenticated;
GRANT ALL ON TABLE public.watchlist_alerts TO service_role;


--
-- Name: SEQUENCE watchlist_alerts_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.watchlist_alerts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.watchlist_alerts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.watchlist_alerts_id_seq TO service_role;


--
-- Name: TABLE year_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.year_reviews TO anon;
GRANT ALL ON TABLE public.year_reviews TO authenticated;
GRANT ALL ON TABLE public.year_reviews TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


