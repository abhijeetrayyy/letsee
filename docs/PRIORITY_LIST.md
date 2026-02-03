# Letsee — Priority List (do one by one)

Use this list to track progress. Work in order; check off when done.

---

## Quick wins (ship existing work)

| # | Task | Status | Notes |
|---|------|--------|--------|
| 1 | **Ship "Where to Watch"** — Uncomment & wire `watchOptionView.tsx` on movie/TV detail; add API for TMDB watch/providers; optional user country. | ✅ Done | Added `/api/watch-providers`, restored `watchOptionView.tsx`, wired on movie & TV pages (country=US). |
| 2 | **Surface AI recommendations on home** — Uncomment OpenAiReco block on `/app/page.tsx` and style it. | ✅ Done | Section added with card styling; button and error styled to match app. |
| 3 | **README + landing** — Fill README with value prop, main features, how to run; improve landing copy/screenshots. | ✅ Done | README: value prop, features, tech, env, DB, scripts, deployment. Landing: hero “Track. Share. Discover.”, 6 feature cards (lists, Where to Watch, AI reco, search, share/chat, reels). |

---

## High impact (new value)

| # | Task | Status | Notes |
|---|------|--------|--------|
| 4 | **Personal rating** — Add `user_ratings` (or extend watched), 1–5 or 1–10 stars; show on cards & detail; "Your rating" vs IMDB. | ✅ Done | Schema `user_ratings`, GET/POST `/api/user-rating`, `UserRating` on movie & TV detail (1–10 buttons). Apply updated `schema.sql` in Supabase. |
| 5 | **Activity feed** — "Friend watched X", "added Y to watchlist", "rated Z"; feed on home or dedicated page. | ❌ Removed | Activity was removed in `migrations/010_remove_activity.sql`. No `/api/activity-feed` or `ActivityFeed` in codebase. See `FEATURE_AUDIT_WHAT_IS_LEFT.md` to re-build. |
| 6 | **Custom lists** — Tables `user_lists` + `user_list_items`; create/edit/reorder; show on profile; visibility. | ✅ Done | Schema `user_lists` + `user_list_items`; GET/POST `/api/user-lists`, GET/PATCH/DELETE `/api/user-lists/[id]`, GET/POST/DELETE items; `ProfileLists` + `CreateListModal` on profile; list detail at `/app/lists/[listId]` with add (search) and remove. Apply updated `schema.sql`. |
| 7 | **Reviews / diary** — Optional review text + date watched; diary UX from watched list. | ✅ Done | Schema: `watched_items.review_text`; GET/PATCH `/api/watched-review`; `WatchedReview` on movie & TV detail (when watched); profile watched shows date + review snippet. Apply schema change. |

---

## Differentiation

| # | Task | Status | Notes |
|---|------|--------|--------|
| 8 | **Calendar / upcoming** — Section or page: "In theaters", "TV this week" (TMDB). | ✅ Done | GET `/api/calendar` (now_playing + on_the_air); `CalendarSection` on home with "In theaters" and "TV this week". |
| 9 | **Reel improvements** — More genres/moods; tie to watchlist or "continue". | ✅ Done | More keywords (suspense, feel-good, noir, superhero); "Your watchlist" reels (GET `/api/movieReel/watchlist`); genreId in POST movieReel; remember last selection (localStorage). |
| 10 | **Episode-level TV tracking** — Watched episodes table; "Continue watching" for TV. | ⬜ Not started | TV-heavy users. |

---

## Trust & polish

| # | Task | Status | Notes |
|---|------|--------|--------|
| 11 | **Export data** — Export watched/watchlist/favorites (CSV/JSON) from profile/settings. | ⬜ Not started | Trust. |
| 12 | **Discover filters** — UI for year, language, genre on discover/search. | ⬜ Not started | Backend has language. |
| 13 | **Friend-activity notifications** — Notify when friend watches/rates/adds to list. | ⬜ Not started | After activity feed. |
| 14 | **PWA** — manifest + service worker; installable. | ⬜ Not started | Mobile feel. |
| 15 | **Cleanup** — Remove Person page debug ingest; tidy or remove todo page. | ⬜ Not started | Hygiene. |

---

## How to use

- **Current focus:** See `FEATURE_AUDIT_WHAT_IS_LEFT.md` for verified status and suggested next tasks.
- When a task is done: change `⬜ Not started` to `✅ Done` and note any follow-ups.
- Reference full options in `FEATURE_RESEARCH_AND_OPTIONS.md`.
