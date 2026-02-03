# TMDB API Call Audit

Per-page and per-route TMDB call counts and efficiency recommendations.

---

## Pages (server-rendered)

| Page | TMDB calls | Notes |
|------|------------|--------|
| **Movie detail** `/app/movie/[id]` | **6** | details, credits, videos, images, recommendations, similar. **→ Can be 1** with `append_to_response`. |
| **TV detail** `/app/tv/[id]` | **1** | Already uses `append_to_response=credits,videos,images,external_ids,recommendations,similar`. ✓ |
| **Home** `/app/page` | **7** | genres (2), trending (2), discover (3) in parallel. Fixed, reasonable. |
| **Person** `/app/person/[id]` | **4** | person, external_ids, combined_credits, images. Can use `append_to_response`. |
| **TV season** `/app/tv/[id]/season/[n]` | **2** | show+seasons, season details. |
| **TV episode** `/app/tv/[id]/season/[n]/episode/[e]` | **2** | episode+images+videos, show. |
| **Movie cast** `/app/movie/[id]/cast` | **2** | movie, credits. |
| **TV cast** `/app/tv/[id]/cast` | **2** | show, credits. |
| **Movie by genre list** `/app/moviebygenre/list/[id]` | **1** per page | discover/movie. |
| **TV by genre layout** | **1** | genre/tv/list (layout). |

---

## API routes (per request)

| Route | TMDB calls | Notes |
|-------|------------|--------|
| **Profile TV progress** `/api/profile/tv-progress` | **N** (one per show) | User with 15 shows = **15 calls**. High impact; causes ECONNRESET under load. **→ Batch/throttle + cache.** |
| **Continue watching** `/api/continue-watching` | **N** (up to 12) | One call per show. Same pattern. |
| **TV progress** `/api/tv-progress?showId=` | **1** | Single show. ✓ |
| **Home video** `/api/homeVideo` (POST) | **1 + 10** | now_playing, then videos for top 10 movies. |
| **Personal recommendations** `/api/personalRecommendations` | **N + 1** | Up to 15 movie details + 1 discover. |
| **Movie reel** `/api/movieReel` | **1–2 + N** | discover or keyword, then per-movie details for reel. |
| **Movie reel watchlist** `/api/movieReel/watchlist` | **N** | One per movie in watchlist. |
| **Watched button** (TV backfill) | **1 or K** | 1 (all episodes) or K (one per season in backfillEpisodesForSeasons). |
| **Backfill watched episodes** | **1 per show** | One call per show to backfill. |
| **Watched episode** (add first ep) | **1** | TV show details when adding first episode. |
| **Search** `/api/search` | **1** | search/multi or search/movie etc. |
| **Search page** `/api/searchPage` | **1–2** | discover or search. |
| **Calendar** `/api/calendar` | **2** | now_playing, on_the_air. |
| **Watch providers** | **1** | watch/providers. |
| **Genre lists** | **1** | genre/movie or genre/tv list. |

---

## Efficiency strategies

1. **append_to_response**  
   Use for detail pages so one request returns details + credits + videos + images + recommendations + similar.  
   - **Movie page**: 6 → 1 call.  
   - **Person page**: 4 → 1 call (person + external_ids + combined_credits + images).

2. **Cache show metadata**  
   Profile TV progress and continue-watching call TMDB once per show. Options:  
   - **Next.js `unstable_cache`** (or `cache()`): cache `GET /tv/{id}?append_to_response=seasons` by `showId`, TTL 5–10 min.  
   - **In-memory LRU**: small map keyed by showId with TTL; reduces repeated profile/continue-watching loads.  
   - **DB cache**: store show name, poster, season counts when first fetched; profile reads from DB and only hits TMDB for missing/cold data.

3. **Batch / throttle**  
   In profile TV progress (and similar routes), avoid N parallel TMDB requests. Process shows in batches of 3–5 with a small delay (e.g. 100–200 ms) between batches to reduce ECONNRESET and rate-limit pressure.

4. **Revalidate**  
   Use `revalidate` (or `next: { revalidate }`) for TMDB fetches so Next.js caches responses and avoids redundant calls for the same URL within the TTL.

5. **Lazy / client**  
   For “heavy” sections (e.g. personal recommendations, reel), consider loading after initial paint (e.g. client fetch or route handler called from client) so the critical path has fewer TMDB calls.

---

## Implemented / planned

- [x] **TV detail**: Already 1 call via append_to_response.  
- [x] **Movie detail**: One call with append_to_response + revalidate 1h.  
- [x] **Profile TV progress**: Batching (3 concurrent, 150 ms delay) + cached TV show fetch (unstable_cache 5 min).  
- [x] **Continue watching**: Batching (3 concurrent, 150 ms delay) + same cached TV show fetch.  
- [x] **Person page**: One call with append_to_response (external_ids,combined_credits,images).  
- [x] **tv-progress** (single show): Cached TV show fetch (unstable_cache 5 min).  
- [x] **Shared util** `getTvShowWithSeasons(showId)`: retry + unstable_cache 5 min; used by profile tv-progress, continue-watching, tv-progress.
- [x] **Central TMDB client** (`src/utils/tmdbClient.ts`): All TMDB requests go through `fetchTmdb` for rate limiting and robust fetch.
  - **Throttle**: max 8 concurrent TMDB requests, min 120 ms between starting new requests (stays under ~40 req/s per IP).
  - **Retry**: 429 and 5xx with backoff; respects `Retry-After` on 429.
  - **Usage**: `tmdb.ts` (tmdbFetchJson), `tmdbTvShow.ts`, `serverFetch.ts` (delegates TMDB URLs to fetchTmdb), and all API routes that call TMDB use fetchTmdb or serverFetch/tmdbFetchJson.
