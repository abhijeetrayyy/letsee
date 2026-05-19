-- Following Activity Feed

begin;

-- Helper type for activity feed entries
create table if not exists public.user_activity (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('watched', 'rated', 'reviewed', 'list_created', 'favored')),
  item_id text,
  item_type text check (item_type in ('movie', 'tv')),
  item_name text,
  image_url text,
  score smallint check (score >= 1 and score <= 10),
  review_text text,
  list_name text,
  list_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists user_activity_user_id_created_at_idx on public.user_activity (user_id, created_at desc);
create index if not exists user_activity_created_at_idx on public.user_activity (created_at desc);

alter table public.user_activity enable row level security;

-- RLS: users can insert their own activity
create policy "user_activity_insert_self" on public.user_activity
  for insert with check (auth.uid() = user_id);

-- RLS: anyone can read activity if the user's profile is visible to them
create policy "user_activity_select_visible" on public.user_activity
  for select using (
    public.profile_visible_to_viewer(user_id)
  );

-- Trigger function: insert activity when a watched_item is created
create or replace function public.log_watched_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_activity (user_id, activity_type, item_id, item_type, item_name, image_url, created_at)
  values (new.user_id, 'watched', new.item_id, new.item_type, new.item_name, new.image_url, new.watched_at);
  return new;
end;
$$;

create trigger trg_log_watched_activity
after insert on public.watched_items
for each row
execute function public.log_watched_activity();

-- Trigger function: log public reviews
create or replace function public.log_reviewed_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_review_text is not null and new.public_review_text != coalesce(old.public_review_text, '') then
    insert into public.user_activity (user_id, activity_type, item_id, item_type, item_name, image_url, review_text, created_at)
    values (new.user_id, 'reviewed', new.item_id, new.item_type, new.item_name, new.image_url, new.public_review_text, now());
  end if;
  return new;
end;
$$;

create trigger trg_log_reviewed_activity
after insert or update on public.watched_items
for each row
execute function public.log_reviewed_activity();

-- Trigger function: log list creation
create or replace function public.log_list_created_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_activity (user_id, activity_type, list_name, list_id, created_at)
  values (new.user_id, 'list_created', new.name, new.id, new.created_at);
  return new;
end;
$$;

create trigger trg_log_list_created_activity
after insert on public.user_lists
for each row
execute function public.log_list_created_activity();

commit;
