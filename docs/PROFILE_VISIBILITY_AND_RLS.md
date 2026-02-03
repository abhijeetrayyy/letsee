# Profile visibility & RLS: watched, favorites, watchlist

## Are we fetching from the right tables?

**Yes.** The profile page and APIs use these tables:

| Content            | Table             | Used for |
|--------------------|-------------------|----------|
| **Watched**       | `watched_items`   | Counts, recent activity, reviews/ratings/diary, pinned review |
| **Favorites**     | `favorite_items`  | Count, Taste in 4 (via `user_favorite_display`) |
| **Watch later**   | `user_watchlist`  | Count, lists in Activity & lists |

Profile page (`src/app/app/profile/[id]/page.tsx`) queries:

- `watched_items` — counts, recent activity (10 rows), stats (this year, movie/tv), pinned review
- `favorite_items` — count
- `user_watchlist` — count
- `user_favorite_display` — Taste in 4 (has `select using (true)` so visible to all)

APIs like `/api/profile/reviews-ratings-diary`, `/api/UserWatchedPagination`, `/api/UserFavoritePagination`, etc. also read from `watched_items`, `favorite_items`, or `user_watchlist` for the profile owner.

---

## Visibility (who can see what)

Visibility is stored on **`users.visibility`** (enum: `public`, `followers`, `private`).

- **Public** — anyone (including anon) can see watched/favorites/watchlist for that profile.
- **Followers** — only if the viewer is logged in and follows the profile owner.
- **Private** — only the profile owner (no policy allows others to see).

The app layer (profile page and APIs) computes `canView` from `users.visibility` and, for “followers”, from `user_connections`.  
RLS uses the same idea via the function **`profile_visible_to_viewer(owner_user_id)`**, which:

- Reads `users.visibility` for that `owner_user_id`
- Returns true if visibility is `public` (or null), or if visibility is `followers` and the current user follows the owner

So: **visibility is enforced in two places** — in app code (for 403 and UI) and in RLS (for actual row access). Both must allow; RLS is the one that actually blocks or allows rows.

---

## RLS policies for watched, favorite, watchlist

### `watched_items`

| Policy                             | Operation | Who can see |
|------------------------------------|-----------|-------------|
| `watched_items_self`               | ALL       | Owner only (`auth.uid() = user_id`) |
| `watched_items_select_public_reviews` | SELECT | Any row where `public_review_text is not null` (anyone) |
| `watched_items_select_profile_visible` | SELECT | Owner **or** `profile_visible_to_viewer(user_id)` (profile public or viewer follows) |

So a **viewer** can SELECT another user’s watched rows only if `profile_visible_to_viewer(that user_id)` is true (i.e. profile is public or viewer follows).

### `favorite_items`

| Policy                             | Operation | Who can see |
|------------------------------------|-----------|-------------|
| `favorite_items_self`              | ALL       | Owner only (`auth.uid() = user_id`) |
| `favorite_items_select_profile_visible` | SELECT | Owner **or** `profile_visible_to_viewer(user_id)` |

Same idea: viewers see another user’s favorites only when profile is visible (public or followers and they follow).

### `user_watchlist`

| Policy                             | Operation | Who can see |
|------------------------------------|-----------|-------------|
| `user_watchlist_self`              | ALL       | Owner only (`auth.uid() = user_id`) |
| `user_watchlist_select_profile_visible` | SELECT | Owner **or** `profile_visible_to_viewer(user_id)` |

Same: watchlist for another user is visible only when `profile_visible_to_viewer(user_id)` is true.

---

## Summary

- **Tables:** We fetch watched from `watched_items`, favorites from `favorite_items`, watch later from `user_watchlist`. Correct.
- **Visibility:** Stored on `users.visibility`; enforced in app (canView) and in DB via `profile_visible_to_viewer(user_id)` in RLS.
- **RLS:** For **SELECT** by a viewer who is not the owner, all three tables use the same rule:  
  `auth.uid() = user_id OR profile_visible_to_viewer(user_id)`.  
  So visibility and the watched/favorite/watchlist RLS policies are aligned.

Ensure **migration 018** (`018_profile_visible_to_viewer_robust.sql`) is applied so `profile_visible_to_viewer()` treats null visibility as public and compares visibility case-insensitively.
