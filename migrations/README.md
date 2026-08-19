# Schema migrations

One SQL file per task, applied in numeric order.

`000_baseline.sql` is the whole schema as it exists in production. A **fresh** database needs that file and nothing else. An **existing** database needs only the numbered migrations it is missing — never the baseline.

**How to run:** Supabase Dashboard → SQL Editor → paste the contents of the file → Run.

**Agent / instruction reference:** For a single file that describes the DB, what each migration does, which are valid to run, and which should not be run, see [docs/AGENT_DB_AND_MIGRATIONS.md](../docs/AGENT_DB_AND_MIGRATIONS.md).

| File | Task |
|------|------|
| `007_watched_review_text.sql` | Add `review_text` to `watched_items` (reviews/diary) |
| `008_public_reviews.sql` | Index on `watched_items(item_id, item_type)`; RLS for public reviews (initially `review_text`; see 009) |
| `009_diary_vs_public_review.sql` | Add `public_review_text`; RLS only exposes rows with `public_review_text` set |
| `010_remove_activity.sql` | Remove `activity` table and `activity_type` enum |
| `011_profile_enhancements.sql` | `users`: avatar_url, banner_url, tagline, featured_list_id, pinned_review_id; `user_favorite_display` table (Taste in 4) and RLS. **Required for profile hero and Taste in 4.** |
| `012_watched_episodes.sql` | `watched_episodes` table and RLS (self only) |
| `013_watched_episodes_public_read.sql` | RLS: anyone can SELECT `watched_episodes` (profile TV progress) |
| `014_backfill_watched_episodes_function.sql` | Function `backfill_watched_episodes_for_show` for API backfill |
| `015_profile_diary_reviews_ratings_visibility.sql` | `users`: profile_show_diary, profile_show_ratings, profile_show_public_reviews |
| `016_watched_items_is_watched.sql` | `watched_items.is_watched` (soft unwatch) |
| `017_runtime_minutes_for_hours.sql` | `watched_items.runtime_minutes`, `watched_episodes.runtime_minutes` |
| `018_profile_visible_to_viewer_robust.sql` | Function `profile_visible_to_viewer(uuid)`: null = public, case-insensitive. **Required so RLS allows viewing public/followers profiles.** |
| `019_add_profile_visibility_policies.sql` | RLS SELECT policies: watched_items, favorite_items, user_watchlist, user_ratings, recommendation (profile_visible_to_viewer). Idempotent (drop + create). **Required so other users see watched/favorites/watchlist on public profiles.** |
| `020_remove_runtime_minutes.sql` | Drops `watched_items.runtime_minutes` and `watched_episodes.runtime_minutes`. Profile stats use Movies, TV, Episodes (count on fetch); no Hours. |
| `055_drop_default_tv_status.sql` | Drops `users.default_tv_status` (added by 021, constraint tightened by 022). Nothing ever read it; the five-status control replaced the flow it was for. |

**Source of truth:** `000_baseline.sql`, regenerated from production with `npm run db:dump` after every applied migration. It replaced `schema.sql` and `schema_from_supabase.sql`, which had drifted 20+ and 29 tables behind respectively and could not build a working database between them.
