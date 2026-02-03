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
