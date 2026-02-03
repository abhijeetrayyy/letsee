# Full schema & code audit (cloud vs repo)

Based on `schema_from_supabase.sql` (dumped from live Supabase) compared to `schema.sql`, migrations, and all app code.

---

## Executive summary

| Area | Status | Notes |
|------|--------|------|
| **Tables** | ✅ Match | All 14 public tables in cloud match repo; columns align. |
| **RLS policies** | ✅ Match | All profile-visibility and self policies present in cloud. |
| **Functions** | ⚠️ 1 missing in cloud | `backfill_watched_episodes_for_show` not in dump; run migration 014 in Supabase. |
| **Code ↔ DB** | ✅ Aligned | APIs/pages use correct tables and columns; no references to missing columns. |
| **Dump file** | ⚠️ 1 fix | Remove invalid `\restrict ...` line at top of `schema_from_supabase.sql`. |

**Fixes:** (1) Run `migrations/014_backfill_watched_episodes_function.sql` in Supabase if not already. (2) Remove the stray `\restrict` line from the dump file so it stays valid SQL.

---

## 1. Tables (cloud vs repo)

All tables in the dump exist in the repo and are used as expected.

| Table | In cloud | In schema.sql | Used by (APIs / pages) |
|-------|----------|---------------|-------------------------|
| `users` | ✅ | ✅ | profile/[id], profile/setup, profile/settings, navbar, getfollower, getfollowing, HomeDiscover, messages, middleware, etc. |
| `user_cout_stats` | ✅ | ✅ | profile page (sorting), ensure_user_cout_stats trigger |
| `watched_items` | ✅ | ✅ | watchedButton, deletewatchedButton, UserWatchedPagination, reviews-ratings-diary, public-reviews, watched-review, reviews, profile page, profileContent, statisticsGenre, backfill-watched-episodes, continue-watching, userPrefrence, recommendations, etc. |
| `watched_episodes` | ✅ | ✅ | watchedButton, watched-episode, watched-episodes, continue-watching, tv-progress, deletewatchedButton |
| `favorite_items` | ✅ | ✅ | favoriteButton, deletefavoriteButton, UserFavoritePagination, profile page, profileContent, update-genres, personalRecommendations, watchlistButton |
| `user_watchlist` | ✅ | ✅ | watchlistButton, deletewatchlistButton, movieReel/watchlist, profile page, profileContent, userPrefrence, genre-start |
| `user_ratings` | ✅ | ✅ | user-rating, watchedButton, deletewatchedButton, UserWatchedPagination, reviews-ratings-diary |
| `user_favorite_display` | ✅ | ✅ | profile/favorite-display, profile page (Taste in 4) |
| `user_lists` | ✅ | ✅ | user-lists, user-lists/[id], user-lists/[id]/items, profile page (featured list) |
| `user_list_items` | ✅ | ✅ | user-lists, user-lists/[id]/items |
| `user_connections` | ✅ | ✅ | getfollower, getfollowing, profile page, profllebtn, followerAction, user-lists (visibility) |
| `user_follow_requests` | ✅ | ✅ | notification page, profllebtn, followerAction, RealtimeNotification |
| `messages` | ✅ | ✅ | messages page, messages/[id], sendCard, MessageButton, RealtimeUnreadCount |
| `recommendation` | ✅ | ✅ | recommendations (add, remove, route), recommendations/search |

No extra tables in repo that are missing in cloud. No tables in cloud that the code doesn’t expect.

---

## 2. Key columns (sample)

- **users:** id, email, username, about, visibility, avatar_url, banner_url, tagline, featured_list_id, pinned_review_id, profile_show_diary, profile_show_ratings, profile_show_public_reviews, created_at, updated_at — all present in cloud and used in code.
- **watched_items:** id, user_id, item_id, item_name, item_type, image_url, item_adult, genres, watched_at, review_text, public_review_text, is_watched, runtime_minutes — all present; code does not insert `runtime_minutes` (optional).
- **watched_episodes:** id, user_id, show_id, season_number, episode_number, watched_at, runtime_minutes — all present.

No code path selects or inserts a column that is missing in the dump.

---

## 3. Functions (cloud vs repo)

| Function | In cloud (dump) | In schema.sql / migrations | Used by |
|----------|-----------------|----------------------------|---------|
| `set_updated_at` | ✅ | ✅ | Triggers on users, user_cout_stats, user_ratings, user_lists |
| `ensure_user_cout_stats` | ✅ | ✅ | Trigger after insert on users |
| `increment_watched_count` | ✅ | ✅ | watchedButton, watched-episode |
| `decrement_watched_count` | ✅ | ✅ | deletewatchedButton, watchedButton |
| `increment_favorites_count` | ✅ | ✅ | favoriteButton |
| `decrement_favorites_count` | ✅ | ✅ | deletefavoriteButton |
| `increment_watchlist_count` | ✅ | ✅ | watchlistButton |
| `decrement_watchlist_count` | ✅ | ✅ | deletewatchlistButton, watchlistButton, genre-start |
| `profile_visible_to_viewer` | ✅ | ✅ | RLS on watched_items, favorite_items, user_watchlist, user_ratings, recommendation |
| **`backfill_watched_episodes_for_show`** | ❌ | ✅ (migration 014) | **`/api/backfill-watched-episodes`** (RPC) |

**Fix (cloud):** Run `migrations/014_backfill_watched_episodes_function.sql` in Supabase SQL Editor so `/api/backfill-watched-episodes` works (backfill TV episodes for existing watched shows).

---

## 4. RLS policies (cloud vs repo)

All expected policies are present in the dump:

- **users:** users_select_public, users_insert_self, users_update_self  
- **user_cout_stats:** user_cout_stats_select_public, user_cout_stats_modify_self  
- **watched_items:** watched_items_self, watched_items_select_public_reviews, watched_items_select_profile_visible  
- **favorite_items:** favorite_items_self, favorite_items_select_profile_visible  
- **user_watchlist:** user_watchlist_self, user_watchlist_select_profile_visible  
- **user_ratings:** user_ratings_self, user_ratings_select_profile_visible  
- **recommendation:** recommendation_self, recommendation_select_profile_visible  
- **user_favorite_display:** user_favorite_display_select, *_insert_self, *_update_self, *_delete_self  
- **user_lists:** user_lists_select_own, user_lists_select_public, user_lists_select_followers, *_insert_self, *_update_self, *_delete_self  
- **user_list_items:** user_list_items_select, *_insert_owner, *_update_owner, *_delete_owner  
- **user_connections:** user_connections_select_public, *_insert_self, *_delete_self  
- **user_follow_requests:** user_follow_requests_*  
- **messages:** messages_*  
- **watched_episodes:** watched_episodes_self, watched_episodes_select_public  

No missing or extra policies identified.

---

## 5. APIs and data points (by table)

| API / page | Tables / RPC used |
|------------|-------------------|
| **Profile** | |
| `GET/POST /api/profile/settings` | users |
| `GET /api/profile/reviews-ratings-diary` | users, user_connections, watched_items, user_ratings |
| `GET /api/profile/public-reviews` | users, user_connections, watched_items |
| `GET/PUT /api/profile/favorite-display` | users, user_connections, user_favorite_display |
| `GET /api/profile/watched-with-reviews` | watched_items |
| **Profile page** `app/profile/[id]/page.tsx` | users, watched_items, favorite_items, user_watchlist, user_connections, user_favorite_display, user_lists |
| **Watched / episodes** | |
| `POST /api/watchedButton` | watched_items, user_ratings, user_watchlist, watched_episodes, RPC increment_watched_count, decrement_* |
| `POST /api/deletewatchedButton` | watched_items, watched_episodes, user_ratings, favorite_items, RPC decrement_* |
| `POST /api/watched-episode` | watched_episodes, watched_items, RPC increment_watched_count |
| `GET /api/watched-episodes` | watched_episodes |
| `GET /api/continue-watching` | watched_episodes |
| `GET /api/tv-progress` | watched_episodes |
| `POST /api/backfill-watched-episodes` | watched_items, **RPC backfill_watched_episodes_for_show** (missing in cloud until 014 applied) |
| **Favorites / watchlist** | |
| `POST /api/favoriteButton` | favorite_items, user_watchlist, watched_items, RPC increment/decrement_* |
| `POST /api/deletefavoriteButton` | favorite_items, RPC decrement_favorites_count |
| `POST /api/watchlistButton` | user_watchlist, favorite_items, watched_items, RPC increment/decrement_* |
| `POST /api/deletewatchlistButton` | user_watchlist, RPC decrement_watchlist_count |
| **Lists** | |
| `GET/POST /api/user-lists` | user_lists, user_list_items, users, user_connections |
| `GET/PATCH/DELETE /api/user-lists/[id]` | user_lists, user_list_items, user_connections |
| `GET/POST/DELETE /api/user-lists/[id]/items` | user_lists, user_connections, user_list_items |
| **Reviews / ratings** | |
| `GET/PATCH /api/watched-review` | watched_items (review_text, public_review_text) |
| `GET /api/reviews` | watched_items (public_review_text), users |
| `GET/POST/PATCH /api/user-rating` | user_ratings, watched_items |
| **Recommendations** | |
| `GET /api/recommendations` | users, user_connections, recommendation, watched_items |
| `POST /api/recommendations/add` | recommendation |
| `POST /api/recommendations/remove` | recommendation |
| `GET /api/recommendations/search` | watched_items |
| **Pagination** | |
| `GET /api/UserWatchedPagination` | users, user_connections, watched_items, user_ratings |
| `GET /api/UserFavoritePagination` | users, user_connections, favorite_items |
| **Discover / nav** | |
| `GET /api/HomeDiscover` | users |
| `GET /api/navbar` | users |
| **Followers / notifications** | |
| `GET /api/getfollower` | users, user_connections |
| `GET /api/getfollowing` | users, user_connections |
| **Messages** | |
| Messages pages & sendCard | users, messages |
| **Other** | |
| `GET /api/userPrefrence` | favorite_items, watched_items, user_watchlist |
| `POST /api/update-genres` | favorite_items |
| `GET /api/personalRecommendations` | favorite_items, watched_items |
| `POST /api/deletefavoriteButton` / `deletewatchlistButton` | favorite_items, user_watchlist, RPC decrement_* |
| Profile setup / genre-start | users, user_cout_stats, user_watchlist, watched_items |

All of the above use only tables and columns that exist in the cloud dump, except the backfill RPC (fix by applying migration 014).

---

## 6. Fixes

### Cloud (Supabase)

1. **Apply migration 014**  
   In Supabase → SQL Editor, run the contents of `migrations/014_backfill_watched_episodes_function.sql`.  
   This creates `backfill_watched_episodes_for_show` so `POST /api/backfill-watched-episodes` works.

### Local (repo)

1. **Dump file**  
   In `schema_from_supabase.sql`, remove or comment out the invalid line at the top:
   ```text
   \restrict ueF8OfSNF3OonvzAstUkB1nYgtbpjgTXMBlfUxBxdQvcLjox0sPV0rNFRdV4O9L
   ```  
   So the file is valid SQL and can be re-run or diffed safely.

2. **Keep schema.sql in sync**  
   Use `schema_from_supabase.sql` as reference; when you change the DB (e.g. new migrations), re-dump and optionally merge changes into `schema.sql` so the repo stays the single source of truth for “what the app expects.”

### Optional

- Re-run `pg_dump` after applying 014 and replace `schema_from_supabase.sql` so the dump again includes `backfill_watched_episodes_for_show`.
- Add `schema_from_supabase.sql` to `.gitignore` if it contains project-specific details you don’t want in version control; otherwise keep it for diffing and audits.

---

## 7. Summary table

| Item | Cloud | Repo / code | Action |
|------|-------|-------------|--------|
| Tables (14) | ✅ | ✅ | None |
| Columns (users, watched_items, etc.) | ✅ | ✅ | None |
| RLS policies | ✅ | ✅ | None |
| `backfill_watched_episodes_for_show` | ❌ | ✅ | Run migration 014 in Supabase |
| Other RPCs (increment_*, decrement_*, profile_visible_to_viewer) | ✅ | ✅ | None |
| `schema_from_supabase.sql` first line | Invalid `\restrict` | N/A | Remove that line locally |

Once migration 014 is applied in Supabase and the dump file is fixed, cloud and repo are fully aligned for schema, functions, and code usage.
