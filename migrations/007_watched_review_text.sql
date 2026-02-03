-- Task #7: Reviews / diary — add optional review text to watched_items
-- Run this in Supabase SQL Editor (or any Postgres client) to add the column.

begin;

alter table public.watched_items
  add column if not exists review_text text;

commit;
