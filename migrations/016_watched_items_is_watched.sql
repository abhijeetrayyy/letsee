-- Soft unwatch: keep rating, diary and public review when user removes from Watched.
-- is_watched = true: item appears in Watched list and counts.
-- is_watched = false: row kept for diary/public review; rating kept; item not in Watched list.

alter table public.watched_items add column if not exists is_watched boolean not null default true;

comment on column public.watched_items.is_watched is 'When false, item is not shown in Watched list but diary/public review row is kept.';
