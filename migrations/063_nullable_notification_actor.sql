-- 063_nullable_notification_actor.sql
-- Let a notification have no actor.
--
-- Every notification type before 061 was one person doing something to
-- another, so `actor_id uuid not null` (027) was a fair constraint. 'new_episode'
-- is the first that isn't: nobody *did* anything, a show aired. The notifier
-- inserts actor_id => null accordingly — and every one of those inserts would
-- have been rejected, silently, inside a fire-and-forget cron job where the
-- only trace is a console line nobody reads.
--
-- Caught by probing the constraint from 061 with a deliberately failing insert
-- and getting 23502 (not-null) instead of the expected 23503 (foreign key).
--
-- Reads are already safe: /api/notifications selects the actor as an embedded
-- left join rather than !inner, so a null-actor row still comes back, and the
-- page falls back to "Someone" for text that needs a name. The 'new_episode'
-- case doesn't reference the actor at all.

begin;

alter table public.notifications
  alter column actor_id drop not null;

comment on column public.notifications.actor_id is
  'The user who caused this notification. NULL for system notifications such as new_episode, where nobody acted.';

commit;
