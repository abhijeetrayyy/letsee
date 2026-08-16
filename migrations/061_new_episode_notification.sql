-- 061_new_episode_notification.sql
-- "There's a new episode of something you're watching."
--
-- The one notification in this app that is genuinely useful rather than
-- merely social: it tells you about something that happened in the world,
-- not about something another user did to your profile.
--
-- Two supporting pieces:
--
--   1. A new notification_type. Same drop-and-recreate dance as 041/047,
--      minus the ones the product no longer has — 'wave' and
--      'achievement_unlocked' stay in the constraint so existing rows remain
--      valid (the notifications page still renders them; see its comment),
--      but nothing creates them any more.
--
--   2. `notified_episodes`, so a daily job can be honest about what it has
--      already announced. Without it, every run re-notifies every show with a
--      recent episode, and the feature becomes the reason people turn
--      notifications off.

begin;

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type = any (array[
    'follow_request', 'follow_accepted', 'like', 'friend_watched',
    'friend_reviewed', 'friend_rated', 'comment_reply', 'dm_received',
    'new_follower', 'friend_started_watching', 'achievement_unlocked',
    'wave', 'new_episode'
  ]));

create table if not exists public.notified_episodes (
  user_id        uuid not null references public.users(id) on delete cascade,
  show_id        text not null,
  season_number  integer not null,
  episode_number integer not null,
  notified_at    timestamptz not null default now(),
  primary key (user_id, show_id, season_number, episode_number)
);

create index if not exists notified_episodes_user_idx
  on public.notified_episodes (user_id, notified_at desc);

alter table public.notified_episodes enable row level security;

-- Written by the cron job through the service role, read by nobody but the
-- job. Users never query this; it exists purely as the job's memory.
drop policy if exists "notified_episodes_self_read" on public.notified_episodes;
create policy "notified_episodes_self_read"
  on public.notified_episodes
  for select
  using (auth.uid() = user_id);

commit;
