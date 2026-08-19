-- 073_private_diary_stays_private.sql
-- Two blanket-read policies that publish the private half of the library.
--
-- (1) watched_items_select_public_reviews, from 009:
--       for select using (public_review_text is not null)
--     under a comment reading "public can only read rows that have a public
--     review (not diary)". RLS filters rows, not columns — 065's own header
--     says so in as many words — and `review_text`, the private diary, lives
--     on the same row. The policy is PERMISSIVE, so it ORs with 019's
--     visibility gate rather than narrowing it: writing one public review on a
--     title published the private diary entry for that same title, from any
--     profile including a private one, to anyone holding the anon key.
--
--     Nothing needs the policy any more. 062's reviews_for_title() is
--     SECURITY DEFINER and selects only the public columns, and that is the
--     path /api/reviews takes. Its fallback query (used only when the RPC
--     errors) now returns reviews from visible profiles only, which is the
--     correct answer rather than a regression.
--
-- (2) watched_episodes_select_public, from 013:
--       for select using (true)
--     019 went through watched_items, favorite_items, user_watchlist,
--     user_ratings and recommendation replacing blanket reads with
--     profile_visible_to_viewer, and walked straight past this one. So private
--     mode hid a user's ratings and published which episode of which show they
--     watched, and at what hour — a behavioural timeline, not a preference
--     list. /api/profile/tv-progress and /api/profile/tv-calendar already run
--     their own visibility check before reading this table, so gating it at
--     the row level costs those routes nothing and closes the direct-PostgREST
--     path around them.
--
-- Idempotent: drop-if-exists before each create.

BEGIN;

DROP POLICY IF EXISTS "watched_items_select_public_reviews" ON public.watched_items;

DROP POLICY IF EXISTS "watched_episodes_select_public"           ON public.watched_episodes;
DROP POLICY IF EXISTS "watched_episodes_select_profile_visible"  ON public.watched_episodes;

CREATE POLICY "watched_episodes_select_profile_visible"
  ON public.watched_episodes
  FOR SELECT
  USING (auth.uid() = user_id OR public.profile_visible_to_viewer(user_id));

COMMIT;
