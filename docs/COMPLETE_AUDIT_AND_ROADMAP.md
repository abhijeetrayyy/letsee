# LetSee — Complete Audit & Overhaul Roadmap

> **Social Film Journal** — Track. Review. Connect.
> Framework: Next.js 16 (App Router) · Supabase (PostgreSQL + RLS) · TMDB API · Tailwind CSS v4

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Industry Benchmark Comparison](#2-industry-benchmark-comparison)
3. [Complete File Inventory](#3-complete-file-inventory)
4. [Route Audit — Every Page](#4-route-audit--every-page)
5. [API Route Audit](#5-api-route-audit)
6. [Component Audit](#6-component-audit)
7. [UI/UX Audit](#7-uiux-audit)
8. [Missing Pages & Features](#8-missing-pages--features)
9. [Innovative Feature Proposals](#9-innovative-feature-proposals)
10. [User Journey & Flow](#10-user-journey--flow)
11. [Prioritized Overhaul Roadmap](#11-prioritized-overhaul-roadmap)

---

## 1. Current State Summary

### What Works Well
- **Movie/TV Detail Pages** — Comprehensive data from TMDB, cast, crew, videos, images, reviews
- **TV Episode Tracking** — Episode-level watched status, ratings, notes, progress tracking
- **Social Features** — Follow system, activity feed, DMs, reactions, friend compatibility scoring
- **Profile System** — Film diary, reviews, watched grid, lists, TV progress, stats dashboard, taste profile, year-in-review
- **Search System** — Debounced search, fuzzy matching, natural language search, advanced filters
- **Recommendations** — AI-powered (OpenAI), collaborative filtering, "Because You Watched", smart watchlist
- **Authentication** — Supabase Auth with email confirmation, password reset, profile setup flow

### What Needs Work
- **Home page** — 25+ sections, overwhelming, no visual hierarchy, too many genre carousels
- **Navbar** — Was basic, now redesigned with glass-morphism
- **Landing page** — Static marketing page, no interactive elements
- **Missing pages** — No dedicated feed, stats, calendar, lists index, settings, reactions browsing
- **Profile page** — Massive, could use better organization and loading states
- **Mobile experience** — Some components don't translate well to small screens
- **Performance** — Multiple parallel API calls on home page, no streaming yet

---

## 2. Industry Benchmark Comparison

### Letterboxd
| Feature | Letterboxd | LetSee | Gap |
|---|---|---|---|
| Film diary | ✅ Rich, date-based, tags | ✅ Date-based with notes | Minor — add tags, custom lists per entry |
| Reviews | ✅ Rich text, spoilers, likes | ✅ Text + reactions | Minor — add rich text editor |
| Lists | ✅ User-created, curated | ✅ User-created | Minor — add list curation tools |
| Stats | ✅ Annual wrap, charts | ✅ Dashboard with charts | Minor — add annual wrap page |
| Social | ✅ Follow, activity, comments | ✅ Follow, activity, DMs | Minor — add comments on activities |
| Discovery | ✅ Popular, trending, lists | ✅ Home page sections | Major — needs better curation |
| Mobile | ✅ Excellent native apps | ⚠️ Responsive web only | Major — PWA exists but limited |
| Watchlist | ✅ With smart sorting | ✅ With smart predictions | Minor — add custom sorting |

### IMDb
| Feature | IMDb | LetSee | Gap |
|---|---|---|---|
| Ratings | ✅ 1-10 stars, weighted | ✅ 1-10 scale | Minor — add weighted average |
| Reviews | ✅ User + critic reviews | ✅ User reviews only | Minor — add critic review aggregation |
| Watchlist | ✅ Basic list | ✅ With smart predictions | LetSee ahead |
| Lists | ✅ Community lists | ✅ User lists | Comparable |
| News/Trailers | ✅ Extensive | ⚠️ Basic video embeds | Major — add news feed |
| Box Office | ✅ Real-time data | ❌ Missing | Major — add box office section |
| Charts | ✅ Top 250, born today | ⚠️ Weekly top only | Major — add more charts |

### Trakt.tv
| Feature | Trakt | LetSee | Gap |
|---|---|---|---|
| TV Tracking | ✅ Episode-level scrobbling | ✅ Episode-level manual | Minor — add auto-scrobble |
| Stats | ✅ Extensive charts | ✅ Dashboard charts | Comparable |
| Social | ✅ Friends, activity | ✅ Friends, activity, DMs | LetSee ahead |
| Recommendations | ✅ Personalized | ✅ AI + collaborative | LetSee ahead |
| Calendar | ✅ Release calendar | ✅ Home section | Minor — dedicated page needed |
| Watch Providers | ✅ Streaming availability | ✅ With region selector | Comparable |

### TMDB (The Movie Database)
| Feature | TMDB | LetSee | Gap |
|---|---|---|---|
| Browse | ✅ Extensive filters | ✅ Search with filters | Comparable |
| Collections | ✅ Movie collections | ✅ Collection banners | Comparable |
| Lists | ✅ Community lists | ✅ User lists | Comparable |
| Discussions | ✅ Forums | ❌ Missing | Major — add discussions |

### What LetSee Does Better
- **Social-first design** — DMs, friend compatibility, activity feed
- **AI recommendations** — OpenAI-powered personalized picks
- **Collaborative filtering** — "People like you also like"
- **TV episode tracking** — Manual but detailed episode-level progress
- **Taste profile** — Genre vector analysis, loves/avoids
- **Smart watchlist** — Predicted ratings based on genre preferences
- **Natural language search** — "Show me scary movies from the 90s"

---

## 3. Complete File Inventory

### Pages (Routes)

| # | Route | File | Type | Status | Priority |
|---|---|---|---|---|---|
| 1 | `/` | `src/app/page.tsx` | Server | ✅ Working | Medium — needs redesign |
| 2 | `/login` | `src/app/login/page.tsx` | Server | ✅ Working | Low |
| 3 | `/signup` | `src/app/signup/page.tsx` | Server | ✅ Working | Low |
| 4 | `/forgot-password` | `src/app/forgot-password/page.tsx` | Client | ✅ Working | Low |
| 5 | `/update-password` | `src/app/update-password/page.tsx` | Server | ✅ Working | Low |
| 6 | `/app` | `src/app/app/page.tsx` | Server | ✅ Working | **High** — needs restructure |
| 7 | `/app/search` | `src/app/app/search/page.tsx` | Client | ✅ Working | Medium — needs polish |
| 8 | `/app/search/[query]` | `src/app/app/search/[query]/page.tsx` | Client | ✅ Working | Medium |
| 9 | `/app/movie/[id]` | `src/app/app/movie/[id]/page.tsx` | Server | ✅ Working | **High** — needs redesign |
| 10 | `/app/movie/[id]/cast` | `src/app/app/movie/[id]/cast/page.tsx` | Server | ✅ Working | Low |
| 11 | `/app/tv/[id]` | `src/app/app/tv/[id]/page.tsx` | Server | ✅ Working | **High** — needs redesign |
| 12 | `/app/tv/[id]/cast` | `src/app/app/tv/[id]/cast/page.tsx` | Server | ✅ Working | Low |
| 13 | `/app/tv/[id]/season/[seasonNumber]` | `src/app/app/tv/[id]/season/[seasonNumber]/page.tsx` | Server | ✅ Working | Medium |
| 14 | `/app/tv/[id]/season/[seasonNumber]/episode/[episodeId]` | `src/app/app/tv/[id]/season/[seasonNumber]/episode/[episodeId]/page.tsx` | Server | ✅ Working | Medium |
| 15 | `/app/person` | `src/app/app/person/page.tsx` | Server | ✅ Working (redirect) | Low |
| 16 | `/app/person/[id]` | `src/app/app/person/[id]/page.tsx` | Server | ✅ Working | Medium |
| 17 | `/app/profile` | `src/app/app/profile/page.tsx` | Server | ✅ Working | Medium |
| 18 | `/app/profile/[id]` | `src/app/app/profile/[id]/page.tsx` | Server | ✅ Working | **High** — massive page |
| 19 | `/app/profile/setup` | `src/app/app/profile/setup/page.tsx` | Client | ✅ Working | Low |
| 20 | `/app/messages` | `src/app/app/messages/page.tsx` | Server | ✅ Working | Medium |
| 21 | `/app/messages/[id]` | `src/app/app/messages/[id]/page.tsx` | Client | ✅ Working | Medium |
| 22 | `/app/notification` | `src/app/app/notification/page.tsx` | Client | ✅ Working | Low |
| 23 | `/app/admin` | `src/app/app/admin/page.tsx` | Server | ⚠️ Placeholder | Low |
| 24 | `/app/genre-start` | `src/app/app/genre-start/page.tsx` | Client | ✅ Working (utility) | Low |
| 25 | `/app/reel` | `src/app/app/reel/page.tsx` | Server | ✅ Working | Medium |
| 26 | `/app/private` | `src/app/app/private/page.tsx` | Server | ✅ Working (test) | Low |
| 27 | `/app/lists/[listId]` | `src/app/app/lists/[listId]/page.tsx` | Server | ✅ Working | Medium |
| 28 | `/app/moviebygenre/list/[id]` | `src/app/app/moviebygenre/list/[id]/page.tsx` | Server | ✅ Working | Low |
| 29 | `/app/tvbygenre/list/[id]` | `src/app/app/tvbygenre/list/[id]/page.tsx` | Client | ✅ Working | Low |

### Special Files

| # | File | Type | Status |
|---|---|---|---|
| 30 | `src/app/layout.tsx` | Server | ✅ Root layout |
| 31 | `src/app/error.tsx` | Client | ✅ Error boundary |
| 32 | `src/app/not-found.tsx` | Server | ✅ 404 page |
| 33 | `src/app/app/layout.tsx` | Server | ✅ App layout |
| 34 | `src/app/app/loading.tsx` | Server | ✅ Loading spinner |
| 35 | `src/app/app/search/layout.tsx` | Server | ✅ Passthrough |
| 36 | `src/app/app/movie/[id]/loading.tsx` | Server | ✅ Loading |
| 37 | `src/app/app/tv/[id]/loading.tsx` | Server | ✅ Loading |
| 38 | `src/app/app/person/[id]/loading.tsx` | Server | ✅ Loading |
| 39 | `src/app/app/profile/loading.tsx` | Server | ✅ Loading |
| 40 | `src/app/app/profile/[id]/loading.tsx` | Server | ✅ Loading |
| 41 | `src/app/app/moviebygenre/list/layout.tsx` | Server | ✅ Layout |
| 42 | `src/app/app/tvbygenre/layout.tsx` | Server | ✅ Layout |

### API Routes (60+)

| # | Endpoint | Methods | Status | Priority |
|---|---|---|---|---|
| 1 | `/api/search` | GET | ✅ Working | High |
| 2 | `/api/searchPage` | POST | ✅ Working | High |
| 3 | `/api/search/natural` | GET | ✅ Working | Medium |
| 4 | `/api/homeHero` | GET | ✅ Working | High |
| 5 | `/api/homeVideo` | POST | ✅ Working | High |
| 6 | `/api/HomeDiscover` | GET | ✅ Working | Low |
| 7 | `/api/navbar` | GET | ✅ Working | High |
| 8 | `/api/calendar` | GET | ✅ Working | Medium |
| 9 | `/api/what-to-watch` | GET | ✅ Working | Medium |
| 10 | `/api/userPrefrence` | GET | ✅ Working | High |
| 11 | `/api/watchedButton` | POST | ✅ Working | High |
| 12 | `/api/deletewatchedButton` | POST | ✅ Working | High |
| 13 | `/api/favoriteButton` | POST | ✅ Working | High |
| 14 | `/api/deletefavoriteButton` | POST | ✅ Working | High |
| 15 | `/api/watchlistButton` | POST | ✅ Working | High |
| 16 | `/api/deletewatchlistButton` | POST | ✅ Working | High |
| 17 | `/api/watchingButton` | POST | ✅ Working | High |
| 18 | `/api/deletewatchingButton` | POST | ✅ Working | High |
| 19 | `/api/movie` | GET | ✅ Working | High |
| 20 | `/api/tv` | GET | ✅ Working | High |
| 21 | `/api/moviegenreList` | GET | ✅ Working | Low |
| 22 | `/api/tvgenrelist` | GET | ✅ Working | Low |
| 23 | `/api/movieRecomandation` | GET | ✅ Working | Medium |
| 24 | `/api/movieReel` | GET | ✅ Working | Medium |
| 25 | `/api/movieReel/watchlist` | GET | ✅ Working | Low |
| 26 | `/api/tv-seasons` | GET | ✅ Working | Medium |
| 27 | `/api/tv-progress` | GET | ✅ Working | Medium |
| 28 | `/api/tv-list-status` | GET/PATCH | ✅ Working | Medium |
| 29 | `/api/tv/completion-predictor` | GET | ✅ Working | Medium |
| 30 | `/api/update-genres` | POST | ✅ Working | Low |
| 31 | `/api/omdb` | GET | ✅ Working | Low |
| 32 | `/api/watch-providers` | GET | ✅ Working | Medium |
| 33 | `/api/watch-providers/list` | GET | ✅ Working | Medium |
| 34 | `/api/watched-episodes` | GET | ✅ Working | High |
| 35 | `/api/watched-episode` | GET/POST | ✅ Working | High |
| 36 | `/api/watched-episodes-bulk` | POST | ✅ Working | Medium |
| 37 | `/api/watched-episodes/bulk-delete` | POST | ✅ Working | Medium |
| 38 | `/api/watched-episodes/mark-up-to` | POST | ✅ Working | Medium |
| 39 | `/api/backfill-watched-episodes` | POST | ✅ Working | Low |
| 40 | `/api/episode-rating` | GET/PATCH | ✅ Working | Medium |
| 41 | `/api/profile/settings` | GET/PATCH | ✅ Working | Medium |
| 42 | `/api/profile/film-diary` | GET | ✅ Working | High |
| 43 | `/api/profile/public-reviews` | GET | ✅ Working | Medium |
| 44 | `/api/profile/reviews-ratings-diary` | GET | ✅ Working | Medium |
| 45 | `/api/profile/favorite-display` | GET | ✅ Working | Medium |
| 46 | `/api/profile/watched-with-reviews` | GET | ✅ Working | Medium |
| 47 | `/api/profile/tv-progress` | GET | ✅ Working | Medium |
| 48 | `/api/profile/tv-calendar` | GET | ✅ Working | Low |
| 49 | `/api/profile/stats/dashboard` | GET | ✅ Working | High |
| 50 | `/api/profile/stats/genres` | GET | ✅ Working | Medium |
| 51 | `/api/profile/stats/ratings` | GET | ✅ Working | Medium |
| 52 | `/api/profile/stats/years` | GET | ✅ Working | Medium |
| 53 | `/api/profile/debug-rls` | GET | ✅ Working | Low |
| 54 | `/api/feed/following` | GET | ✅ Working | High |
| 55 | `/api/activity-feed` | GET | ✅ Working | Medium |
| 56 | `/api/notifications` | GET/PATCH | ✅ Working | High |
| 57 | `/api/reactions/toggle` | GET/POST | ✅ Working | Medium |
| 58 | `/api/compatibility` | GET | ✅ Working | Medium |
| 59 | `/api/getfollower` | GET | ✅ Working | Medium |
| 60 | `/api/getfollowing` | GET | ✅ Working | Medium |
| 61 | `/api/friends-watched` | GET | ✅ Working | Medium |
| 62 | `/api/recommendations` | POST | ✅ Working | High |
| 63 | `/api/recommendations/add` | POST | ✅ Working | Medium |
| 64 | `/api/recommendations/remove` | POST | ✅ Working | Medium |
| 65 | `/api/recommendations/search` | GET | ✅ Working | Medium |
| 66 | `/api/recommendations/because-you-watched` | GET | ✅ Working | Medium |
| 67 | `/api/recommendations/collaborative` | GET | ✅ Working | Medium |
| 68 | `/api/personalRecommendations` | GET | ✅ Working | High |
| 69 | `/api/AiRecommendation` | GET | ✅ Working | Medium |
| 70 | `/api/user-lists` | GET/POST | ✅ Working | High |
| 71 | `/api/user-lists/[id]` | GET/PATCH/DELETE | ✅ Working | Medium |
| 72 | `/api/user-lists/[id]/items` | GET/POST/DELETE | ✅ Working | Medium |
| 73 | `/api/watchlist/smart` | GET | ✅ Working | Medium |
| 74 | `/api/user-rating` | GET/POST | ✅ Working | Medium |
| 75 | `/api/rating-distribution` | GET | ✅ Working | Medium |
| 76 | `/api/watched-review` | GET/POST/DELETE | ✅ Working | Medium |
| 77 | `/api/reviews` | GET/POST/DELETE | ✅ Working | Medium |
| 78 | `/api/UserWatchedPagination` | GET | ✅ Working | Medium |
| 79 | `/api/UserFavoritePagination` | GET | ✅ Working | Medium |
| 80 | `/api/batch` | POST | ✅ Working | Low |
| 81 | `/api/cron/check-availability` | GET | ✅ Working | Low |
| 82 | `/api/cron/run-jobs` | GET | ✅ Working | Low |
| 83 | `/api/poll/questions` | — | ❌ Empty dir | Low |
| 84 | `/api/poll/responses` | — | ❌ Empty dir | Low |
| 85 | `/api/franchises` | GET | ✅ Working | Low |
| 86 | `/api/currently-watching` | GET | ✅ Working | Medium |
| 87 | `/api/continue-watching` | GET | ✅ Working | Medium |
| 88 | `/api/genreSearchmovie` | POST | ✅ Working | Medium |
| 89 | `/api/genreSearchtv` | POST | ✅ Working | Medium |
| 90 | `/api/homeSearch` | GET | ✅ Working | Low |
| 91 | `/api/auth/confirm` | GET | ✅ Working | High |

### Context Providers

| # | File | Provider | Status |
|---|---|---|---|
| 1 | `src/app/contextAPI/AuthProvider.tsx` | AuthProvider | ✅ Working |
| 2 | `src/app/contextAPI/countryContext.tsx` | CountryProvider | ✅ Working |
| 3 | `src/app/contextAPI/searchContext.tsx` | SearchProvider | ✅ Working |
| 4 | `src/app/contextAPI/userPrefrenceProvider.tsx` | UserPrefrenceProvider | ✅ Working |

### Hooks

| # | File | Hook | Status |
|---|---|---|---|
| 1 | `src/hooks/useApiFetch.ts` | useApiFetch | ✅ Working |

### Components (100+)

#### Header (8 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/header/navbar.tsx` | ✅ Redesigned | Done |
| 2 | `src/components/header/searchBar.tsx` | ✅ Redesigned | Done |
| 3 | `src/components/header/BurgerMenu.tsx` | ✅ Working | Low |
| 4 | `src/components/header/CountrySelector.tsx` | ✅ Working | Low |
| 5 | `src/components/header/dropDownMenu.tsx` | ✅ Working | Low |
| 6 | `src/components/header/MessageButton.tsx` | ✅ Working | Low |
| 7 | `src/components/header/RealtimeNotification.tsx` | ✅ Working | Low |
| 8 | `src/components/header/RealtimeUnreadCount.tsx` | ✅ Working | Low |

#### Home (8 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/home/videoReel.tsx` | ✅ Redesigned | Done |
| 2 | `src/components/home/ContinueWatchingSection.tsx` | ✅ Updated | Done |
| 3 | `src/components/home/CalendarSection.tsx` | ✅ Updated | Done |
| 4 | `src/components/home/WhatToWatch.tsx` | ✅ Updated | Done |
| 5 | `src/components/home/DiscoverUser.tsx` | ✅ Updated | Done |
| 6 | `src/components/home/CurrentlyWatchingSection.tsx` | ✅ Updated | Done |
| 7 | `src/components/home/BrowseTags.tsx` | ✅ Updated | Done |
| 8 | `src/components/home/AnimeTags.tsx` | ✅ Updated | Done |

#### Detail (6 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/detail/FriendsWhoWatched.tsx` | ✅ Updated | Done |
| 2 | `src/components/detail/RatingDistribution.tsx` | ✅ Updated | Done |
| 3 | `src/components/detail/CollectionBanner.tsx` | ✅ Working | Low |
| 4 | `src/components/detail/KeywordTags.tsx` | ✅ Updated | Done |
| 5 | `src/components/detail/ContentAdvisory.tsx` | ✅ Working | Low |
| 6 | `src/components/detail/SectionNav.tsx` | ✅ Working | Low |

#### Movie (9 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/movie/MovieCast.tsx` | ✅ Updated | Done |
| 2 | `src/components/movie/Video.tsx` | ✅ Updated | Done |
| 3 | `src/components/movie/UserRating.tsx` | ✅ Updated | Done |
| 4 | `src/components/movie/WatchedReview.tsx` | ✅ Updated | Done |
| 5 | `src/components/movie/PublicReviews.tsx` | ✅ Updated | Done |
| 6 | `src/components/movie/BecauseYouWatched.tsx` | ✅ Working | Low |
| 7 | `src/components/movie/homeContentTile.tsx` | ✅ Working | Low |
| 8 | `src/components/movie/imdbRating.tsx` | ✅ Working | Low |
| 9 | `src/components/movie/recoTiles.tsx` | ✅ Working | Low |

#### Profile (36 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/profile/ProfileHeroNew.tsx` | ✅ Working | Medium |
| 2 | `src/components/profile/ProfileTabsNew.tsx` | ✅ Working | Medium |
| 3 | `src/components/profile/FilmDiary.tsx` | ✅ Working | Medium |
| 4 | `src/components/profile/WatchedGrid.tsx` | ✅ Working | Medium |
| 5 | `src/components/profile/ReviewsSection.tsx` | ✅ Working | Medium |
| 6 | `src/components/profile/ListsSection.tsx` | ✅ Working | Medium |
| 7 | `src/components/profile/ProfileTvProgress.tsx` | ✅ Working | Medium |
| 8 | `src/components/profile/ViewingDashboard.tsx` | ✅ Working | Medium |
| 9 | `src/components/profile/StatsSection.tsx` | ✅ Working | Medium |
| 10 | `src/components/profile/ActivityFeed.tsx` | ✅ Working | Medium |
| 11 | `src/components/profile/TasteSummary.tsx` | ✅ Working | Low |
| 12 | `src/components/profile/TasteInFourStrip.tsx` | ✅ Working | Low |
| 13 | `src/components/profile/FriendCompatibility.tsx` | ✅ Working | Low |
| 14 | `src/components/profile/ProfileYearInReview.tsx` | ✅ Working | Low |
| 15 | `src/components/profile/ProfileHighlights.tsx` | ✅ Working | Low |
| 16 | `src/components/profile/ProfileCompletenessBar.tsx` | ✅ Working | Low |
| 17 | `src/components/profile/ProfileAvatar.tsx` | ✅ Working | Low |
| 18 | `src/components/profile/ProfileBanner.tsx` | ✅ Working | Low |
| 19 | `src/components/profile/ProfileStatsStrip.tsx` | ✅ Working | Low |
| 20 | `src/components/profile/ProfileFavorite.tsx` | ✅ Working | Low |
| 21 | `src/components/profile/ProfileWatchlater.tsx` | ✅ Working | Low |
| 22 | `src/components/profile/ProfileCurrentlyWatching.tsx` | ✅ Working | Low |
| 23 | `src/components/profile/ProfilePublicReviews.tsx` | ✅ Working | Low |
| 24 | `src/components/profile/ProfileLists.tsx` | ✅ Working | Low |
| 25 | `src/components/profile/ProfileAnimeSection.tsx` | ✅ Working | Low |
| 26 | `src/components/profile/ProfileReviewsRatingsDiaryRows.tsx` | ✅ Working | Low |
| 27 | `src/components/profile/RecentActivityStrip.tsx` | ✅ Working | Low |
| 28 | `src/components/profile/SearchAndFilters.tsx` | ✅ Working | Low |
| 29 | `src/components/profile/SmartWatchlist.tsx` | ✅ Working | Low |
| 30 | `src/components/profile/statisticsGenre.tsx` | ✅ Working | Low |
| 31 | `src/components/profile/BarChart.tsx` | ✅ Working | Low |
| 32 | `src/components/profile/CreateListModal.tsx` | ✅ Working | Low |
| 33 | `src/components/profile/EditTasteInFour.tsx` | ✅ Working | Low |
| 34 | `src/components/profile/FranchiseTracker.tsx` | ✅ Working | Low |
| 35 | `src/components/profile/ListDetail.tsx` | ✅ Working | Low |
| 36 | `src/components/profile/StickySectionNav.tsx` | ✅ Working | Low |
| 37 | `src/components/profile/UserConnections.tsx` | ✅ Working | Low |
| 38 | `src/components/profile/UserIntrectionBtn.tsx` | ✅ Working | Low |
| 39 | `src/components/profile/VisibilityGate.tsx` | ✅ Working | Low |
| 40 | `src/components/profile/visibility.tsx` | ✅ Working | Low |
| 41 | `src/components/profile/profllebtn.tsx` | ✅ Working | Low |
| 42 | `src/components/profile/profileContent.tsx` | ✅ Working | Low |
| 43 | `src/components/profile/ProfileHero.tsx` | ⚠️ Legacy | Low |
| 44 | `src/components/profile/ProfileTabs.tsx` | ⚠️ Legacy | Low |
| 45 | `src/components/profile/TvCalendarView.tsx` | ✅ Working | Low |
| 46 | `src/components/profile/TvShowCard.tsx` | ✅ Working | Low |
| 47 | `src/components/profile/recomendation.tsx` | ✅ Working | Low |

#### TV (12 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/tv/CompletionPredictor.tsx` | ✅ Working | Medium |
| 2 | `src/components/tv/EpisodeListWithWatched.tsx` | ✅ Working | Medium |
| 3 | `src/components/tv/MarkEpisodeWatched.tsx` | ✅ Working | Medium |
| 4 | `src/components/tv/EpisodeRating.tsx` | ✅ Working | Medium |
| 5 | `src/components/tv/EpisodeNote.tsx` | ✅ Working | Medium |
| 6 | `src/components/tv/MarkTVWatchedModal.tsx` | ✅ Working | Medium |
| 7 | `src/components/tv/EditTvProgressModal.tsx` | ✅ Working | Low |
| 8 | `src/components/tv/EpisodeManagementModal.tsx` | ✅ Working | Low |
| 9 | `src/components/tv/TvProgressWidget.tsx` | ✅ Working | Low |
| 10 | `src/components/tv/TvSeasonAccordion.tsx` | ✅ Working | Low |
| 11 | `src/components/tv/TvShowProgress.tsx` | ✅ Working | Low |
| 12 | `src/components/tv/TvStatusSelector.tsx` | ✅ Working | Low |

#### Cards (5 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/cards/MediaCard.tsx` | ✅ Redesigned | Done |
| 2 | `src/components/cards/cardMeter.tsx` | ✅ Working | Low |
| 3 | `src/components/cards/cardMovie.tsx` | ✅ Working | Low |
| 4 | `src/components/cards/cardProfile.tsx` | ✅ Working | Low |
| 5 | `src/components/cards/chineCard.tsx` | ✅ Working | Low |

#### Feed (2 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/feed/FollowingFeed.tsx` | ✅ Updated | Done |
| 2 | `src/components/feed/ActivityCard.tsx` | ✅ Working | Medium |

#### AI (2 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/ai/openaiReco.tsx` | ✅ Updated | Done |
| 2 | `src/components/ai/collaborativeRecs.tsx` | ✅ Updated | Done |

#### Buttons (5 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/buttons/button.tsx` | ✅ Working | Low |
| 2 | `src/components/buttons/cardButtons.tsx` | ✅ Working | Low |
| 3 | `src/components/buttons/threePrefrencebtn.tsx` | ✅ Working | Medium |
| 4 | `src/components/buttons/serchbygenreBtn.tsx` | ✅ Working | Low |
| 5 | `src/components/buttons/signOut.tsx` | ✅ Working | Low |

#### Scroll (3 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/scroll/movieGenre.tsx` | ✅ Working | Low |
| 2 | `src/components/scroll/tvGenre.tsx` | ✅ Working | Low |
| 3 | `src/components/scroll/arrowbuttonScroll.tsx` | ✅ Working | Low |

#### Person (5 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/person/KnowFor.tsx` | ✅ Working | Low |
| 2 | `src/components/person/PersonPhotos.tsx` | ✅ Working | Low |
| 3 | `src/components/person/client/Biography.tsx` | ✅ Working | Low |
| 4 | `src/components/person/server/personCredits.tsx` | ✅ Working | Low |
| 5 | `src/components/person/server/staringCredit.tsx` | ✅ Working | Low |

#### Reel (2 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/reel/reelUi.tsx` | ✅ Working | Medium |
| 2 | `src/components/reel/reelGrid.tsx` | ✅ Working | Low |

#### Search (1 file)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/search/NaturalSearch.tsx` | ✅ Working | Medium |

#### Other (10 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/message/sendCard.tsx` | ✅ Working | Low |
| 2 | `src/components/reactions/LikeButton.tsx` | ✅ Working | Medium |
| 3 | `src/components/ui/FetchError.tsx` | ✅ Working | Low |
| 4 | `src/components/ui/LoadingSpinner.tsx` | ✅ Working | Low |
| 5 | `src/components/ui/ScrollToTop.tsx` | ✅ Working | Low |
| 6 | `src/components/toast/ToastHandler.tsx` | ✅ Working | Low |
| 7 | `src/components/pwa/RegisterServiceWorker.tsx` | ✅ Working | Low |
| 8 | `src/components/guide/logornot.tsx` | ✅ Working | Low |
| 9 | `src/components/login/loginform.tsx` | ✅ Working | Low |
| 10 | `src/components/setupComponents/SetupComp.tsx` | ✅ Working | Low |

#### Client Components (13 files)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/clientComponent/movie.tsx` | ✅ Redesigned | Done |
| 2 | `src/components/clientComponent/tv.tsx` | ✅ Redesigned | Done |
| 3 | `src/components/clientComponent/ImaeViewer.tsx` | ✅ Working | Low |
| 4 | `src/components/clientComponent/imageViewEpisode.tsx` | ✅ Working | Low |
| 5 | `src/components/clientComponent/Loadingspin.tsx` | ✅ Working | Low |
| 6 | `src/components/clientComponent/moviebyGenre.tsx` | ✅ Working | Low |
| 7 | `src/components/clientComponent/topTv.tsx` | ✅ Working | Low |
| 8 | `src/components/clientComponent/tvbyGenre.tsx` | ✅ Working | Low |
| 9 | `src/components/clientComponent/update_password.tsx` | ✅ Working | Low |
| 10 | `src/components/clientComponent/videoEpisode.tsx` | ✅ Working | Low |
| 11 | `src/components/clientComponent/watchOptionView.tsx` | ✅ Working | Low |
| 12 | `src/components/clientComponent/weeklyTop.tsx` | ✅ Working | Low |

#### HomeDiscover (1 file)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/homeDiscover/client/seachForm.tsx` | ✅ Working | Low |

#### Server Components (1 file)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `src/components/server/genreConvert.tsx` | ✅ Working | Low |

#### Root Components (1 file)
| # | File | Status | Priority |
|---|---|---|---|
| 1 | `ShowCount.tsx` | ✅ Working | Low |

### Utilities (13 files)
| # | File | Status |
|---|---|---|
| 1 | `src/utils/apiResponse.ts` | ✅ Working |
| 2 | `src/utils/followerAction.ts` | ✅ Working |
| 3 | `src/utils/homeData.ts` | ✅ Working |
| 4 | `src/utils/jobRunner.ts` | ✅ Working |
| 5 | `src/utils/jobs/availabilityChecker.ts` | ✅ Working |
| 6 | `src/utils/searchFuzzy.ts` | ✅ Working |
| 7 | `src/utils/searchUrl.ts` | ✅ Working |
| 8 | `src/utils/serverFetch.ts` | ✅ Working |
| 9 | `src/utils/supabase/client.ts` | ✅ Working |
| 10 | `src/utils/supabase/middleware.ts` | ✅ Working |
| 11 | `src/utils/supabase/server.ts` | ✅ Working |
| 12 | `src/utils/tasteProfile.ts` | ✅ Working |
| 13 | `src/utils/tmdb.ts` | ✅ Working |
| 14 | `src/utils/tmdbClient.ts` | ✅ Working |
| 15 | `src/utils/tmdbTvShow.ts` | ✅ Working |

### Static Data (6 files)
| # | File | Status |
|---|---|---|
| 1 | `src/staticData/animeTags.ts` | ✅ Working |
| 2 | `src/staticData/browseTags.ts` | ✅ Working |
| 3 | `src/staticData/countryName.ts` | ✅ Working |
| 4 | `src/staticData/franchises.ts` | ✅ Working |
| 5 | `src/staticData/genreList.ts` | ✅ Working |
| 6 | `src/staticData/moodMapping.ts` | ✅ Working |

---

## 4. Route Audit — Every Page

### 4.1 Landing Page (`/`)
**Current:** Static marketing page with hero, features grid, social proof, CTA, footer
**Issues:** No interactivity, doesn't showcase the app's capabilities, no dynamic content
**Recommendation:** Add animated hero with movie backdrop, live stats from TMDB, testimonial carousel, interactive feature preview

### 4.2 Auth Pages (`/login`, `/signup`, `/forgot-password`, `/update-password`)
**Current:** Functional auth forms with Supabase
**Issues:** Basic styling, no social login, no password strength meter, no email verification flow UI
**Recommendation:** Add social login (Google, Apple), password strength indicator, email verification page, magic link option

### 4.3 Home Dashboard (`/app`)
**Current:** 25+ sections, hero video reel, continue watching, TV predictor, mood picker, following feed, AI recs, collaborative recs, discover people, calendar, weekly top, trending TV, browse tags, anime sections, 7 genre collections, genre browsers
**Issues:** Overwhelming number of sections, no visual hierarchy, too many genre carousels, no personalization of section order, no "quick actions" area
**Recommendation:** See Section 11 for detailed restructure plan

### 4.4 Search (`/app/search`)
**Current:** Debounced search with fuzzy matching, recent searches, natural language toggle
**Issues:** No trending searches, no category shortcuts in modal, no voice search UI feedback
**Recommendation:** Add trending searches, category pills, voice search indicator, search history with date

### 4.5 Search Results (`/app/search/[query]`)
**Current:** Full results with filters, pagination, MediaCard grid
**Issues:** No sort options, no watch provider filter in results, no "save search" feature
**Recommendation:** Add sort by (popularity, rating, release date, title), save searches, export results

### 4.6 Movie Detail (`/app/movie/[id]`)
**Current:** Hero with backdrop, poster, overview, details, ratings, reviews, cast, videos, images, recommendations, similar, keywords, collection banner
**Issues:** Too much content above the fold, no quick rating from hero, no "where to watch" prominence
**Recommendation:** Add streaming provider badges in hero, quick rate button, watch trailer modal, share button with social options

### 4.7 TV Detail (`/app/tv/[id]`)
**Current:** Similar to movie detail with seasons carousel, episode tracking
**Issues:** Season navigation could be better, no episode calendar view, no binge timer
**Recommendation:** Add season accordion, binge timer, episode calendar, "next episode" countdown

### 4.8 Season Detail (`/app/tv/[id]/season/[seasonNumber]`)
**Current:** Season poster, overview, episode list, all seasons grid
**Issues:** No progress visualization, no "mark all watched" for season
**Recommendation:** Add progress bar, mark season watched, episode sorting

### 4.9 Episode Detail (`/app/tv/[id]/season/[seasonNumber]/episode/[episodeId]`)
**Current:** Episode still, overview, runtime, rating, mark watched, rating, notes, prev/next nav, gallery, video, guest stars, crew
**Issues:** Good coverage, could use more interactive features
**Recommendation:** Add episode discussion, timestamped notes, rewatch counter

### 4.10 Person Detail (`/app/person/[id]`)
**Current:** Profile photo, name, department, social links, bio, known-for, photos, full credits timeline
**Issues:** Credits timeline could be filterable, no filmography stats
**Recommendation:** Add filterable credits (by role, year, rating), filmography stats, collaboration network

### 4.11 Profile (`/app/profile/[id]`)
**Current:** Massive page with hero, stats, taste profile, year-in-review, tabs (diary, reviews, films, lists, series, dashboard, stats, activity)
**Issues:** Too much content, slow loading, no skeleton states, tabs could be reorganized
**Recommendation:** Add lazy loading per tab, skeleton states, reorganize tabs, add shareable profile card

### 4.12 Messages (`/app/messages`, `/app/messages/[id]`)
**Current:** Conversation list, real-time chat with card sharing
**Issues:** No message search, no media preview in chat, no typing indicator
**Recommendation:** Add message search, media previews, typing indicators, read receipts

### 4.13 Notifications (`/app/notification`)
**Current:** Notifications + follow requests, accept/reject, mark all read
**Issues:** No notification preferences, no notification categories
**Recommendation:** Add notification settings, categories (social, activity, recommendations), push notifications

### 4.14 Lists (`/app/lists/[listId]`)
**Current:** List detail view
**Issues:** No list index page, no list creation from home, no list collaboration
**Recommendation:** Add list index, collaborative lists, list templates, list sharing

### 4.15 Genre Pages (`/app/moviebygenre/list/[id]`, `/app/tvbygenre/list/[id]`)
**Current:** Paginated grid of movies/TV by genre
**Issues:** Basic layout, no filtering within genre
**Recommendation:** Add sort, filter by year/rating, grid/list view toggle

### 4.16 Reel (`/app/reel`)
**Current:** TikTok-style video interface
**Issues:** Limited content source, no engagement features
**Recommendation:** Add like/comment on reels, share reels, create reels

### 4.17 Profile Setup (`/app/profile/setup`)
**Current:** Tabbed settings (profile, privacy, display, account)
**Issues:** Account deletion not implemented, no data export
**Recommendation:** Implement account deletion, add data export, add notification preferences

---

## 5. API Route Audit

### 5.1 Search & Discovery (5 endpoints)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/search` | ✅ Good | Could add caching headers optimization |
| `/api/searchPage` | ✅ Good | Supports discover filters well |
| `/api/search/natural` | ✅ Good | Parser could be expanded with more aliases |
| `/api/homeSearch` | ⚠️ Low usage | Consider merging with `/api/search` |
| `/api/genreSearchmovie` | ✅ Good | |
| `/api/genreSearchtv` | ✅ Good | |

### 5.2 Home Page Data (5 endpoints)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/homeHero` | ✅ Good | Romance/drama only — could be personalized |
| `/api/homeVideo` | ✅ Good | |
| `/api/HomeDiscover` | ⚠️ Low usage | |
| `/api/navbar` | ✅ Good | |
| `/api/calendar` | ✅ Good | |
| `/api/what-to-watch` | ✅ Good | |

### 5.3 User Preferences (8 endpoints)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/userPrefrence` | ✅ Good | Core endpoint |
| `/api/watchedButton` | ✅ Good | Handles TV backfill well |
| `/api/deletewatchedButton` | ✅ Good | |
| `/api/favoriteButton` | ✅ Good | |
| `/api/deletefavoriteButton` | ✅ Good | |
| `/api/watchlistButton` | ✅ Good | |
| `/api/deletewatchlistButton` | ✅ Good | |
| `/api/watchingButton` | ✅ Good | |
| `/api/deletewatchingButton` | ✅ Good | |

### 5.4 TV Episodes (7 endpoints)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/watched-episodes` | ✅ Good | |
| `/api/watched-episode` | ✅ Good | |
| `/api/watched-episodes-bulk` | ✅ Good | |
| `/api/watched-episodes/bulk-delete` | ✅ Good | |
| `/api/watched-episodes/mark-up-to` | ✅ Good | |
| `/api/backfill-watched-episodes` | ✅ Good | |
| `/api/episode-rating` | ✅ Good | |

### 5.5 Profile & Stats (13 endpoints)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/profile/settings` | ✅ Good | |
| `/api/profile/film-diary` | ✅ Good | |
| `/api/profile/public-reviews` | ✅ Good | |
| `/api/profile/reviews-ratings-diary` | ✅ Good | |
| `/api/profile/favorite-display` | ✅ Good | |
| `/api/profile/watched-with-reviews` | ✅ Good | |
| `/api/profile/tv-progress` | ✅ Good | |
| `/api/profile/tv-calendar` | ✅ Good | |
| `/api/profile/stats/dashboard` | ✅ Good | Comprehensive stats |
| `/api/profile/stats/genres` | ✅ Good | |
| `/api/profile/stats/ratings` | ✅ Good | |
| `/api/profile/stats/years` | ✅ Good | |
| `/api/profile/debug-rls` | ⚠️ Debug only | Remove in production |

### 5.6 Social (8 endpoints)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/feed/following` | ✅ Good | Supplements with popular users |
| `/api/activity-feed` | ✅ Good | |
| `/api/notifications` | ✅ Good | |
| `/api/reactions/toggle` | ✅ Good | |
| `/api/compatibility` | ✅ Good | Cosine + Pearson |
| `/api/getfollower` | ✅ Good | |
| `/api/getfollowing` | ✅ Good | |
| `/api/friends-watched` | ✅ Good | |

### 5.7 Recommendations (8 endpoints)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/recommendations` | ✅ Good | |
| `/api/recommendations/add` | ✅ Good | |
| `/api/recommendations/remove` | ✅ Good | |
| `/api/recommendations/search` | ✅ Good | |
| `/api/recommendations/because-you-watched` | ✅ Good | |
| `/api/recommendations/collaborative` | ✅ Good | |
| `/api/personalRecommendations` | ✅ Good | |
| `/api/AiRecommendation` | ✅ Good | OpenAI-powered |

### 5.8 Lists (3 endpoints)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/user-lists` | ✅ Good | GET + POST |
| `/api/user-lists/[id]` | ✅ Good | |
| `/api/user-lists/[id]/items` | ✅ Good | |

### 5.9 Other (15 endpoints)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/watchlist/smart` | ✅ Good | Predicted ratings |
| `/api/user-rating` | ✅ Good | |
| `/api/rating-distribution` | ✅ Good | |
| `/api/watched-review` | ✅ Good | |
| `/api/reviews` | ✅ Good | |
| `/api/UserWatchedPagination` | ✅ Good | |
| `/api/UserFavoritePagination` | ✅ Good | |
| `/api/batch` | ✅ Good | |
| `/api/cron/check-availability` | ✅ Good | |
| `/api/cron/run-jobs` | ✅ Good | |
| `/api/poll/questions` | ❌ Empty | No implementation |
| `/api/poll/responses` | ❌ Empty | No implementation |
| `/api/franchises` | ✅ Good | |
| `/api/currently-watching` | ✅ Good | |
| `/api/continue-watching` | ✅ Good | |

---

## 6. Component Audit

### 6.1 Components Needing Redesign (Priority Order)
1. **`ActivityCard.tsx`** — Activity feed cards need better visual hierarchy
2. **`reelUi.tsx`** — Reel interface needs engagement features
3. **`NaturalSearch.tsx`** — Natural language search UI needs polish
4. **`threePrefrencebtn.tsx`** — Core interaction button, needs visual upgrade
5. **`ProfileHeroNew.tsx`** — Profile hero could use better layout
6. **`ProfileTabsNew.tsx`** — Tab navigation could be more intuitive
7. **`FilmDiary.tsx`** — Diary grid needs better card design
8. **`WatchedGrid.tsx`** — Watched grid needs sorting/filtering
9. **`ViewingDashboard.tsx`** — Charts need better styling
10. **`BurgerMenu.tsx`** — Mobile menu needs redesign

### 6.2 Components in Good Shape
- All detail section components (FriendsWhoWatched, RatingDistribution, etc.)
- All TV episode components
- All AI recommendation components
- All header components (after redesign)
- All home section components (after update)
- MediaCard (after redesign)

### 6.3 Legacy Components to Remove
- `ProfileHero.tsx` — Replaced by `ProfileHeroNew.tsx`
- `ProfileTabs.tsx` — Replaced by `ProfileTabsNew.tsx`
- `cardMovie.tsx` — Superseded by `MediaCard.tsx`
- `chineCard.tsx` — Unused or redundant
- `cardMeter.tsx` — Unused or redundant
- `topTv.tsx` — Superseded by home sections
- `weeklyTop.tsx` — Superseded by home sections

---

## 7. UI/UX Audit

### 7.1 Design System (Current)
**Colors:**
- Brand: Green (`#22c55e`) — used for primary actions, accents
- Surface: 950-100 scale — dark mode backgrounds
- Accent: Gold (`#f5c518`) — ratings, IMDb
- Accent: Purple — section icons
- Accent: Blue, Rose, Cyan, Amber — section-specific icons

**Typography:**
- Font: Geist Sans (primary), Geist Mono (code)
- Section headers: `text-xl sm:text-2xl font-bold tracking-tight`
- Body: `text-sm text-surface-400 leading-relaxed`

**Spacing:**
- Container: `max-w-7xl mx-auto px-4 sm:px-6`
- Section gap: `gap-10 sm:gap-14`
- Card padding: `p-5`

**Components:**
- Buttons: `btn-primary` (green gradient pill), `btn-secondary` (glass pill), `btn-ghost`, `btn-danger`
- Cards: `card-accent` (glass with top accent bar), `glass-card`
- Pills: `pill-glass` (translucent rounded-full)
- Badges: `badge-brand` (green outlined)
- Chips: `chip-surface` (dark rounded-full)

### 7.2 UI Issues Found
1. **Inconsistent icon usage** — Some sections use icon-in-box, some use accent bar, some use inline icons
2. **Too many colors** — Section icons use rose, purple, amber, cyan, blue, brand — creates visual noise
3. **No loading states** — Many components lack skeleton loaders
4. **No empty states** — Missing "no data" illustrations
5. **No error boundaries** — Components fail silently or show generic errors
6. **Mobile responsiveness** — Some carousels don't work well on small screens
7. **No dark/light toggle** — Hardcoded dark mode only
8. **No accessibility audit** — Missing ARIA labels, focus management, screen reader support

### 7.3 UX Issues Found
1. **Home page overwhelm** — 25+ sections, user doesn't know where to look
2. **No onboarding** — New users land on home page with no guidance
3. **No search from mobile** — Search icon only, no inline search
4. **Profile page too heavy** — Loads everything at once, no lazy loading
5. **No keyboard shortcuts** — Power users would benefit from shortcuts
6. **No "back to top"** — Long pages are hard to navigate
7. **No content warnings** — Adult content shown without warning
8. **No share functionality** — Limited sharing options

### 7.4 What's Done Well
1. **Glass-morphism design** — Modern, premium feel
2. **Consistent button system** — Pill-shaped with proper hover states
3. **Accent bar headers** — Clean, minimal section headers
4. **Responsive carousels** — Horizontal scroll with arrow buttons
5. **Real-time features** — Messaging, notifications work well
6. **Fuzzy search** — Good typo tolerance
7. **Natural language search** — Innovative feature

---

## 8. Missing Pages & Features

### 8.1 Missing Pages (High Priority)

| # | Route | Purpose | Why It's Needed |
|---|---|---|---|
| 1 | `/app/feed` | Dedicated activity feed page | Home page feed is buried, users want a dedicated social feed |
| 2 | `/app/stats` | Standalone stats page | Stats are buried in profile tabs, deserves its own page |
| 3 | `/app/calendar` | Release calendar page | Calendar is a home section, users want full calendar view |
| 4 | `/app/lists` | Lists index/browse page | No way to browse all lists, only view individual lists |
| 5 | `/app/settings` | Dedicated settings page | Settings are at `/app/profile/setup`, confusing URL |
| 6 | `/app/charts` | Charts & rankings page | Weekly top exists but no Top 250, most popular, etc. |
| 7 | `/app/notifications/settings` | Notification preferences | No way to control which notifications you receive |
| 8 | `/app/reviews` | Browse reviews page | Reviews only visible in profiles, no discovery |
| 9 | `/app/watch-providers` | Streaming provider browser | Watch providers exist but no dedicated browse page |
| 10 | `/app/annual-wrap` | Year in review page | Profile has year-in-review widget but no dedicated shareable page |

### 8.2 Missing Pages (Medium Priority)

| # | Route | Purpose |
|---|---|---|
| 11 | `/app/discussions` | Movie/TV discussions forum |
| 12 | `/app/news` | Entertainment news feed |
| 13 | `/app/box-office` | Box office tracking |
| 14 | `/app/born-today` | People born today |
| 15 | `/app/awards` | Awards season tracking |
| 16 | `/app/collections` | Browse movie collections |
| 17 | `/app/watchlist` | Dedicated watchlist page with smart sorting |
| 18 | `/app/favorites` | Dedicated favorites page |
| 19 | `/app/diary` | Dedicated film diary page |
| 20 | `/app/friends` | Friends management page |

### 8.3 Missing Features (High Priority)

| # | Feature | Description |
|---|---|---|
| 1 | **Comments on activities** | Users can comment on friends' activity posts |
| 2 | **Rich text reviews** | Markdown/rich text editor for reviews |
| 3 | **Spoilers toggle** | Mark reviews/comments as containing spoilers |
| 4 | **Tags on diary entries** | Add custom tags to diary entries |
| 5 | **List collaboration** | Multiple users can contribute to a list |
| 6 | **Data export** | Export your data (watched, reviews, diary) |
| 7 | **Account deletion** | Fully implement account deletion |
| 8 | **Push notifications** | Browser push notifications for activity |
| 9 | **Email digests** | Weekly email digest of friends' activity |
| 10 | **Profile sharing card** | Generate shareable image of your profile stats |

### 8.4 Missing Features (Medium Priority)

| # | Feature | Description |
|---|---|---|
| 11 | **Watch party** | Sync watching with friends |
| 12 | **Polls** | Create polls about movies/TV |
| 13 | **Badges/Achievements** | Gamification for watching milestones |
| 14 | **Custom themes** | Allow users to customize colors |
| 15 | **Light mode** | Toggle between dark and light themes |
| 16 | **Keyboard shortcuts** | `/` for search, `g h` for home, etc. |
| 17 | **Offline mode** | Cache watched items for offline viewing |
| 18 | **Import from Letterboxd** | Import your Letterboxd data |
| 19 | **Import from Trakt** | Import your Trakt.tv data |
| 20 | **API for developers** | Public API for third-party integrations |

---

## 9. Innovative Feature Proposals

### 9.1 World-Class Features

#### "Cinema Mode" — Immersive Viewing Experience
- Full-screen movie/TV detail page with ambient lighting effect (screen color bleeds to page edges)
- Auto-dim UI elements when reading synopsis
- "Theater mode" hides all navigation, shows only content
- Ambient sound option (theater ambiance, rain, etc.)

#### "Taste DNA" — Visual Taste Profile
- Interactive radar chart showing your taste across 10+ dimensions
- Compare taste DNA with friends visually
- "Taste evolution" — see how your taste changes over time
- "Taste match" — find movies that match your DNA perfectly

#### "Watch Together" — Social Viewing
- Real-time sync watching with friends
- Live reactions (emoji rain during key moments)
- Shared watchlist for group viewing
- Post-watch discussion thread auto-created

#### "Film Time Machine" — Historical Context
- "On this day in cinema history" — movies released on this date
- "What was popular when you were born" — personalized by birth year
- "Decade explorer" — browse by decade with period-appropriate styling
- "Cinema timeline" — interactive timeline of film history

#### "Mood Radar" — Advanced Mood Detection
- Instead of simple mood buttons, use a multi-axis mood selector
- Axes: Energy (calm → intense), Emotion (sad → happy), Complexity (simple → complex), Familiarity (known → new)
- AI interprets your mood position and recommends accordingly
- "Mood history" — track how your viewing mood changes

#### "Cinephile Challenges" — Gamified Discovery
- Weekly challenges: "Watch 3 films from the 70s", "Watch a film from each continent"
- Friend challenges: compete to watch the most films in a genre
- Achievement badges with shareable cards
- Challenge leaderboards

#### "Director's Cut" — Curated Journeys
- AI-curated viewing journeys: "The Kubrick Experience" (watch in specific order)
- "Actor retrospective" — watch an actor's filmography chronologically
- "Genre evolution" — see how a genre evolved through key films
- "Film school" — curated courses on cinema history

#### "Scene Memory" — Timestamped Notes
- Add notes at specific timestamps in movies/episodes
- "Favorite scene" bookmarking
- Share specific scenes with friends (with spoiler protection)
- Scene-based discussions

### 9.2 Industry-Leading Features

#### "Smart Queue" — Intelligent Watchlist Management
- Auto-prioritize watchlist based on: expiring from streaming, friends watching, trending, your taste match
- "Watch tonight" suggestion based on available time, mood, device
- Auto-remove items you'll never watch (based on behavior patterns)
- Queue sharing with friends

#### "Review Assistant" — AI-Powered Review Writing
- AI suggests review structure based on your rating
- "What stood out?" prompts for specific aspects (acting, cinematography, story)
- Auto-generate review from your diary notes
- Tone adjustment (casual, analytical, humorous)

#### "Social Watchlist" — Collaborative Planning
- Create watchlists with friends
- Vote on what to watch next
- "Movie night planner" — find the best time for everyone
- Post-watch group rating

#### "Cinema Calendar" — Life Integration
- Link viewing to life events: "Watched on vacation", "Date night", "Rainy Sunday"
- "Viewing streaks" — track consecutive days of watching
- "Annual review" — Spotify Wrapped-style year summary
- "Life in films" — timeline of your viewing mapped to life events

#### "Frame Gallery" — Visual Memory
- Auto-capture beautiful frames from videos (where available)
- Create visual mood boards from your favorite films
- "Color palette of the week" — dominant colors in your viewing
- Shareable film aesthetics cards

---

## 10. User Journey & Flow

### 10.1 Ideal User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIRST VISIT                               │
│                                                                  │
│  Landing Page → Sign Up → Profile Setup → Onboarding Tour       │
│       ↓              ↓              ↓              ↓            │
│  Dynamic hero    Social login    Username +     "Welcome!       │
│  with stats      Google/Apple    bio + taste    Here's how      │
│  + testimonials  + email         in 4 picks     to use LetSee"  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        DISCOVERY                                 │
│                                                                  │
│  Home Dashboard → Search → Movie Detail → Add to Watchlist      │
│       ↓              ↓            ↓                  ↓          │
│  Personalized    Natural lang   Rich detail     Smart queue     │
│  sections        search +       with streaming  prioritizes     │
│  (not 25+)       filters        info + trailer  this for you    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        ENGAGEMENT                                │
│                                                                  │
│  Watch Movie → Rate → Write Review → Add to Diary → Share       │
│       ↓            ↓           ↓              ↓            ↓    │
│  Track watched  1-10 stars  Rich text     Date + mood     Post   │
│  + episode      + note      + spoilers    + tags +        to     │
│  progress                    toggle        location        feed   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        SOCIAL                                    │
│                                                                  │
│  Activity Feed → Friend Profile → Compatibility → Follow        │
│       ↓               ↓               ↓              ↓         │
│  See what        Taste DNA        % match +      Get notified  │
│  friends are     comparison       shared        of their       │
│  watching +      + shared         genres +      activity       │
│  react/comment   favorites        taste gaps                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        DEEP DIVE                                 │
│                                                                  │
│  Profile Stats → Lists → Film Diary → Year in Review → Export   │
│       ↓             ↓          ↓            ↓              ↓    │
│  Charts +        Curated     Date-based   Shareable       JSON   │
│  insights        collections timeline     image card      + PDF  │
│  + trends        + collab    + tags       + stats         export │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Current User Journey (Problems)

```
Landing Page (static) → Sign Up → Profile Setup → Home (25+ sections, overwhelming)
                                                                    ↓
                                              User doesn't know where to start
                                                                    ↓
                                              Searches randomly → Finds movie → Watches
                                                                    ↓
                                              Rates → Maybe writes review → Done
                                                                    ↓
                                              Never returns to feed, stats, or social features
```

### 10.3 Flow Improvements Needed

1. **Onboarding flow** — Guide new users through key features
2. **Home page simplification** — Show fewer, more relevant sections
3. **Quick actions** — Prominent "What are you watching?" CTA
4. **Social prompts** — "Follow 3 people to get started"
5. **Achievement system** — Reward first review, first list, first follow
6. **Return triggers** — Email notifications, push notifications, weekly digest

---

## 11. Prioritized Overhaul Roadmap

### Phase 1: Foundation (Week 1-2) — ✅ DONE
- [x] Redesign navbar (glass-morphism, animated logo, prominent search)
- [x] Redesign search bar (glass modal, quick categories, recent searches)
- [x] Redesign hero video reel (cinematic overlays, better navigation)
- [x] Restructure home page (section hierarchy, accent bar headers)
- [x] Update all home section components to new design language
- [x] Redesign movie/TV detail pages (premium hero, card-accent, poster overlap)
- [x] Redesign MediaCard (hover glow, brand border, floating effect)
- [x] Update button system (pill shapes, gradients, micro-interactions)
- [x] Build passes, pushed to main

### Phase 2: Missing Pages (Week 3-4)
**Goal:** Create all missing high-priority pages

| # | Page | Effort | Impact |
|---|---|---|---|
| 1 | `/app/feed` — Dedicated activity feed | Medium | High |
| 2 | `/app/stats` — Standalone stats dashboard | Medium | High |
| 3 | `/app/calendar` — Full release calendar | Medium | Medium |
| 4 | `/app/lists` — Lists index/browse | Medium | Medium |
| 5 | `/app/settings` — Dedicated settings | Low | Medium |
| 6 | `/app/charts` — Rankings & charts | Medium | High |
| 7 | `/app/watchlist` — Smart watchlist page | Medium | High |
| 8 | `/app/notifications/settings` — Notification prefs | Low | Medium |
| 9 | `/app/reviews` — Browse reviews | Medium | Medium |
| 10 | `/app/annual-wrap` — Year in review | High | High |

### Phase 3: UX Improvements (Week 5-6)
**Goal:** Fix all UX issues identified in audit

| # | Improvement | Effort | Impact |
|---|---|---|---|
| 1 | Add skeleton loading states to all pages | Medium | High |
| 2 | Add empty state illustrations | Low | Medium |
| 3 | Add error boundaries to all components | Medium | High |
| 4 | Improve mobile responsiveness | High | High |
| 5 | Add keyboard shortcuts (`/`, `g h`, `esc`) | Low | Medium |
| 6 | Add "back to top" button globally | Low | Low |
| 7 | Add content warnings for adult content | Low | Medium |
| 8 | Add share functionality everywhere | Medium | High |
| 9 | Add onboarding tour for new users | Medium | High |
| 10 | Add accessibility improvements (ARIA, focus) | High | High |

### Phase 4: Feature Additions (Week 7-8)
**Goal:** Add missing high-priority features

| # | Feature | Effort | Impact |
|---|---|---|---|
| 1 | Comments on activities | Medium | High |
| 2 | Rich text reviews | Medium | High |
| 3 | Spoilers toggle | Low | High |
| 4 | Tags on diary entries | Low | Medium |
| 5 | List collaboration | High | Medium |
| 6 | Data export | Medium | Medium |
| 7 | Account deletion | Low | High |
| 8 | Push notifications | High | High |
| 9 | Email digests | Medium | Medium |
| 10 | Profile sharing card | Medium | High |

### Phase 5: Innovative Features (Week 9-12)
**Goal:** Build world-class differentiating features

| # | Feature | Effort | Impact |
|---|---|---|---|
| 1 | Taste DNA — Visual taste profile | High | Very High |
| 2 | Smart Queue — Intelligent watchlist | High | Very High |
| 3 | Cinema Mode — Immersive viewing | Medium | High |
| 4 | Mood Radar — Advanced mood detection | High | Very High |
| 5 | Cinephile Challenges — Gamification | High | High |
| 6 | Director's Cut — Curated journeys | Medium | High |
| 7 | Watch Together — Social viewing | Very High | Very High |
| 8 | Film Time Machine — Historical context | Medium | Medium |
| 9 | Review Assistant — AI review writing | High | High |
| 10 | Scene Memory — Timestamped notes | High | Medium |

### Phase 6: Polish & Performance (Week 13-14)
**Goal:** Optimize everything

| # | Task | Effort | Impact |
|---|---|---|---|
| 1 | Add streaming SSR for all pages | Medium | High |
| 2 | Optimize image loading (next/image) | Medium | High |
| 3 | Add service worker for offline | High | Medium |
| 4 | Implement light mode toggle | Medium | Medium |
| 5 | Add custom theme support | High | Medium |
| 6 | Performance audit (Lighthouse) | Medium | High |
| 7 | Remove legacy components | Low | Low |
| 8 | Clean up unused API routes | Low | Low |
| 9 | Database query optimization | Medium | High |
| 10 | Add analytics | Low | Medium |

---

## Appendix A: File-by-File Overhaul Checklist

Use this checklist to track progress on each file. Work through them in priority order.

### Pages (29 files)
- [ ] `/` — Landing page redesign
- [ ] `/login` — Add social login
- [ ] `/signup` — Add social login
- [ ] `/forgot-password` — Add magic link option
- [ ] `/update-password` — Add password strength meter
- [ ] `/app` — Home page restructure (Phase 1 done, needs more)
- [ ] `/app/search` — Add trending searches, category pills
- [ ] `/app/search/[query]` — Add sort, save search
- [ ] `/app/movie/[id]` — Add streaming badges, quick rate
- [ ] `/app/movie/[id]/cast` — Add filterable cast
- [ ] `/app/tv/[id]` — Add season accordion, binge timer
- [ ] `/app/tv/[id]/cast` — Add filterable cast
- [ ] `/app/tv/[id]/season/[seasonNumber]` — Add progress bar
- [ ] `/app/tv/[id]/season/[seasonNumber]/episode/[episodeId]` — Add episode discussion
- [ ] `/app/person` — Add popular people browse
- [ ] `/app/person/[id]` — Add filterable credits, filmography stats
- [ ] `/app/profile` — Add better search/filters
- [ ] `/app/profile/[id]` — Add lazy loading, skeleton states
- [ ] `/app/profile/setup` — Implement account deletion
- [ ] `/app/messages` — Add message search
- [ ] `/app/messages/[id]` — Add typing indicators, read receipts
- [ ] `/app/notification` — Add notification categories
- [ ] `/app/admin` — Build admin dashboard
- [ ] `/app/reel` — Add engagement features
- [ ] `/app/lists/[listId]` — Add collaboration
- [ ] `/app/moviebygenre/list/[id]` — Add sort, filter
- [ ] `/app/tvbygenre/list/[id]` — Add sort, filter
- [ ] `/app/feed` — **NEW** — Dedicated activity feed
- [ ] `/app/stats` — **NEW** — Standalone stats
- [ ] `/app/calendar` — **NEW** — Full calendar
- [ ] `/app/lists` — **NEW** — Lists index
- [ ] `/app/settings` — **NEW** — Dedicated settings
- [ ] `/app/charts` — **NEW** — Rankings
- [ ] `/app/watchlist` — **NEW** — Smart watchlist
- [ ] `/app/notifications/settings` — **NEW** — Notification prefs
- [ ] `/app/reviews` — **NEW** — Browse reviews
- [ ] `/app/annual-wrap` — **NEW** — Year in review

### Components (100+ files)
See Section 6 for full inventory. Work through "Needs Redesign" list first.

### API Routes (91 files)
See Section 5 for full inventory. Most are working well. Focus on:
- Adding caching headers optimization
- Implementing empty poll endpoints
- Adding new endpoints for missing pages

---

## Appendix B: Design Token Reference

### Colors
```
Brand:    green-50 (#f0fdf4) → green-950 (#052e16)
Surface:  surface-50 (#fafafa) → surface-950 (#09090b)
Accent:   gold (#f5c518), purple (#a855f7), blue (#3b82f6)
          rose (#f43f5e), cyan (#06b6d4), amber (#f59e0b)
```

### Typography
```
Font:     Geist Sans (primary), Geist Mono (code)
Headers:  text-xl sm:text-2xl font-bold tracking-tight
Body:     text-sm text-surface-400 leading-relaxed
Small:    text-xs text-surface-500
```

### Spacing
```
Container: max-w-7xl mx-auto px-4 sm:px-6
Section:   gap-10 sm:gap-14
Card:      p-5
```

### Components
```
Buttons:   btn-primary, btn-secondary, btn-ghost, btn-danger
Cards:     card-accent, glass-card
Pills:     pill-glass
Badges:    badge-brand
Chips:     chip-surface
```

---

*This document is a living reference. Update it as features are built and new requirements emerge.*
*Last updated: May 19, 2026*
