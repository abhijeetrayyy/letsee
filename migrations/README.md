# Schema migrations

One SQL file per task. Run only the migrations you need (e.g. if you already applied the full `schema.sql`, you may only need later numbered files).

**How to run:** Supabase Dashboard → SQL Editor → paste the contents of the file → Run.

| File | Task |
|------|------|
| `007_watched_review_text.sql` | Add `review_text` to `watched_items` (reviews/diary) |
| `008_public_reviews.sql` | Add `public_review_text` to `watched_items` |
| `009_diary_vs_public_review.sql` | Diary vs public review columns |
| `010_remove_activity.sql` | Remove activity table and enum |
| `011_profile_enhancements.sql` | Profile: `avatar_url`, `banner_url`, `tagline`, `featured_list_id`, `pinned_review_id` on `users`; `user_favorite_display` table (Taste in 4). **Required for profile hero and Taste in 4.** |
| … | (012–017: watched_episodes, backfill, profile visibility columns, is_watched, runtime_minutes) |
| `018_profile_visible_select.sql` | **Profile visibility:** Allow visitors to SELECT watched, favorites, watchlist, ratings, recommendations when the profile owner’s visibility permits (public = anyone; followers = only if viewer follows). Adds `profile_visible_to_viewer(uuid)` and new RLS SELECT policies. **Required so other users can see non-private profile content.** |
