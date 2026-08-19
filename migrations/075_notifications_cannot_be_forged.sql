-- 075_notifications_cannot_be_forged.sql
-- Anyone could write into anyone's notification bell, as anyone.
--
-- 027:32-34 reads:
--   -- RLS: system can insert notifications (via service role or triggers)
--   create policy "notifications_insert_service" on public.notifications
--     for insert with check (true);
--
-- Both justifications in that comment defeat the policy. service_role bypasses
-- RLS entirely, so it never needed a policy. Every notification trigger in this
-- schema — notify_follow_request, notify_comment_reply, notify_reaction,
-- notify_wave, award_achievement — is SECURITY DEFINER, so they never needed
-- one either. The policy's only effect was to grant INSERT to `anon` and
-- `authenticated`.
--
-- The table is shaped to make a forgery convincing: user_id says whose bell it
-- lands in, actor_id says who supposedly did it, and /api/notifications hydrates
-- actor_id through `actor:users!actor_id(username, avatar_url)` and renders the
-- row as-is. Both uuids are trivially harvested because users_select_public is
-- USING (true). So one POST to /rest/v1/notifications produces a follow request,
-- a like, or a comment reply attributed to a real named person who never sent
-- it — indistinguishable from a genuine one in the UI — and nothing bounds how
-- many.
--
-- The one place application code inserts here is
-- src/utils/jobs/newEpisodeNotifier.ts:129, which runs on createAdminClient()
-- (service_role, migration path verified) and is unaffected by RLS.
--
-- Idempotent: drop if exists.

BEGIN;

DROP POLICY IF EXISTS "notifications_insert_service" ON public.notifications;

COMMIT;
