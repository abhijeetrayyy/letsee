# API Audit: TMDB & Fetch Usage (India TMDB Consideration)

**Date:** Feb 2, 2025  
**Context:** TMDB API can be problematic from India (blocking, throttling, or network issues). This audit lists every TMDB/API call and recommends routing all TMDB through the server (or better options below).

**Chosen approach: Option B** – Deploy the Next.js server in a non-India region so all TMDB calls (Server Components + API routes) run from that region. No code changes required.

**Fetch utilities & UX (Feb 2025):** Unified server/client fetch and better UX are in place:
- **Server:** `@/utils/tmdb` – `tmdbFetchJson(url, label, options)` with retry, timeout, and `revalidate` / `cache` for Server Components. `@/utils/serverFetch` – `serverFetch` / `serverFetchJson` for API routes (timeout + retry). `@/utils/apiResponse` – `jsonSuccess(data, options)` and `jsonError(message, status)` for consistent API responses and Cache-Control.
- **Client:** `@/hooks/useApiFetch` – `useApiFetch<T>(url, options)` returns `{ data, error, loading, refetch }`; aborts on unmount; parses `body.error` for user-facing messages.
- **UX:** `@/components/ui/FetchError` – error message + “Try again” button. `@/components/ui/LoadingSpinner` – consistent loading indicator. Route-level `loading.tsx` for app, person/[id], movie/[id], tv/[id], search/[query]. Home and video reel show retry on fetch failure.

---

## Option B: Deployment steps (run server outside India)

- **Vercel:** Set region so server runs outside India.
  - In project root, `vercel.json` with `regions` is included (e.g. `["iad1"]` = Washington DC). Vercel runs Server Components and API routes in the chosen region.
  - Or in Vercel Dashboard: Project → Settings → General → **Serverless Function Region** → pick e.g. **Washington, D.C. (iad1)** or **Frankfurt (fra1)**.
- **Other hosts:** Choose a deployment region that is not India (e.g. US East, EU) when creating the project or in hosting settings.
- **Verify:** After deploy, TMDB requests originate from the selected region; users in India will still get responses from your app, but the server calling TMDB is in the chosen region.

---

## Executive Summary

| Category | Count | Where | India risk |
|----------|-------|--------|------------|
| **Direct TMDB from Server Components** | 10 files | Pages/layouts | High (if server runs in India) |
| **Direct TMDB via `tmdbFetchJson`** | 5 files | Pages + 1 util | Same as above |
| **API routes that call TMDB** | 14 routes | `src/app/api/*` | Same (server region) |
| **Client → internal /api only** | 15+ call sites | Components | None (no direct TMDB from client) |
| **image.tmdb.org (img src only)** | Many | Components | Possible CDN issues in India |

**Finding:** No client-side code calls TMDB directly. All client fetches go to your own `/api/*` routes. The issue is that **Server Components and API routes** call `api.themoviedb.org` from wherever your Next.js server runs. If that is India, you still hit the India TMDB problem.

---

## 1. Direct TMDB Calls (Server-Side)

These run on the **server** (Server Components or API routes). If the server is in India, TMDB can still fail.

### 1.1 Server Components – raw `fetch("https://api.themoviedb.org/...")`

| File | Endpoint(s) | Purpose |
|------|-------------|---------|
| `src/app/app/page.tsx` | 7 URLs via `safeFetchJson` | Movie/TV genre lists, trending, discover (romance, action, Bollywood) |
| `src/app/app/person/[id]/page.tsx` | 4 URLs | Person details, external_ids, combined_credits, images |
| `src/app/app/tv/[id]/season/[seasonNumber]/page.tsx` | 2 URLs | TV series + seasons, season details |
| `src/app/app/tv/[id]/season/[seasonNumber]/episode/[episodeId]/page.tsx` | 2 URLs | Episode details, series info |
| `src/app/app/tvbygenre/layout.tsx` | 1 URL | TV genre list |
| `src/components/person/server/staringCredit.tsx` | 1 URL (movie or TV credits) | Credits for “Staring” section |

### 1.2 Server Components – `tmdbFetchJson` (from `@/utils/tmdb`)

`tmdbFetchJson` in `src/utils/tmdb.ts` does `fetch(url, …)` to TMDB. Used in:

| File | Endpoint(s) | Purpose |
|------|-------------|---------|
| `src/app/app/movie/[id]/page.tsx` | movie details, credits, videos, images, similar | Movie detail page |
| `src/app/app/movie/[id]/cast/page.tsx` | movie credits, movie details | Movie cast page |
| `src/app/app/tv/[id]/page.tsx` | TV details (append credits, videos, images, etc.) | TV detail page |
| `src/app/app/tv/[id]/cast/page.tsx` | TV details, TV credits | TV cast page |
| `src/app/app/moviebygenre/list/[id]/page.tsx` | discover movie by genre | Movie-by-genre list |
| `src/app/app/moviebygenre/list/layout.tsx` | genre movie list | Movie genre layout |

---

## 2. API Routes That Call TMDB

All run on the **server**. Again, if the server is in India, TMDB calls from these routes are still from India.

| Route | TMDB usage |
|-------|------------|
| `src/app/api/personalRecommendations/route.ts` | TMDB discover by user's top genres (from favorites/watched) |
| `src/app/api/homeVideo/route.ts` | Now playing, movie videos |
| `src/app/api/homeSearch/route.ts` | Search movie/TV/person |
| `src/app/api/movieReel/route.ts` | Keyword search, discover movie, movie details |
| `src/app/api/update-genres/route.ts` | Movie/TV details for genres |
| `src/app/api/search/route.ts` | Keyword or multi search |
| `src/app/api/searchPage/route.ts` | Discover movie, keyword search, multi search |
| `src/app/api/genreSearchtv/route.ts` | Discover TV by genre |
| `src/app/api/genreSearchmovie/route.ts` | Discover movie by genre |
| `src/app/api/tvgenrelist/route.ts` | TV genre list |
| `src/app/api/moviegenreList/route.ts` | Movie genre list |
| `src/app/api/movie/route.ts` | Discover movie |
| `src/app/api/movieRecomandation/route.ts` | Movie recommendations |

**Other API routes (no TMDB):**  
`navbar`, `userPrefrence`, `getfollower`, `getfollowing`, `omdb`, `recommendations`, `recommendations/add`, `recommendations/remove`, `recommendations/search`, `UserWatchedPagination`, `UserFavoritePagination`, `deletefavoriteButton`, `deletewatchedButton`, `deletewatchlistButton`, `favoriteButton`, `watchedButton`, `watchlistButton`, `HomeDiscover`.

---

## 3. Client-Side Fetch (all to your backend)

All client `fetch` calls target your own **internal** `/api/*` routes. **No client code calls TMDB directly.**

| Caller | Route(s) |
|--------|----------|
| `DiscoverUser.tsx` | `/api/HomeDiscover` |
| `navbar.tsx` | `/api/navbar` |
| `searchBar.tsx` | `/api/search` |
| `reelUi.tsx` | `/api/movieReel`, `/api/omdb` |
| `imdbRating.tsx` | `/api/omdb` |
| `userPrefrenceProvider.tsx` | `/api/userPrefrence`, watched/watchlist/favorite add/delete |
| `profllebtn.tsx` | `/api/getfollowing`, `/api/getfollower` |
| `seachForm.tsx` (homeDiscover) | `/api/homeSearch` |
| `videoReel.tsx` | `/api/homeVideo` |
| `search/[query]/page.tsx` | `/api/searchPage` |
| `recomendation.tsx` | `/api/recommendations`, `/api/recommendations/search`, add, remove |
| `profileWatched.tsx` | `/api/UserWatchedPagination` |
| `openaiReco.tsx` | `/api/personalRecommendations` |
| `tvbygenre/list/[id]/page.tsx` | `/api/genreSearchtv` |

---

## 4. TMDB Image URLs (no API key)

Many components use `https://image.tmdb.org/t/p/...` in `<img src>` or Next.js `Image`. These are **not** API calls but CDN URLs; they can still be affected by regional CDN/blocking in India.

Used in:  
person page, personCredits, movie/tv client components, messages, reel, search, profile components, cast pages, etc.

---

## 5. Other Notes

- **`src/proxy.ts`** – Currently only forwards to Supabase `updateSession`; it is **not** a TMDB proxy.
- **Person page** – Contains debug `fetch("http://127.0.0.1:7243/ingest/...")` calls; safe to remove for production.

---

## 6. Options for India TMDB Issue

### Option A: “Make every API call from the server” (what you suggested)

- **Current state:** All TMDB calls are already from the server (Server Components or API routes). There are no TMDB calls from the client.
- **If you mean “only via API routes”:** You can refactor so that **no** Server Component calls TMDB directly; instead they call your own `/api/tmdb/...` (or similar) routes. That gives you **one place** to later add a proxy or change backend, but **it does not by itself fix India** – those API routes still run on your server (e.g. in India).

### Option B: Run the server in a region where TMDB works (recommended)

- Deploy Next.js (e.g. Vercel) in a **non-India region** (e.g. US). All existing server-side TMDB calls (Server Components + API routes) then run from that region, which often resolves India-specific TMDB issues with no code change.

### Option C: Proxy TMDB through a non-India proxy

- In **one** place (e.g. `src/utils/tmdb.ts` or a single `/api/tmdb/proxy` route), send TMDB requests via an HTTP proxy (or a small service) running in a region where TMDB works. All other code keeps calling TMDB “through” that layer. Requires proxy setup and possibly cost.

### Option D: Centralize TMDB in API routes + optional proxy

1. Add API route(s) for TMDB, e.g. `/api/tmdb?path=...` or resource-specific routes.
2. Refactor **all** Server Components that today use `fetch("https://api.themoviedb.org/...")` or `tmdbFetchJson` to call these API routes instead.
3. Keep all TMDB logic (and optionally a proxy) inside API routes. Easiest place to later add Option C.

---

## 7. Recommended Next Steps

1. **Short term:** Prefer **Option B** (deploy server in a region where TMDB works). No refactor, quickest fix.
2. **If you must stay in India:** Use **Option D** (centralize TMDB in API routes), then add **Option C** (proxy) in that layer so all TMDB traffic goes through a non-India proxy.
3. **Cleanup:** Remove the `http://127.0.0.1:7243/ingest/...` debug fetches from `src/app/app/person/[id]/page.tsx` for production.

If you want, the next step can be a concrete refactor plan (file-by-file) to move all direct TMDB calls from Server Components into API routes (Option D).

---

## 8. Quick reference: files that call TMDB directly (for refactor)

**Server Components (raw fetch or safeFetchJson):**

- `src/app/app/page.tsx`
- `src/app/app/person/[id]/page.tsx`
- `src/app/app/tv/[id]/season/[seasonNumber]/page.tsx`
- `src/app/app/tv/[id]/season/[seasonNumber]/episode/[episodeId]/page.tsx`
- `src/app/app/tvbygenre/layout.tsx`
- `src/components/person/server/staringCredit.tsx`

**Server Components (tmdbFetchJson):**

- `src/app/app/movie/[id]/page.tsx`
- `src/app/app/movie/[id]/cast/page.tsx`
- `src/app/app/tv/[id]/page.tsx`
- `src/app/app/tv/[id]/cast/page.tsx`
- `src/app/app/moviebygenre/list/[id]/page.tsx`
- `src/app/app/moviebygenre/list/layout.tsx`

**Utility used by above:**

- `src/utils/tmdb.ts` (tmdbFetchJson) – can be switched to call your API route instead of TMDB.
