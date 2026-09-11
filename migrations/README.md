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
| `093_taste_is_precomputed.sql` | `title_reach`, `taste_corpus`, `user_taste`, `taste_pair`, `taste_neighbours` + the nightly refresh functions. Replaces `taste_compatibility` / `taste_matches`, which rebuilt the whole community on every profile view, and stops `title_audience` doing the same on every title page. **Requires the `/api/cron/refresh-taste` cron and `CRON_SECRET`** — the request path only reads these caches, it never builds them. |
| `094_a_season_can_be_replied_to.sql` | Adds `'season'` to `comments_item_type_check`. Every reply typed on a season page was being rejected by the constraint and the raw Postgres error rendered to the user. Guarded from here by `tests/invariants/comment-types.test.ts`. |
| `095_a_viewing_is_a_dated_event.sql` | `viewings`: one row per time somebody watched something (date, rewatch, place, provider). Backfills one per watched title. `watched_items.watched_at` and `user_media_status.watch_count` become projections kept by trigger; `get_user_stats.watched_this_year` counts viewings instead of `updated_at`. `ensure_first_viewings(jsonb)`: the one call every "watched" writer makes, a today-viewing per title that has none. **Bet 1.** |
| `096_a_viewing_knows_who_was_there.sql` | `viewing_companions` (a user or a plain name per viewing), the `co_log_invite` notification, `accept_co_log()` ("I was there too" writes the companion's own viewing, linked both ways), `watch_companions()`, `room_companions()`. **Bet 2.** |
| `097_a_save_has_a_why_a_when_and_a_who.sql` | `user_media_status.save_note/save_for/save_for_date/save_with_*/saved_at`; `title_recommendations` (a recipient may only name a recommender they are connected to; closed by the recipient's viewing → `recommendation_watched`); a shared `cardmix` message becomes a recommendation. **Bet 3.** |
| `098_a_notification_the_user_caused.sql` | Widens the notification CHECK to nine kinds, restores `notify_comment_reply` (now block-aware), adds `episode_announcements` (the cron's memory). **Bet 5.** |
| `099_availability_is_a_snapshot.sql` | `title_availability` (daily provider snapshot per title/region), `title_scans`, `catalog_scans`. Public to read, cron-only to write. **Requires `/api/cron/refresh-watchlist`.** Optional `STREAMING_AVAILABILITY_API_KEY` fills `expires_on`. **Bets 5, 9.** |
| `100_a_profile_has_more_than_four_slots.sql` | `user_identity_slots`: four people, a comfort watch, a hill to die on. **Bet 10.** |
| `101_an_import_can_come_from_anywhere.sql` | `import_rows` gains `media_hint`, `tmdb_hint`, `imdb_id`, `tvdb_id`, `viewing_dates`, `episodes`; the unique index includes `media_hint` and the three ids. Trakt, Simkl, TV Time, IMDb, Netflix and Letterboxd's `diary.csv`. **Bet 4c.** |
| `102_the_room_is_never_empty.sql` | `regional_watching()`: what people in a region logged this week, counts only, k-anonymity floor. **Bet 11.** |

> ✅ **093–102 applied to production on 2026-09-11**, in order, through the session pooler (`SUPABASE_SESSION_POLLER_URL` in `.env.local`; the direct `db.<ref>.supabase.co` host is IPv6-only). Every file's verify block passed; 095 backfilled 593 viewings for 593 watched titles. The block at the end of `000_baseline.sql` for the new tables is hand-written in pg_dump form and was checked column-for-column against the live schema; `npm run db:dump` needs Docker, which the machine that applied these does not have, so run it from one that does and the real dump will replace that block.

**Source of truth:** `000_baseline.sql`, regenerated from production with `npm run db:dump` after every applied migration. It replaced `schema.sql` and `schema_from_supabase.sql`, which had drifted 20+ and 29 tables behind respectively and could not build a working database between them.
