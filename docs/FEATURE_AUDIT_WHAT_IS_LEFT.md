# Feature Audit: What’s Done vs What’s Left to Build

**Purpose:** Cross-check `FEATURE_RESEARCH_AND_OPTIONS.md` and `PRIORITY_LIST.md` against the codebase and list what is actually implemented vs what remains to build.

**Audit date:** Feb 2025 (after login/signup alignment, Discover people improvements, proxy/session fixes).

---

## 1. Verified as DONE (in codebase)

| # | Feature | Evidence |
|---|---------|----------|
| 1 | **Where to Watch** | `watchOptionView.tsx` used in `movie.tsx` & `tv.tsx`; `/api/watch-providers` exists. |
| 2 | **Personal recommendations (TMDB)** | `/api/personalRecommendations`, `openaiReco.tsx` calls it; section on home. |
| 3 | **README + landing** | README and landing page content present. |
| 4 | **Personal rating** | `user_ratings` in schema; `/api/user-rating` (GET/POST/DELETE); `UserRating.tsx` on movie & TV detail. |
| 5 | **Custom lists** | `user_lists` + `user_list_items`; `/api/user-lists`, `/api/user-lists/[id]`, `/api/user-lists/[id]/items`; `ProfileLists`, `CreateListModal`, `ListDetail`; `/app/lists/[listId]` page. |
| 6 | **Reviews / diary** | `watched_items.review_text` (migrations); `/api/watched-review`; `WatchedReview` on movie & TV detail; profile watched shows review. |
| 7 | **Calendar / upcoming** | `/api/calendar`; `CalendarSection` on home (“In theaters”, “TV this week”). |
| 8 | **Reel improvements** | `/api/movieReel/watchlist`; movieReel supports keyword/genre; reel UI. |

---

## 2. Marked Done in PRIORITY_LIST but NOT in app (removed or never wired)

| # | Feature | Status | Notes |
|---|---------|--------|--------|
| **Activity feed** | ❌ Removed | `migrations/010_remove_activity.sql` drops `activity` table and enum. No `/api/activity-feed`, no `ActivityFeed` on home. PRIORITY_LIST says “Done” but feature was removed. **Left to build:** Re-introduce activity (schema + API + insert on watched/fav/watchlist/rating) + feed UI on home or dedicated page. |

---

## 3. Not started (left to build)

### High impact (from FEATURE_RESEARCH)

| # | Option | What to build |
|--|--------|----------------|
| **10** | **Episode-level TV tracking** | Table e.g. `watched_episodes` (user_id, tv_id, season, episode); “Continue watching” for TV; mark episode watched. |
| **11** | **Export data** | Export watched/watchlist/favorites (and ratings) as CSV/JSON from profile or settings. |
| **12** | **Discover/search filters** | UI for year, language, genre (and “where to watch” when providers exist) on discover or search. |
| **13** | **Friend-activity notifications** | Notify when a friend watches, rates, or adds to list (extends current follow-request notifications). |
| **14** | **PWA** | Web app manifest + service worker; installable, optional offline for visited pages. |
| **15** | **Cleanup** | Remove or repurpose `/app/todo` (currently placeholder “hi.”). Person page debug ingest was cited in API_AUDIT; not found in current `person/[id]` — confirm and remove any remaining debug. |

### Optional / later

| # | Option | What to build |
|--|--------|----------------|
| **16** | **Import** | Import from Letterboxd CSV (or similar); map to watched/watchlist. |
| **17** | **Watchlist/availability alerts** | “Movie X is now on Netflix” (needs provider data + job or webhook). |
| **18** | **New episode alerts** | For shows in watchlist or watched: “New episode of Y available.” |
| **19** | **Accessibility** | Keyboard nav, focus, alt text, ARIA where needed. |
| **20** | **Region / India** | Document in README to deploy (e.g. Vercel) in non-India region for TMDB. |

---

## 4. Re-introducing Activity feed (if you want it)

Activity was removed in migration 010. To have it again:

1. **Schema:** New migration that re-creates `activity_type` enum and `activity` table (e.g. user_id, target_user_id, type: watched | favorite | watchlist | rating, item_id, item_type, item_name, created_at), plus RLS (e.g. select where user is follower of target or self).
2. **Backend:** On watched/favorite/watchlist add/remove and on rating set/delete, insert a row into `activity` for the current user (and optionally limit to “public” or “followers” visibility).
3. **API:** `GET /api/activity-feed` — for current user, return recent activity from users they follow (and optionally their own), with pagination.
4. **UI:** “Activity” or “Feed” section on home (or dedicated `/app/feed` page) that consumes this API and shows “Friend A watched X”, “B added Y to watchlist”, etc.

---

## 5. Suggested order to build next

**If you want maximum impact with least rework:**

1. **Activity feed** — Re-add schema + API + insert hooks + feed UI (makes follow graph useful daily).
2. **Export data** — Simple CSV/JSON export of watched, watchlist, favorites (and ratings) from profile/settings (trust, portability).
3. **Discover/search filters** — Year, language, genre (and later “where to watch”) on discover/search.
4. **Episode-level TV tracking** — If you care about TV-heavy users; “Continue watching” and per-episode progress.
5. **Cleanup** — Todo page and any remaining debug code.
6. **PWA** — Manifest + service worker when you want installable/mobile feel.
7. **Friend-activity notifications** — After activity feed exists; extend notifications when friends watch/rate/add.

---

## 6. Quick reference: FEATURE_RESEARCH options vs status

| Option | FEATURE_RESEARCH # | Status |
|--------|--------------------|--------|
| Where to Watch | 1 | ✅ Done |
| Personal recommendations | 2 | ✅ Done (TMDB) |
| Discover/search filters | 3 | ⬜ Not started |
| Calendar / upcoming | 4 | ✅ Done |
| Reel improvements | 5 | ✅ Done |
| Personal rating | 6 | ✅ Done |
| Reviews / diary | 7 | ✅ Done |
| Custom lists | 8 | ✅ Done |
| Episode-level TV | 9 | ⬜ Not started |
| Activity feed | 10 | ❌ Removed (left to re-build) |
| Notify on friend activity | 11 | ⬜ Not started |
| Public recent activity on profile | 12 | ⬜ Not started (optional) |
| Watchlist/availability alerts | 13 | ⬜ Not started |
| New episode alerts | 14 | ⬜ Not started |
| Export data | 15 | ⬜ Not started |
| Import | 16 | ⬜ Not started |
| README + landing | 17 | ✅ Done |
| PWA | 18 | ⬜ Not started |
| Remove debug / dead code | 19 | ⬜ Cleanup todo page; verify Person |
| Region / India | 20 | ⬜ Document |
| Accessibility | 21 | ⬜ Not started |

---

**Summary:** Most of the “quick wins” and “high impact” items from the feature research are done. What’s **left to build** is: **Activity feed** (re-add), **Export data**, **Discover filters**, **Episode-level TV**, **Cleanup**, **PWA**, and **Friend-activity notifications**. Use this doc and the suggested order above to pick the next 1–2 goals.
