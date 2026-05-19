# LetSee — Feature Catalog

> Full capability documentation for the LetSee social film/TV journal.
> Covers every feature, its logic, data flow, and file locations.

---

## Table of Contents

1. [Core Architecture](#1-core-architecture)
2. [Content Discovery](#2-content-discovery)
3. [Search System](#3-search-system)
4. [User Tracking & Lists](#4-user-tracking--lists)
5. [Ratings & Reviews](#5-ratings--reviews)
6. [Social Features](#6-social-features)
7. [Personalization & AI](#7-personalization--ai)
8. [Analytics & Dashboard](#8-analytics--dashboard)
9. [Smart Recommendations](#9-smart-recommendations)
10. [TV-Specific Features](#10-tv-specific-features)
11. [Background Jobs & Alerts](#11-background-jobs--alerts)
12. [Batch & Utility APIs](#12-batch--utility-apis)
13. [Infrastructure](#13-infrastructure)
14. [Data Model](#14-data-model)

---

## 1. Core Architecture

### Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^16.1.6 |
| UI | React + Tailwind CSS v4 | ^19.2.4 / ^4.1.18 |
| Language | TypeScript | ^5 |
| Database | Supabase (Postgres) | Managed |
| Auth | Supabase Auth | SSR |
| External APIs | TMDB, OMDB, Google Gemini | — |
| State | Redux Toolkit (minimal) + React Context | — |

### Rendering Model

- **Server Components** — data fetching, SEO, metadata (home page, detail pages, profile)
- **Client Components** — interactivity (watched toggles, search, messaging, recommendations)
- **API Routes** — BFF (Backend For Frontend). ~60 endpoints proxying TMDB, handling Supabase CRUD, and applying business logic.

### Key Architectural Decisions

- **TMDB traffic is throttled centrally** via `src/utils/tmdbClient.ts` (max 8 concurrent, 120ms gap, retry on 429/5xx). All TMDB calls route through this.
- **Supabase RLS** enforces visibility: content can be `public`, `followers`, or `private` per user.
- **Service role** (`createAdminClient()`) used for background jobs and batch operations that need to bypass RLS.

---

## 2. Content Discovery

### 2.1 Trending & Curated Sections

**Home page** (`src/app/app/page.tsx`) loads 20+ curated sections in parallel via `getHomeSections()`:

| Section | TMDB Endpoint | Logic |
|---|---|---|
| Weekly Top 20 | `/trending/movie/week` | Top 20 trending movies |
| Trending TV | `/trending/tv/week` | Top 20 trending shows |
| Anime Series | `/discover/tv?with_genres=16` | Animation genre |
| Anime Films | `/discover/movie?with_genres=16` | Animation genre |
| Romance | `/discover/movie?with_genres=10749` | Romance genre |
| Action | `/discover/movie?with_genres=28` | Action genre |
| Crime | `/discover/movie?with_genres=80` | Crime genre |
| Thriller | `/discover/movie?with_genres=53` | Thriller genre |
| Dark Zones | Custom genre mix | Horror + Thriller + Mystery |
| Horror | `/discover/movie?with_genres=27` | Horror genre |
| Bollywood | `/discover/movie?with_original_language=hi` | Hindi language |
| Movie Genres | `/genre/movie/list` | All movie genres |
| TV Genres | `/genre/tv/list` | All TV genres |

### 2.2 Browse by Tags

**File**: `src/components/home/BrowseTags.tsx`, `src/components/home/AnimeTags.tsx`

Tags are grouped into categories in `src/staticData/browseTags.ts` and `src/staticData/animeTags.ts`. Clicking a tag navigates to a filtered discover page.

### 2.3 Genre Browsing

- **Movies by genre**: `/app/moviebygenre?genre=<id>` — `src/app/app/moviebygenre/page.tsx`
- **TV by genre**: `/app/tvbygenre?genre=<id>` — `src/app/app/tvbygenre/page.tsx`
- **Genre starter page**: `/app/genre-start` — entry point for genre exploration

### 2.4 Video Reels

Short-form movie clips browsable by genre/keyword. `src/components/reel/` — fetches videos from TMDB.

### 2.5 Calendar & Upcoming

**API**: `src/app/api/calendar/route.ts` — returns "In Theaters" (now playing) and "TV This Week" (airing today on TV).

### 2.6 What to Watch (Weekend Picker)

**File**: `src/components/home/WhatToWatch.tsx`
**API**: `src/app/api/what-to-watch/route.ts`
**Data**: `src/staticData/moodMapping.ts`

**World-Class Upgrade** (commit `d62e6a5`):

**UI/UX**:
- Multi-step wizard: Mood → Refine → Results with animated step indicator
- 10 visual mood cards with gradient backgrounds, emoji, description, active checkmark
- Quick presets bar: "Surprise Me" (one-click random), Date Night, Brain Off, Family Time, Deep Thinker, Scare Night
- Thumbs up/down feedback per pick (visual only)
- Re-roll and reset buttons

**Algorithm**:
1. User selects: mood(s), genre, runtime, decade, media type.
2. Mood is mapped to TMDB genre IDs (e.g., "Thrilling" → Crime + Thriller + Mystery).
3. Filters are converted to TMDB discover params.
4. **Smart ranking** (weighted shuffle): taste-match score (40%) × genre overlap (30%) × quality (30%) → weighted probability.
5. Results are filtered against user's watched/favorited items.
6. **Session dedup**: `sessionStorage` ensures no repeat picks within a session.
7. Top 10 picks returned with per-pick reason strings ("Matches your taste", "Popular choice", etc.).

**Moods available**: Feel Good, Thrilling, Scary, Romantic, Thoughtful, Funny, Action Packed, Chill, Mind Bending, Nostalgic.

---

## 3. Search System

### 3.1 Standard Search

**Page**: `src/app/app/search/page.tsx`
**API**: `src/app/api/search/route.ts` (proxies TMDB `/search/multi`, `/search/movie`, `/search/tv`, `/search/person`, `/search/keyword`)
**URL format**: `/app/search/[query]?media_type=...&page=...`

**Features**:
- Live results with 280ms debounce
- Results categorized: Movies, TV, People, Keywords
- Recent searches stored in localStorage (max 8)
- "Browse by filters" link to advanced discover page

### 3.2 Fuzzy Re-ranking & Typo Correction

**File**: `src/utils/searchFuzzy.ts`

- **Fuse.js re-ranking**: After TMDB results arrive, they're re-ranked using Fuse.js with threshold 1.0, scoring by `title`/`name` field similarity.
- **"Did you mean?"**: Uses `fastest-levenshtein` to compute edit distance between the query and known terms. If similarity is above 0.6 but below 0.85, suggests a correction.

### 3.3 Natural Language Search

**File**: `src/components/search/NaturalSearch.tsx`
**API**: `src/app/api/search/natural/route.ts`

**World-Class Upgrade** (commit `d2edbd5`):

**Query parsing** (pattern-based, no LLM dependency):
- Genre extraction: matches against known genre names + aliases ("sci-fi" → "Science Fiction", "rom-com" → "Romance") + partial name matching
- Year patterns: `2010s` → decade, `2020` → specific year, `before 2015` / `after 2000` / `from 2010` / `since 2018` / `prior 2000` → year range
- Actor extraction: "with Leonardo DiCaprio" / "starring Keanu Reeves" / "featuring Morgan Freeman" → search TMDB person, extract ID (Acting dept)
- Director extraction: "directed by Christopher Nolan" / "director Denis Villeneuve" / "by Nolan" → search TMDB person (Directing dept)
- Rating extraction: "rated 7+" / "highly-rated" / "top-rated" / "critically-acclaimed" / "score 8+" → `vote_average.gte`
- Language extraction: "french movies" / "korean shows" / "japanese film" → `with_original_language`
- "Similar to X": "similar to Inception" / "like The Conjuring" / "recommended Avatar" → search TMDB, use recommendations endpoint
- Media type detection: "tv" / "show" / "series" → TV, default → movie
- Fallback: If no structured params extracted, runs standard TMDB text search

**Component features**:
- Rich interpretation bar: parsed filters shown as sparkle-ic `InterpretationPill` chips ("TV shows", "Science Fiction", "rated 7+", "French")
- Voice search: browser SpeechRecognition API with mic toggle, sets query on interim + auto-searches on final
- Recent searches dropdown: persisted in `localStorage`, shown on input focus
- Example chips: 8 pre-built one-click examples covering genre/year/actor/rating/language/director
- Refine in Discover button: forwards parsed genres/year to `/app/discover` for advanced filtering
- Shuffle button: re-runs same query for serendipity
- Staggered card entrance animation with rating badges
- Skeleton loading grid (5 cards) while loading
- Results count with "showing top N" indicator

**Examples**: "thriller from 2010s", "action with Keanu Reeves", "sci-fi after 2020", "horror similar to The Conjuring", "french movie rated 7+", "directed by Christopher Nolan", "top rated comedy".

### 3.4 Discover / Advanced Filters

**Page**: `/app/app/search/page.tsx` (when `media_type=movie` or `media_type=tv` in URL)
**API**: `src/app/api/search/discover/` sub-routes

Filters: media type, year range, language, genre, watch region/providers.

---

## 4. User Tracking & Lists

### 4.1 Core Tables

All defined in `schema.sql` (628 lines of Postgres schema):

| Table | Purpose | Unique Key |
|---|---|---|
| `watched_items` | Items user has watched | `(user_id, item_id)` |
| `favorite_items` | Favorited items | `(user_id, item_id)` |
| `user_watchlist` | Items to watch later | `(user_id, item_id)` |
| `currently_watching` | Items in progress | `(user_id, item_id)` |
| `user_ratings` | 1-10 scores | `(user_id, item_id)` |
| `user_tv_list` | TV show status | `(user_id, show_id)` |
| `watched_episodes` | Episode-level tracking | `(user_id, show_id, season, episode)` |
| `user_lists` | Custom named lists | — |
| `user_list_items` | Items in custom lists | `(list_id, item_id)` |
| `user_favorite_display` | Taste in 4 (profile hero) | `(user_id, position)` |

### 4.2 Watchlist

**APIs**:
- Add/remove: `src/app/api/watchlistButton/route.ts`
- Smart re-rank: `src/app/api/watchlist/smart/route.ts`

**Smart Watchlist** (`src/components/profile/SmartWatchlist.tsx`):
1. Builds a weighted genre preference profile from user's ratings.
2. For each watchlist item, predicts a 1-10 rating based on genre affinity.
3. Re-ranks watchlist by predicted rating.
4. Displays predicted score badge (green ≥7, yellow 5-6, red <5) and reason.

**Algorithm**:
- Every rated item contributes to genre profile: score normalized to [-1, +1] around 5.5.
- For watchlist items: average the genre weights, scale back to 1-10.
- Genres with more data points have higher confidence.

### 4.3 Favorites

**API**: `src/app/api/favoriteButton/route.ts`
**Display**: Genre breakdown on profile, "Taste in 4" on profile hero.

### 4.4 Watched / Diary

**API**: `src/app/api/watchedButton/route.ts` (464 lines — handles watched toggle, watchlist removal, TV episode backfill, list status management)

**Features**:
- Mark as watched with optional diary note
- Auto-remove from watchlist and currently-watching
- TV episode backfill: mark all episodes, specific episodes, or whole season
- Public reviews (distinct from private diary notes)

### 4.5 Currently Watching

**Migration**: `migrations/020_currently_watching.sql`
**Display**: `ProfileCurrentlyWatching` component on profiles.

### 4.6 Custom Lists

**CRUD**: `src/app/api/user-lists/route.ts`
**Features**: Create named lists, add/remove items, reorder by position, set visibility (public/followers/private).

---

## 5. Ratings & Reviews

### 5.1 Rating System

**Range**: 1–10
**Table**: `user_ratings` (unique per `(user_id, item_id)`)
**API**: `src/app/api/user-rating/route.ts`

### 5.2 Reviews

**Private diary notes**: `watched_items.review_text` column
**Public reviews**: `watched_items.public_review_text` column
**Visibility controls**: Per-user toggles: `profile_show_diary`, `profile_show_ratings`, `profile_show_public_reviews`

**APIs**:
- `src/app/api/watched-review/route.ts` — CRUD for reviews
- `src/app/api/profile/public-reviews/route.ts` — fetch public reviews

### 5.3 Rating Distribution Stats

**API**: `src/app/api/profile/stats/ratings/route.ts`
Returns count of each score 1–10 for a user.

---

## 6. Social Features

### 6.1 Profiles

**URL**: `/app/profile/[username]`
**Page**: `src/app/app/profile/[id]/page.tsx` (511 lines)

**Data fetched in parallel** (8+ Supabase queries):
- User info (avatar, banner, tagline, about)
- Stats (watched, favorites, watchlist, watching, followers, following)
- Follow relationship between viewer and owner
- Taste in 4 items
- Recent 10 watched items
- Yearly stats
- Highlighted list and pinned review
- TV calendar

### 6.2 Follow System

**Tables**: `user_connections` (follows), `user_follow_requests` (pending/accept/reject)
**API**: `src/app/api/getfollower/route.ts`, `src/app/api/getfollowing/route.ts`
**Helper**: `src/utils/followerAction.ts` — client-side follow/request/accept/reject

### 6.3 Activity Feed

**Component**: `src/components/profile/ActivityFeed.tsx`
**Data**: Recent watched items with `activity_type`: `watched`, `rated`, `reviewed`, `list_created`
**Display**: Poster thumbnails, item names, relative timestamps, star ratings, review snippets

### 6.4 Direct Messages

**Table**: `messages` (types: `text`, `cardmix`)
**APIs**: `src/app/api/messages/` — send, list conversations, read thread
**Card share**: Send movie/TV cards as messages via `SendMessageModal`

### 6.5 User-to-User Recommendations

**Table**: `recommendation`
**API**: `src/app/api/recommendations/route.ts`

### 6.6 Friend Compatibility Score

**File**: `src/components/profile/FriendCompatibility.tsx`
**API**: `src/app/api/compatibility/route.ts`

**Algorithm** (weighted hybrid):
1. **Genre vector similarity (60%)**: Build normalized genre vectors from watched/favorited items. Compute cosine similarity.
2. **Rating correlation (40%)**: For items both users have rated, compute Pearson correlation coefficient.
3. **Minimum threshold**: Requires ≥3 shared ratings for rating correlation to contribute.

**Output**: 0-100% match with breakdown of genre overlap and rating correlation. Displayed as a radial progress chart on other users' profiles.

### 6.7 Discover People

**Page**: `/app/profile` — browse public profiles with search/filter.

---

## 7. Personalization & AI

### 7.1 AI Recommendations (Google Gemini)

**File**: `src/components/ai/openaiReco.tsx`
**API**: `src/app/api/personalRecommendations/route.ts`

**Algorithm** (content-based):
1. Fetch user's favorite + watched movie IDs (up to 15).
2. Fetch TMDB details for each → extract genre IDs.
3. Count genre frequency → top 2 genres.
4. Call TMDB `/discover/movie` with those genres, sorted by popularity.
5. Exclude already-watched/favorited items.
6. Return up to 15 recommendations with posters and genre labels.

**Fallback**: If no watched/favorited items, defaults to Romance + Drama.

### 7.2 Collaborative Filtering

**File**: `src/components/ai/collaborativeRecs.tsx`
**API**: `src/app/api/recommendations/collaborative/route.ts`

**World-Class Upgrade** (commit `318ad89`):

**Algorithm**:
1. Build normalized genre vector for current user.
2. Sample up to 200 other users (recently active), build their genre vectors.
3. Compute cosine similarity to each, keep those with similarity > 0.15.
4. From top 20 similar users, collect items they rated ≥ 7/10.
5. **Recency bonus**: items with ratings in the last 90 days get a 15% score boost (per recent-user ratio).
6. Weight recommendations by adjusted score, then user count.
7. Exclude items user has already watched/favorited.
8. Return up to 15 recommendations with avg score, user count, recency flag, and genre match tags.

**Output**:
- **Similar users row**: up to 6 user avatars with similarity %, display name, and top genre — shown as clickable chips
- **Per-recommendation match tags**: genre badges (e.g., "Action", "Sci-Fi") showing why each item was recommended, based on intersection with user's top genres
- **Recency indicator**: green "Recent" label on items with recent ratings
- **User count footer**: number of similar users who rated it highly
- **Taste summary**: header shows "Based on your taste in Action, Drama, Sci-Fi"
- **Auto-loads** on mount instead of requiring button click; refresh button preserved
- **Skeleton loading** grid (5 animated cards) during fetch
- **Staggered card entrance** animation (60ms delay per card)

**Edge cases**: Note messages for no data, no similar users, or all items consumed.

### 7.3 "Because You Watched X"

**File**: `src/components/movie/BecauseYouWatched.tsx`
**API**: `src/app/api/recommendations/because-you-watched/route.ts`

**World-Class Upgrade** (commit `9f03b83`):

**Algorithm** (hybrid content + personalization):
1. Fetch current item's genres + TMDB recommendations/similar list.
2. Build user's weighted genre preference from their ratings (score centered at 5.5).
3. For each candidate: score by genre match with user preference (70%) + genre overlap with current item (30%).
4. Return top 12 scored items with per-genre breakdown, match score, and match reason.

**API response enhancements**:
- `genreBreakdown: { genre: string; weight: number }[]` — per-item genre match details showing each matching genre and the user's preference weight
- `overview` — truncated overview text (300 chars) for inline preview
- `sharedGenreCount` — number of genres matching user's taste
- `currentTitle` — name of the item being viewed
- `userTopGenres` — user's top 4 preferred genres (shown in section header)

**UI/UX upgrades**:
- **Genre breakdown tooltip**: hover a card (400ms delay) to see a detailed popover with each matching genre, a weight bar, and the numeric weight value
- **One-click add to watchlist**: hover-reveal `+` button on each card that calls `POST /api/watchlistButton` with optimistic UI update (checkmark after added)
- **Inline overview preview**: click the info icon on a card to see the item's overview in a popover above the card
- **Match score bar**: thin color-coded progress bar under each poster (green ≥70, yellow ≥40, gray <40)
- **Match score badge**: pill showing "N% match" with consistent color coding
- **Section subtitle**: shows "Matched by [top genres]" when available
- **Dynamic section title**: "Because you watched [item name]" when name is available

### 7.4 Personal Recommendations (TMDB-based)

**API**: `src/app/api/personalRecommendations/route.ts`
Simpler content-based: genre frequency → top genres → discover popular in those genres.

---

## 8. Analytics & Dashboard

### 8.1 Personal Viewing Dashboard

**File**: `src/components/profile/ViewingDashboard.tsx`
**API**: `src/app/api/profile/stats/dashboard/route.ts`

**World-Class Upgrade** (commit `a202c94`):

**Visualization**:
- All bar charts replaced with **Chart.js** (via `react-chartjs-2`): monthly activity, yearly (stacked movie/TV), weekday habits, top genres (horizontal), rating distribution
- Tooltips on hover, gradient bar colors, animated entrance, responsive sizing
- Glassmorphism cards with gradient borders and backdrop blur

**New sections**:
- **Year in Review** card: dedicated highlight reel for the current year showing movies, shows, hours, days watched, top genre, best month, favorite weekday, top 3 rated items, genres explored. Exportable as PNG via `html2canvas`.
- **Streaks** card re-styled alongside favorites/watchlist count in a 4-card row

**Export**:
- "Export" button in header captures full dashboard as PNG using `html2canvas` (2x scale)
- Year-in-Review card has its own dedicated export button

**API**:
- Added `yearInReview` section to dashboard response (current year only): `moviesThisYear`, `tvThisYear`, `totalHoursThisYear`, `distinctGenresCount`, `topGenreThisYear`, `topRatedThisYear[]`, `mostWatchedMonth`, `mostWatchedDay`, `totalDaysWatched`

**Data returned** (single consolidated endpoint):

| Section | Data Points | Computation |
|---|---|---|
| **Overview** | Movies, TV, Episodes, Total Hours | Count queries + estimation (movies × 2h, episodes × 45min) |
| **Genre Breakdown** | Top 8 genres with count and % | Aggregate genre arrays from watched_items |
| **Rating Distribution** | Count per score 1–10 | Aggregate user_ratings |
| **Yearly Activity** | Items/year with movie/TV split | Group watched_at by year |
| **Monthly Activity** | Items/month (current year) | Group watched_at by month |
| **Weekday Distribution** | Items per day of week | Group watched_at by getDay() |
| **Viewing Streaks** | Current and longest streak (days) | Sort unique dates, count consecutive windows within 2-day gaps |
| **Avg Rating per Genre** | Average score per genre | Cross-reference ratings with watched_items genres |
| **Top Rated** | Top 5 highest-scored items | Sort user_ratings desc, join against watched for names |
| **TV Completion** | Completed / total / % | From user_tv_list status |
| **Year in Review** | Current year highlight reel | Filtered watched items + ratings for current year only |

### 8.2 Profile Stats (Legacy)

Individual stat endpoints:
- `src/app/api/profile/stats/genres/route.ts` — top 10 genres by count
- `src/app/api/profile/stats/ratings/route.ts` — rating distribution
- `src/app/api/profile/stats/years/route.ts` — yearly activity

### 8.3 StatisticsGenre Component

`src/components/profile/statisticsGenre.tsx` — renders genre breakdown as bar chart (server component).

---

## 9. Smart Recommendations

### 9.1 Smart Watchlist

**File**: `src/components/profile/SmartWatchlist.tsx`
**API**: `src/app/api/watchlist/smart/route.ts`

**World-Class Upgrade** (pending commit):

**Algorithm**:
1. Fetch user's ratings + watched genres.
2. Build genre profile: for each genre, compute normalized weight from rated scores.
3. For each watchlist item, predict rating = 5.5 + avg(genre weights × 2), clamped to [1, 10].
4. Sort by predicted rating descending.
5. Show taste profile (top affinities) and per-item reason badges.

**UI/UX upgrades**:
- **Drag-to-reorder**: HTML5 native drag-and-drop. Items can be dragged within the grid to reorder. Order is persisted in `localStorage` keyed by user ID. "Reset" button restores predicted-rating sort.
- **Batch actions**: "Select" toggle button enters batch mode with checkboxes on each card. "Select all" / "Deselect all" controls. "Remove selected" button calls `POST /api/deletewatchlistButton` for each item with optimistic UI.
- **Predicted rating distribution histogram**: CSS bar chart at the top grouping items into 5 buckets (1-3, 3-5, 5-7, 7-9, 9-10) with a summary line showing "% of items are high confidence (7+)".
- **Inline remove button**: Per-item trash icon on hover that optimistically removes from the list and calls the delete API.
- **Staggered card entrance animation** (60ms delay per card).
- Drag handle icon, sort indicators, glassmorphism card styling.

### 9.2 TV Completion Predictor

**File**: `src/components/tv/CompletionPredictor.tsx`
**API**: `src/app/api/tv/completion-predictor/route.ts`

**Algorithm**:
1. Fetch user's "watching" TV shows from `user_tv_list`.
2. For each show: get TMDB details (total episodes, seasons).
3. Count watched episodes from `watched_episodes`.
4. Calculate watch velocity: episodes per day (first watched → now).
5. Estimate remaining days: `remaining / episodesPerDay`.
6. Predict completion date.

**Output**: Urgency badges ("Almost done!" if ≤3 days, "2 weeks left" if ≤14), progress bars, pace indicator.

### 9.3 Franchise/Universe Tracker

**File**: `src/components/profile/FranchiseTracker.tsx`
**API**: `src/app/api/franchises/route.ts`
**Data**: `src/staticData/franchises.ts`

**8 Franchises**: MCU (40 entries), Star Wars (11), Harry Potter (11), Middle-earth (6), John Wick (4), Dark Knight (3), Mission: Impossible (7), Conjuring (8).

**Algorithm**:
1. Cross-reference user's watched/favorited items against franchise entry TMDB IDs.
2. Compute completion % per franchise.
3. Identify next unwatched entry.
4. Return progress with expandable checklist.

---

## 10. TV-Specific Features

### 10.1 Episode Tracking

**Table**: `watched_episodes` — tracks per `(user_id, show_id, season_number, episode_number)`
**APIs**:
- `src/app/api/watched-episode/route.ts` — mark single episode watched/unwatched
- `src/app/api/watched-episodes-bulk/route.ts` — batch mark episodes
- `src/app/api/backfill-watched-episodes/route.ts` — backfill all episodes for a show
- `src/app/api/tv-progress/route.ts` — get progress for all shows

### 10.2 TV List Status

**Table**: `user_tv_list` — status per show
**Statuses**: `watching`, `completed`, `on_hold`, `dropped`, `plan_to_watch`
**API**: `src/app/api/tv-list-status/route.ts`

### 10.3 Continue Watching

**Component**: `src/components/home/ContinueWatchingSection.tsx` — shows in-progress TV with progress bars and "mark next episode" button.
**API**: `src/app/api/continue-watching/route.ts`

### 10.4 TV Season Accordion

**Component**: `src/components/tv/TvSeasonAccordion.tsx` — expandable season list with episode-level checkmarks.

### 10.5 Episode Ratings

**Table**: `episode_ratings` (migration 023)
**Component**: `src/components/tv/EpisodeRating.tsx`

### 10.6 Episode Notes

**Component**: `src/components/tv/EpisodeNote.tsx` — per-episode private notes.

### 10.7 TV Calendar

**Component**: `src/components/profile/TvCalendarView.tsx` — calendar view of TV episode airing schedule.

---

## 11. Background Jobs & Alerts

### 11.1 Job Queue System

**Migration**: `migrations/024_background_jobs.sql`

**Tables**:
- `background_jobs` — job queue with status, attempts, scheduling
- `user_notification_prefs` — per-user notification opt-ins
- `watchlist_alerts` — alert history for streaming availability

**Utility**: `src/utils/jobRunner.ts`

**Functions**:
- `scheduleJob(jobType, payload, options)` — insert a job into queue
- `claimNextJob()` — atomically claim next pending job (for cron runners)
- `completeJob(jobId, result)` — mark job succeeded
- `failJob(jobId, error)` — mark job failed
- `dispatchJob(jobId, jobType, payload)` — route to registered handler
- `registerJobHandler(jobType, handler)` — register a handler function

### 11.2 Streaming Availability Checker

**File**: `src/utils/jobs/availabilityChecker.ts`
**Cron endpoint**: `src/app/api/cron/check-availability/route.ts`
**Cron endpoint**: `src/app/api/cron/run-jobs/route.ts` (processes 5 jobs per invocation)

**Algorithm**:
1. Query `user_notification_prefs` for users opted into streaming alerts.
2. For each user, iterate their watchlist items.
3. Fetch TMDB watch provider data (`/movie/{id}/watch/providers`).
4. Check which streaming/rent/buy providers have this item.
5. If a new provider is found (not previously alerted), insert into `watchlist_alerts`.
6. Returns count of items checked and new alerts created.

**Security**: CRON endpoints protected by `CRON_SECRET` Bearer token.

### 11.3 Notification Prefs

**Table**: `user_notification_prefs`
**Options**: `notify_streaming_changes`, `notify_new_episodes`, `notify_friend_activity`, `notify_digest` (never/daily/weekly).

---

## 12. Batch & Utility APIs

### 12.1 Batch Operations

**API**: `src/app/api/batch/route.ts`

**Supported actions**:

| Action | Body | Effect |
|---|---|---|
| `mark-watched` | `{ items: BatchItem[] }` | Upsert multiple items as watched |
| `add-watchlist` | `{ items: BatchItem[] }` | Upsert to watchlist |
| `remove-watchlist` | `{ items: BatchItem[] }` | Delete from watchlist by item_id |
| `mark-episodes` | `{ episodes: BatchEpisode[] }` | Upsert multiple watched episodes |

All operations authenticated, run within a single request.

### 12.2 Standardized API Responses

**File**: `src/utils/apiResponse.ts`
- `jsonSuccess(data, options)` — 200 with Cache-Control headers
- `jsonError(message, status)` — error with `no-store` cache

---

## 13. Infrastructure

### Deployment

- **Platform**: Vercel (region: `iad1` — US East)
- **Database**: Supabase (managed Postgres with RLS)
- **Auth**: Supabase Auth (SSR with cookie-based session management)

### Configuration

- `next.config.mjs` — TMDB image remote pattern, build config
- `vercel.json` — deployment region
- `.env.local` — API keys (Supabase, TMDB, OMDB, Google Gemini)
- `tsconfig.json` — path aliases (`@/*` → `src/*`, `@components/*` → `src/components/*`)

### PWA

Service worker (`public/sw.js`) + manifest (`public/manifest.json`). Registered via `src/components/pwa/RegisterServiceWorker.tsx`.

### Session Management

**Middleware**: `src/utils/supabase/middleware.ts`
- Refreshes Supabase auth cookies on every page navigation.
- Redirects: root (`/`) → `/app`, auth pages → `/app` if logged in, profile setup if no username.

---

## 14. Data Model

### Custom Enums

- `visibility_level`: `public` | `followers` | `private`
- `message_type`: `text` | `cardmix`
- `follow_request_status`: `pending` | `accepted` | `rejected`
- `job_status`: `pending` | `running` | `completed` | `failed`

### Core Tables

| Table | Key Fields | RLS |
|---|---|---|
| `users` | `id, username, email, avatar_url, banner_url, tagline, visibility` | Self-managed, public profile readable |
| `user_cout_stats` | `watched_count, favorites_count, watchlist_count, watching_count` | Public read, self write |
| `watched_items` | `item_id, item_type, genres, watched_at, review_text, public_review_text` | Self CRUD, profile-visible select |
| `favorite_items` | `item_id, item_type, genres` | Self CRUD, profile-visible select |
| `user_watchlist` | `item_id, item_type` | Self CRUD, profile-visible select |
| `currently_watching` | `item_id, item_type, started_at` | Self CRUD, profile-visible select |
| `user_ratings` | `item_id, item_type, score (1-10)` | Self CRUD, profile-visible select |
| `messages` | `sender_id, recipient_id, content, message_type, metadata, is_read` | Participants only |
| `user_connections` | `follower_id, followed_id` | Public read, self insert/delete |
| `user_follow_requests` | `sender_id, receiver_id, status` | Participants only |
| `recommendation` | `user_id, item_id, item_type` | Self CRUD |
| `user_lists` | `name, description, visibility` | Owner CRUD, visibility-gated select |
| `user_list_items` | `list_id, item_id, position` | List-visibility-gated |
| `user_favorite_display` | `position (1-4), item_id, item_type` | Public read, self write |
| `watched_episodes` | `show_id, season_number, episode_number` | Self CRUD, public read |
| `user_tv_list` | `show_id, status (watching/completed/on_hold/dropped/plan_to_watch)` | Self CRUD, profile-visible |
| `background_jobs` | `job_type, payload, status, attempts, max_attempts` | Service role only |
| `user_notification_prefs` | `notify_*` booleans, `notify_digest` | Self manage |
| `watchlist_alerts` | `item_id, provider_name, alert_type` | Self read |

### RLS Helper Function

`profile_visible_to_viewer(owner_user_id)` — returns true if:
- Owner's visibility is `public` (or null), OR
- Owner's visibility is `followers` AND viewer is following the owner

---

## File Index

All significant files organized by area:

### APIs (~60 endpoints)

```
src/app/api/
├── search/
│   ├── route.ts                    # Standard TMDB search proxy
│   └── natural/route.ts            # Natural language query parsing
├── movie/                          # Movie data proxy
├── tv/                             
│   ├── completion-predictor/route.ts  # TV finish date prediction
│   ├── progress/route.ts           # TV show progress
│   └── [sub-routes]                # Seasons, episodes, status
├── profile/
│   ├── route.ts / [sub-routes]     # Profile data, settings
│   └── stats/
│       ├── genres/route.ts         # Genre breakdown
│       ├── ratings/route.ts        # Rating distribution
│       ├── years/route.ts          # Yearly activity
│       └── dashboard/route.ts      # Consolidated dashboard
├── recommendations/
│   ├── collaborative/route.ts      # Collaborative filtering
│   ├── because-you-watched/route.ts # Personalized detail page recs
│   └── route.ts                    # User-to-user recs
├── watchlist/
│   └── smart/route.ts              # Predicted-rating re-rank
├── what-to-watch/route.ts          # Mood-based picker
├── batch/route.ts                  # Bulk operations
├── compatibility/route.ts          # Friend taste match
├── franchises/route.ts             # Franchise progress
├── cron/
│   ├── check-availability/route.ts # Streaming alerts
│   └── run-jobs/route.ts           # Job queue processor
└── [other]                         # Follow, messages, ratings, etc.
```

### Components (~25 directories)

```
src/components/
├── ai/
│   ├── openaiReco.tsx              # AI recommendations UI
│   └── collaborativeRecs.tsx       # Collaborative filtering UI
├── home/
│   ├── WhatToWatch.tsx             # Mood-based picker UI
│   ├── BrowseTags.tsx              
│   ├── AnimeTags.tsx
│   └── [Calendar, ContinueWatching, Discover, Video]
├── movie/
│   ├── BecauseYouWatched.tsx       # Detail page recs tile
│   ├── recoTiles.tsx               # Generic reco carousel
│   └── [MovieCast, Video, Ratings, Reviews]
├── tv/
│   ├── CompletionPredictor.tsx     # TV ETA forecast
│   ├── TvProgressWidget.tsx
│   └── [Season accordion, Episodes, Status]
├── profile/
│   ├── ViewingDashboard.tsx        # Full analytics display
│   ├── SmartWatchlist.tsx          # Ranked watchlist
│   ├── FriendCompatibility.tsx     # % match display
│   ├── FranchiseTracker.tsx        # Franchise progress
│   ├── StatsSection.tsx            # Legacy stats
│   └── [Hero, Tabs, Lists, Reviews, FilmDiary, etc.]
├── search/
│   └── NaturalSearch.tsx           # NL search UI
├── cards/                          # MediaCard, card variants
└── ui/                             # LoadingSpinner, FetchError, etc.
```

### Utilities

```
src/utils/
├── tmdbClient.ts                   # Central TMDB throttle + retry
├── tmdb.ts                         # Typed TMDB wrapper
├── serverFetch.ts                  # Server fetch with timeout+retry
├── supabase/
│   ├── client.ts                   # Browser Supabase client
│   ├── server.ts                   # Server + admin Supabase client
│   └── middleware.ts               # Auth middleware
├── searchFuzzy.ts                  # Fuse.js re-rank + Levenshtein
├── searchUrl.ts                    # Canonical search URL builder
├── homeData.ts                     # Home page data fetcher
├── apiResponse.ts                  # Standardized response helpers
├── jobRunner.ts                    # Background job queue system
└── jobs/
    └── availabilityChecker.ts      # Streaming alert job
```

### Static Data

```
src/staticData/
├── genreList.ts                    # TMDB genre ID ↔ name mapping
├── browseTags.ts                   # Browse tag categories
├── animeTags.ts                    # Anime-specific tags
├── moodMapping.ts                  # Mood → genre/keyword mapping
├── franchises.ts                   # Franchise entry definitions
└── countryName.ts                  # Country ISO code mapping
```

### Database

```
schema.sql                           # Full consolidated schema
schema_from_supabase.sql             # Dumped from Supabase
migrations/
├── 007-023                          # Sequential migrations
└── 024_background_jobs.sql          # Job queue + alerts
```
