-- 119_leaving_takes_only_what_was_yours.sql
--
-- What happens to everyone else when someone deletes their account.
--
-- Deleting sets users.deleted_at; for 30 days the account can come back, and
-- RLS already hides the row from everyone but its owner (082). Then the purge
-- (api/cron/purge-deleted) deletes the auth user, and every table keyed on the
-- user cascades. That cascade was written table by table for the person
-- leaving, and in four places it took other people's things with it:
--
--   1. A group (clubs) was deleted with whoever created it — every member's
--      group gone because one person left. Now it passes to the member who's
--      been there longest (a moderator first); only a group with nobody else
--      in it closes.
--   2. A comment thread lost every reply under a deleted comment
--      (comments.parent_id cascades). Now a comment that others replied to
--      stays as an empty "deleted" marker with no author, so the replies keep
--      their place; one nobody answered is simply removed.
--   3. A report about someone vanished when the person who made it left.
--      Now the report stays, without its reporter.
--   4. Messages, follows, follow requests and passes could still be sent to
--      an account in its 30 days — into a void, since it's signed out and
--      hidden. Now nothing new can reach an account that has gone, and an
--      account that has gone can't send anything either (a token lives an
--      hour after signing out).
--   5. A list someone else helps keep was deleted with its owner, entries
--      and all. Now it passes to the collaborator who joined it first; and
--      while the owner is in their 30 days, their public lists are hidden
--      from everyone but those collaborators.
--   6. A Tonight session went with whoever started it. Now it passes to the
--      next person in it.
--
-- Closing an account is now one function (close_my_account): it checks a row
-- was actually closed (the route reported success on zero rows), and marks
-- what the person sent as read — it can't be opened now, and an unread dot
-- would otherwise sit on the other person's People tab for a month.
--
-- abandoned_signups lists sign-ups that never confirmed their email and never
-- chose a username, a month on, for the purge to remove; until now nothing
-- could.
--
-- What still goes with the account at the purge, deliberately: their diary,
-- ratings, lists, favourites and words; follows both ways; passes both ways;
-- their place in other people's "who was there"; and conversations with them
-- (a conversation between two people, one of whom asked to be forgotten). The
-- person still here is told on the conversation, for those 30 days, when it
-- will go (RoomClient).

BEGIN;

-- ── Who has gone ──────────────────────────────────────────────────────────
-- True for an account that's deleted (or deleting), or has no profile at all.
-- Definer, because RLS hides a deleted row from the very people asking.
CREATE OR REPLACE FUNCTION public.is_gone(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user AND u.deleted_at IS NULL);
$$;

REVOKE ALL ON FUNCTION public.is_gone(uuid) FROM PUBLIC;
-- anon too: the list policies below run for signed-out readers of a public list.
GRANT EXECUTE ON FUNCTION public.is_gone(uuid) TO anon, authenticated, service_role;

-- ── 4. Nothing new reaches someone who has gone ───────────────────────────
ALTER POLICY messages_insert_sender ON public.messages
  WITH CHECK ((auth.uid() = sender_id) AND (NOT public.is_blocked(sender_id, recipient_id)) AND (NOT public.is_gone(recipient_id)) AND (NOT public.is_gone(sender_id)));

ALTER POLICY user_follow_requests_insert_sender ON public.user_follow_requests
  WITH CHECK ((auth.uid() = sender_id) AND (NOT public.is_blocked(sender_id, receiver_id)) AND (NOT public.is_gone(receiver_id)) AND (NOT public.is_gone(sender_id)));

ALTER POLICY user_connections_insert_self ON public.user_connections
  WITH CHECK ((auth.uid() = follower_id) AND (NOT public.is_blocked(follower_id, followed_id)) AND public.profile_is_public(followed_id) AND (NOT public.is_gone(followed_id)) AND (NOT public.is_gone(follower_id)));

ALTER POLICY title_recommendations_insert_party ON public.title_recommendations
  WITH CHECK (
    (NOT public.is_blocked(from_user_id, to_user_id))
    AND (NOT public.is_gone(from_user_id))
    AND (NOT public.is_gone(to_user_id))
    AND ((auth.uid() = from_user_id) OR ((auth.uid() = to_user_id) AND (EXISTS (
      SELECT 1 FROM public.user_connections c
       WHERE ((c.follower_id = title_recommendations.to_user_id) AND (c.followed_id = title_recommendations.from_user_id))
          OR ((c.follower_id = title_recommendations.from_user_id) AND (c.followed_id = title_recommendations.to_user_id))))))
  );

-- ── 5. Lists: hidden with their owner, kept for their collaborators ───────
ALTER POLICY user_lists_select_public ON public.user_lists
  USING ((visibility = 'public'::visibility_level) AND (NOT public.is_gone(user_id)));

ALTER POLICY user_lists_select_collaborator ON public.user_lists
  USING (
    ((visibility = 'public'::visibility_level) AND (NOT public.is_gone(user_id)))
    OR (auth.uid() = user_id)
    OR (EXISTS (SELECT 1 FROM public.user_list_collaborators c WHERE c.list_id = user_lists.id AND c.user_id = auth.uid()))
  );

ALTER POLICY user_lists_select_followers ON public.user_lists
  USING ((visibility = 'followers'::visibility_level) AND (NOT public.is_gone(user_id))
         AND (user_id IN (SELECT user_connections.followed_id FROM public.user_connections WHERE user_connections.follower_id = auth.uid())));

-- ── 2. Replies outlive the comment they answered ──────────────────────────
ALTER TABLE public.comments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_body_check;
ALTER TABLE public.comments ADD CONSTRAINT comments_body_check
  CHECK ((user_id IS NULL AND char_length(body) = 0) OR (char_length(body) BETWEEN 1 AND 2000));
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- ── 3. A report outlives its reporter ─────────────────────────────────────
ALTER TABLE public.user_reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_reporter_id_fkey;
ALTER TABLE public.user_reports ADD CONSTRAINT user_reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- ── 1. A group outlives whoever made it ───────────────────────────────────
-- created_by stays immutable to everyone (083: nobody can seize a group),
-- except the handover below, which marks itself for this transaction only.
CREATE OR REPLACE FUNCTION public.clubs_created_by_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     AND current_setting('letsee.handover', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'created_by cannot be changed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;

-- ── The departure itself ──────────────────────────────────────────────────
-- Runs as the profile row is deleted (the purge deletes the auth user, which
-- cascades here), before the cascade reaches anything else.
CREATE OR REPLACE FUNCTION public.on_user_leaving()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_club bigint;
  v_list bigint;
  v_heir uuid;
BEGIN
  -- Comments: what they wrote goes; a reply thread keeps its shape.
  DELETE FROM public.comments cm
   WHERE cm.user_id = OLD.id
     AND NOT EXISTS (SELECT 1 FROM public.comments r WHERE r.parent_id = cm.id);
  UPDATE public.comments SET body = '', user_id = NULL WHERE user_id = OLD.id;

  -- Groups they made: to the longest-standing member, a moderator first.
  PERFORM set_config('letsee.handover', 'on', true);
  FOR v_club IN SELECT id FROM public.clubs WHERE created_by = OLD.id LOOP
    SELECT m.user_id INTO v_heir
      FROM public.club_members m
     WHERE m.club_id = v_club AND m.user_id <> OLD.id AND m.status = 'active'
     ORDER BY (m.role = 'moderator') DESC, m.joined_at ASC
     LIMIT 1;
    IF v_heir IS NULL THEN
      DELETE FROM public.clubs WHERE id = v_club;
    ELSE
      UPDATE public.clubs SET created_by = v_heir WHERE id = v_club;
      UPDATE public.club_members SET role = 'owner' WHERE club_id = v_club AND user_id = v_heir;
    END IF;
  END LOOP;
  PERFORM set_config('letsee.handover', 'off', true);

  -- Lists others help keep: to the collaborator who joined first, who stops
  -- being a collaborator on what is now theirs.
  FOR v_list, v_heir IN
    SELECT DISTINCT ON (c.list_id) c.list_id, c.user_id
      FROM public.user_list_collaborators c
      JOIN public.user_lists l ON l.id = c.list_id AND l.user_id = OLD.id
     WHERE c.user_id <> OLD.id
     ORDER BY c.list_id, c.created_at ASC
  LOOP
    UPDATE public.user_lists SET user_id = v_heir WHERE id = v_list;
    DELETE FROM public.user_list_collaborators WHERE list_id = v_list AND user_id = v_heir;
  END LOOP;

  -- Tonight sessions with other people in them: to whoever joined next.
  UPDATE public.watch_sessions s
     SET created_by = h.heir
    FROM (
      SELECT DISTINCT ON (p.session_id) p.session_id, p.user_id AS heir
        FROM public.watch_session_participants p
        JOIN public.watch_sessions s2 ON s2.id = p.session_id AND s2.created_by = OLD.id
       WHERE p.user_id <> OLD.id
       ORDER BY p.session_id, p.joined_at ASC
    ) h
   WHERE s.id = h.session_id;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.on_user_leaving() FROM PUBLIC;

DROP TRIGGER IF EXISTS users_leaving ON public.users;
CREATE TRIGGER users_leaving
  BEFORE DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.on_user_leaving();

-- ── Closing an account ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_my_account()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_when timestamptz := now() + interval '30 days';
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'You have to be signed in.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.users
     SET deleted_at = now(), deletion_scheduled_at = v_when
   WHERE id = v_me AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no open account to close.' USING ERRCODE = 'no_data_found';
  END IF;
  UPDATE public.messages SET is_read = true WHERE sender_id = v_me AND NOT is_read;
  RETURN v_when;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_my_account() TO authenticated;

-- ── Sign-ups nobody finished ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.abandoned_signups(p_days integer DEFAULT 30, p_limit integer DEFAULT 25)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $function$
  SELECT u.id
    FROM auth.users u
   WHERE u.email_confirmed_at IS NULL
     AND u.last_sign_in_at IS NULL
     AND coalesce(u.confirmation_sent_at, u.created_at) < now() - make_interval(days => greatest(p_days, 7))
     -- No profile, or one never given a name: nothing was made here.
     AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id AND p.username IS NOT NULL)
   ORDER BY u.created_at
   LIMIT least(greatest(p_limit, 1), 100);
$function$;

REVOKE ALL ON FUNCTION public.abandoned_signups(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abandoned_signups(integer, integer) TO service_role;

COMMIT;
