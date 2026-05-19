begin;

create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'follow_request',
    'follow_accepted',
    'like',
    'friend_watched',
    'friend_reviewed',
    'friend_rated'
  )),
  actor_id uuid not null references public.users(id) on delete cascade,
  target_type text,
  target_id bigint,
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx on public.notifications (user_id, is_read) where not is_read;
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists notifications_user_all_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- RLS: users can only see their own notifications
create policy "notifications_select_self" on public.notifications
  for select using (auth.uid() = user_id);

-- RLS: system can insert notifications (via service role or triggers)
create policy "notifications_insert_service" on public.notifications
  for insert with check (true);

-- RLS: users can mark their own notifications as read
create policy "notifications_update_self" on public.notifications
  for update using (auth.uid() = user_id);

-- RLS: users can delete their own notifications
create policy "notifications_delete_self" on public.notifications
  for delete using (auth.uid() = user_id);

-- Trigger: create notification when a follow request is sent
create or replace function public.notify_follow_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, notification_type, actor_id, metadata, created_at)
  values (new.receiver_id, 'follow_request', new.sender_id,
    jsonb_build_object('status', new.status),
    new.created_at);
  return new;
end;
$$;

create trigger trg_notify_follow_request
after insert on public.user_follow_requests
for each row
execute function public.notify_follow_request();

-- Trigger: create notification when a follow request is accepted
create or replace function public.notify_follow_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, notification_type, actor_id, created_at)
    values (new.sender_id, 'follow_accepted', new.receiver_id, now());
  end if;
  return new;
end;
$$;

create trigger trg_notify_follow_accepted
after update on public.user_follow_requests
for each row
execute function public.notify_follow_accepted();

-- Trigger: create notification when someone likes your content
create or replace function public.notify_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

create trigger trg_notify_like
after insert on public.reactions
for each row
execute function public.notify_like();

-- Trigger: create notification when a followed user watches something
create or replace function public.notify_friend_watched()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

create trigger trg_notify_friend_watched
after insert on public.watched_items
for each row
execute function public.notify_friend_watched();

commit;
