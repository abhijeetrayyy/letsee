-- Separate diary (private) from public review.
-- review_text = Your diary (only you see it).
-- public_review_text = Public review (visible in Reviews section).

-- Add column for public review (optional; when set, row appears in GET /api/reviews)
alter table public.watched_items
  add column if not exists public_review_text text;

-- Drop old policy that exposed review_text
drop policy if exists "watched_items_select_public_reviews" on public.watched_items;

-- RLS: public can only read rows that have a public review (not diary)
create policy "watched_items_select_public_reviews" on public.watched_items
  for select using (public_review_text is not null);
