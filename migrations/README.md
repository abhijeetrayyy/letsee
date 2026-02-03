# Schema migrations

One SQL file per task. Run only the migrations you need (e.g. if you already applied the full `schema.sql`, you may only need later numbered files).

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

**Source of truth:** `schema.sql` is the consolidated reference schema (tables + RLS). It is kept in sync with migrations so that future prompts and tooling have a single place to see the full picture. To sync your **live** Supabase DB with the repo, see [Pulling schema from Supabase](../docs/PULL_SCHEMA_FROM_SUPABASE.md).
