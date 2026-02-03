-- Public reviews: allow anyone to read watched_items rows that have a review (for GET /api/reviews)
-- Index for listing reviews by item (movie/TV)
create index if not exists watched_items_item_id_item_type_idx on public.watched_items (item_id, item_type);

-- RLS: public can SELECT rows where review_text is not null (insert/update/delete remain self-only)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'watched_items' and policyname = 'watched_items_select_public_reviews'
  ) then
    create policy "watched_items_select_public_reviews" on public.watched_items
      for select using (review_text is not null);
  end if;
end $$;
