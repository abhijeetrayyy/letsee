-- Profile enhancements: avatar, banner, tagline, featured list, pinned review, Taste in 4.
-- Run after 010. Apply in Supabase SQL editor.

begin;

-- users: avatar, banner, tagline, featured list, pinned review
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'avatar_url') then
    alter table public.users add column avatar_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'banner_url') then
    alter table public.users add column banner_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'tagline') then
    alter table public.users add column tagline text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'featured_list_id') then
    alter table public.users add column featured_list_id bigint references public.user_lists(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'pinned_review_id') then
    alter table public.users add column pinned_review_id bigint;
    comment on column public.users.pinned_review_id is 'watched_items.id; app must ensure it belongs to this user';
  end if;
end $$;

-- Taste in 4: up to 4 titles displayed in profile hero (position 1–4)
create table if not exists public.user_favorite_display (
  user_id uuid not null references public.users(id) on delete cascade,
  position smallint not null check (position >= 1 and position <= 4),
  item_id text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  image_url text,
  item_name text not null,
  primary key (user_id, position)
);

create index if not exists user_favorite_display_user_id_idx on public.user_favorite_display (user_id);

alter table public.user_favorite_display enable row level security;

create policy "user_favorite_display_select" on public.user_favorite_display
  for select using (true);
create policy "user_favorite_display_insert_self" on public.user_favorite_display
  for insert with check (auth.uid() = user_id);
create policy "user_favorite_display_update_self" on public.user_favorite_display
  for update using (auth.uid() = user_id);
create policy "user_favorite_display_delete_self" on public.user_favorite_display
  for delete using (auth.uid() = user_id);

commit;
