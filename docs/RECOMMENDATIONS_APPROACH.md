# Recommendations: Approach & Best Choice

**Purpose:** Clarify how recommendations work, what TMDB offers vs AI, and why the chosen approach is the right one for Letsee.

---

## 1. What TMDB Offers (No AI, No Extra Key)

TMDB does **not** have a single “recommend by genre” endpoint. It gives you building blocks:

| TMDB feature | What it does | Where we use it |
|--------------|--------------|------------------|
| **Discover** `GET /discover/movie` | Filter by `with_genres`, `sort_by` (popularity, vote_average, release_date), `vote_count.gte`, year, language, etc. | Home sections (Romance, Action, Bollywood), genre pages, movie reel |
| **Movie recommendations** `GET /movie/{id}/recommendations` | “Because you watched X” — similar movies to one title | Movie detail page (“More like this”) |
| **Similar movies** `GET /movie/{id}/similar` | Same idea, slightly different algorithm | Can be used like recommendations |

So **“recommendations by genre”** in TMDB terms = use **Discover** with `with_genres=...` and optional filters. There is no separate “recommendation by genre” API; it’s discover with genre filters.

---

## 2. Current Setup

- **Personal recommendations** `GET /api/personalRecommendations`: TMDB-based, genre-from-taste (see below). Used on the home “Your personal recommendations” section.
- **TMDB per-movie** `/api/movieRecomandation` + movie detail page: For a given movie ID, returns TMDB’s “recommendations” for that movie. Used on movie/[id] and in reco tiles. This is **“similar to this movie”**, not “by genre” and not “from your whole taste”.
- **AI (Google/Gemini)** has been removed; recommendations are TMDB-only.

---

## 3. Best Approach: TMDB-Based Personal Recommendations (Primary)

**Idea:** Derive the user’s **preferred genres** from their watched and favorite **movies**, then use TMDB **Discover** with those genres and exclude titles they already have.

**Logic:**

1. Get the user’s favorite + watched **movie** `item_id`s from Supabase.
2. For a limited set (e.g. 10–15 movies), fetch each movie’s details from TMDB (`GET /movie/{id}`) to get `genre_ids`.
3. Aggregate: count how often each genre appears → “top genres” for this user.
4. Call `GET /discover/movie` with:
   - `with_genres` = top 1–2 genres (or a fallback like Romance + Drama if no data),
   - `sort_by=popularity.desc`,
   - `vote_count.gte=50`,
   - and **exclude** movie IDs already in watched + favorite.
5. Return the first 10–15 results.

**Why this is the right choice:**

- **No extra API key:** Only TMDB (and your existing Supabase). No Google/Gemini required.
- **Compatible:** Same stack as the rest of the app; works with your India/TMDB strategy (server in a non-India region).
- **Predictable:** No LLM variability; results are “popular in your favorite genres” and exclude what they’ve already seen/favorited.
- **Justified:** “Because you like these genres (from your lists)” is a standard, understandable recommendation logic and matches how TMDB is designed (discover by genre + filters).

---

## 4. Summary

| Question | Answer |
|----------|--------|
| Does TMDB give “recommendations by genre”? | Not as a dedicated endpoint. You get **Discover** with `with_genres` and **per-movie** recommendations/similar. “By genre” = discover with genre filters. |
| Best approach? | **TMDB-based personal recommendations**: infer genres from user’s watched/favorites, then discover with those genres and exclude known IDs. |
| AI (Gemini)? | Removed. Recommendations are TMDB-only; no Google API key required. |
| Right choice? | Yes: one key (TMDB), same infra, clear logic (“based on your favorite genres”). |

---

## 5. Implementation Summary

- **API:** `GET /api/personalRecommendations` — auth required; returns movies from TMDB Discover using user’s top genres (from favorite + watched movies), excluding already watched/favorited.
- **Home section:** “Your personal recommendations” uses this TMDB-based API only.
- **UI:** Single “Get recommendations” button; no AI option.
