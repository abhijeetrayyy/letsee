# Letsee / Movie Social — Feature Research & Options

**Purpose:** Research globally and against your project idea to list what’s missing, what can be done, and which features would attract more users and make the app more useful and competitive.

---

## 1. What Your Project Is Today

**Letsee** (landing: “Movie Social”) is a **social movie & TV discovery app** with:

- **Discovery:** TMDB-powered home (trending, genres, Bollywood, Romance, Action), search (movies, TV, people), genre browse, reels (short-form movie clips).
- **User lists:** Watched, Favorites, Watchlist (one list each).
- **Social:** Profiles with visibility (public / followers / private), follow/followers, follow requests, notifications, DMs (text + card mix), user-to-user recommendations.
- **Content:** Movie/TV detail pages, cast, seasons/episodes, person pages, trailers, IMDB rating via OMDB.
- **Profile:** Genre stats (bar chart from watched), paginated watched/favorites/watchlist, recommendations tile.
- **Recommendations:** TMDB-based personal recommendations (genre-from-taste) on home; no AI/Google.
- **Tech:** Next.js, Supabase (auth, DB, realtime), TMDB, OMDB; deployment considerations for India (see `API_AUDIT_TMDB_AND_FETCH.md`).

**Partially built but not shipped:**

- **Where to Watch:** `watchOptionView.tsx` exists but is fully commented out; movie detail has the import commented.
- **Personal recommendations:** Section on home uses TMDB genre-based recommendations (no AI).

---

## 2. Global Benchmarks (What Users Expect)

| Feature | Letterboxd | Trakt | JustWatch | Simkl | Your app |
|--------|------------|-------|-----------|-------|----------|
| Watchlist / Favorites / Watched | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Personal rating (stars)** | ✓ | ✓ | ✓ | ✓ | ✗ (only IMDB) |
| **Personal review / diary** | ✓ | ✓ | — | ✓ | ✗ |
| **Custom lists** (multiple) | ✓ | ✓ | — | ✓ | ✗ |
| **Where to watch / streaming** | Pro | — | ✓ core | ✓ | ✗ (code exists, off) |
| **Calendar / upcoming** | — | ✓ | ✓ | ✓ | ✗ |
| **Episode-level tracking (TV)** | — | ✓ | ✓ | ✓ | ✗ |
| Follow / social / DMs | ✓ | ✓ | — | — | ✓ |
| **Activity feed** (friends’ activity) | ✓ | ✓ | — | — | ✗ |
| Notifications (follow, etc.) | ✓ | ✓ | ✓ | ✓ | ✓ (follow requests) |
| **Export / import** (e.g. CSV, Letterboxd) | ✓ | ✓ | — | — | ✗ |
| **Recommendations (personalized)** | — | ✓ | ✓ (AI) | ✓ | ✓ (TMDB genre-based on home) |
| Reels / short-form discovery | — | — | — | — | ✓ |

So compared to the market you’re **strong on**: social (follow, DMs, recommendations, visibility), reels, and unified movie + TV + person discovery. You’re **missing or weak on**: personal ratings/reviews, diary, custom lists, “where to watch,” calendar/upcoming, episode-level tracking, activity feed, and export/import.

---

## 3. What Seems to Be Missing (Gap List)

### High impact (users ask for these everywhere)

1. **Personal rating**  
   - No user rating (e.g. 1–5 or 1–10); only IMDB shown.  
   - Users expect “rate this” and to see their own rating on the card/detail.

2. **Where to watch / streaming availability**  
   - Code is in `watchOptionView.tsx` but commented out.  
   - “Where can I watch this?” is a top request; JustWatch/Simkl make this central.

3. **Activity feed**  
   - No feed of “what friends watched/rated/added.”  
   - You have follow + DMs but not “see friends’ activity” — core to Letterboxd/Trakt.

4. **Personal reviews / diary**  
   - No written review or “diary” (date watched + note).  
   - Watched has `watched_at` but no diary UX or review text.

5. **Custom lists**  
   - Only three fixed lists (watched, favorites, watchlist).  
   - Users expect “Best 2024,” “Date night,” “To show the kids,” etc.

### Medium impact (differentiation and retention)

6. **Calendar / upcoming**  
   - No “new episodes this week” or “movies releasing.”  
   - TMDB (and partners) can drive this; Trakt/Simkl do it well.

7. **TV episode-level tracking**  
   - No “mark episode as watched” or “continue watching” per show.  
   - Important for heavy TV users.

8. **Personal recommendations**  
   - TMDB genre-based recommendations are on home; no AI.

9. **Discover filters**  
   - No user-facing filters for year, country, language, “streaming on X” on discover/search (backend has some language).

10. **Notifications beyond follow requests**  
    - e.g. “Friend added X to watchlist,” “New episode of Y,” “Friend rated Z.”

### Nice to have (quality and “best” feel)

11. **Export / import**  
    - Export watched/watchlist (CSV/JSON) or import from Letterboxd/Trakt/IMDB.  
    - Builds trust and reduces lock-in.

12. **PWA / installable**  
    - No manifest/service worker mentioned; would help mobile “app-like” use.

13. **Landing / README**  
    - README is empty; landing is generic. Clear value prop and screenshots help.

14. **Accessibility & performance**  
    - No explicit a11y audit; image loading (TMDB CDN) already considered in docs.

15. **Reminders / watchlist notifications**  
    - “X is now on Netflix” or “Y released” for items in watchlist.

---

## 4. Options List: What Can Be Done

Below is a single list of **concrete options** you can implement. Each is framed so you can decide priority.

### Discovery & content

| # | Option | Why it helps |
|---|--------|--------------|
| 1 | **Ship “Where to Watch”** — Uncomment and wire `watchOptionView.tsx`, use TMDB watch/providers (and optionally user country). | Top user need; you already have the code. |
| 2 | ~~Surface AI recommendations on home~~ — Replaced with TMDB-based personal recommendations. | Done. |
| 3 | **Discover/search filters** — Add UI for year, language, genre (and optionally “where to watch” when you have providers). | Matches expectations from other apps. |
| 4 | **Calendar / upcoming** — New section or page: “In theaters,” “TV this week” using TMDB (and/or JustWatch-style data if you add it). | Keeps users coming back. |
| 5 | **Reel improvements** — More genres/moods, “continue where you left off,” or tie reels to watchlist. | Doubles down on your differentiator. |

### Lists & tracking

| # | Option | Why it helps |
|---|--------|--------------|
| 6 | **Personal rating** — Add `user_ratings` (user_id, item_id, item_type, score, optional review text); show on cards and detail; optional “your rating” vs “IMDB.” | Core expectation; enables reviews and feed. |
| 7 | **Reviews / diary** — Optional review text + “date watched” display; link from watched item to “diary entry.” | Letterboxd-like; highly engaging. |
| 8 | **Custom lists** — New table e.g. `user_lists` (name, description, visibility) + `user_list_items`; UI to create/edit/reorder and show on profile. | Power users and sharing. |
| 9 | **Episode-level watched** — Store watched episodes (e.g. `watched_episodes`: user_id, tv_id, season, episode); “Continue watching” for TV. | Critical for TV-heavy users. |

### Social & feed

| # | Option | Why it helps |
|---|--------|--------------|
| 10 | **Activity feed** — “Friend A watched X,” “B added Y to watchlist,” “C rated Z.” Store events (or derive from existing tables) and show on home or dedicated feed. | Makes follow graph useful daily. |
| 11 | **Notify on friend activity** — Extend notifications: new follow, follow request, and optionally “friend watched/rated/list add.” | Increases return visits. |
| 12 | **Public “recent activity” on profile** — Profile section showing last N watches/ratings (respecting visibility). | Complements feed and discovery. |

### Notifications & lifecycle

| # | Option | Why it helps |
|---|--------|--------------|
| 13 | **Watchlist/availability alerts** — “Movie X is now on Netflix” (requires provider data + job or webhook). | High perceived value. |
| 14 | **New episode alerts** — For shows in watchlist or watched: “New episode of Y available.” | TV retention. |

### Trust & growth

| # | Option | Why it helps |
|---|--------|--------------|
| 15 | **Export data** — Export watched/watchlist/favorites (and ratings if added) as CSV/JSON from profile/settings. | Trust and portability. |
| 16 | **Import** — Import from Letterboxd CSV or Trakt (if they offer export); map to your watched/watchlist. | Easier onboarding for existing users. |
| 17 | **README & landing** — Describe Letsee/Movie Social, main features, and “Get Started”; add 1–2 screenshots. | First impression and SEO. |
| 18 | **PWA** — manifest + service worker so the app is installable and works offline for already-visited pages (optional). | Mobile “app” feel. |

### Technical & product hygiene

| # | Option | Why it helps |
|---|--------|--------------|
| 19 | **Remove debug / dead code** — e.g. Person page `127.0.0.1:7243/ingest`; clean todo page or remove. | Cleaner and safer production. |
| 20 | **Region / India** — Keep deployment (e.g. Vercel) in a non-India region for TMDB; document in README. | Reliability (see API_AUDIT). |
| 21 | **Accessibility** — Keyboard nav, focus, alt text, basic ARIA where needed. | Wider audience and best practice. |

---

## 5. Suggested Priorities (If You Want “Best” and More Users)

**Quick wins (do first)**  
- **1** — Ship Where to Watch.  
- **2** — Personal recommendations (TMDB) on home (done).  
- **17** — README + landing copy.

**High impact (next)**  
- **6** — Personal rating (and optionally **7** — reviews/diary).  
- **10** — Activity feed.  
- **8** — Custom lists.

**Differentiation**  
- **4** — Calendar/upcoming.  
- **5** — Reel improvements.  
- **9** — Episode-level tracking (if you target TV fans).

**Trust & polish**  
- **15** — Export; later **16** — Import.  
- **18** — PWA.  
- **19–21** — Cleanup, region, a11y.

---

## 6. Summary

- **Your idea:** Social movie/TV app with follow, DMs, recommendations, reels, and lists — that’s a strong base.  
- **Globally,** the main gaps are: **personal rating/reviews**, **where to watch**, **activity feed**, **custom lists**, and **calendar/upcoming**.  
- **Already built but off:** Where to Watch (commented). Personal recommendations (TMDB) are on. Adding **ratings**, **activity feed**, and **custom lists** would make the app much more useful and competitive.  
- The list above gives you a full **options list**; you can pick by impact, effort, and whether you want to lean more “discovery” (watch, calendar, reels) or “social” (feed, notifications, reviews).

If you tell me your top 2–3 goals (e.g. “max new users,” “retention,” “TV vs movies”), I can turn this into a concrete implementation order (e.g. schema changes + API + UI) for those options.
