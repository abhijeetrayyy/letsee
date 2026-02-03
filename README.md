# Letsee (Movie Social)

A **social movie & TV discovery app**: track what you watch, share with friends, get AI recommendations, and see where to stream.

## What it does

- **Discover** — Trending, genres (movies & TV), Bollywood, Romance, Action, search by title or keyword
- **Your lists** — Watchlist, Favorites, Watched (with genre stats on your profile)
- **Your rating** — Rate movies and TV 1–10 on detail pages; see “Your rating” and change it anytime
- **Reviews / diary** — Add a review or note to watched items; see "Watched on [date]" and review snippet on your profile
- **Where to Watch** — Streaming providers for each movie and TV show (TMDB/JustWatch data)
- **AI recommendations** — Personalized picks based on your favorites and watched list (Gemini)
- **Social** — Follow friends, follow requests, DMs (text + share movie/TV cards), user-to-user recommendations
- **Activity feed** — See what people you follow watched, favorited, added to watchlist, or rated (on home)
- **Custom lists** — Create named lists (e.g. “Best 2024”), add/remove movies and TV, set visibility (public, followers, private); view on profile and at `/app/lists/[id]`
- **Calendar / upcoming** — "In theaters" and "TV this week" on home (TMDB now_playing + on_the_air)
- **Reels** — Short-form movie clips by genre/keyword
- **Profiles** — Public, followers-only, or private; genre breakdown; paginated lists

## Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS
- **Backend:** Next.js API routes, Supabase (Auth, Postgres, Realtime)
- **Data:** TMDB, OMDB (IMDb ratings), Google Gemini (AI recommendations)

## Getting started

### Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) project (Auth + Postgres)
- [TMDB](https://www.themoviedb.org/settings/api) API key
- [OMDb](https://www.omdbapi.com/apikey.aspx) API key (optional, for IMDb ratings)
- [Google AI](https://ai.google.dev/) API key (optional, for AI recommendations)

### Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd letsee
   npm install
   ```

2. **Environment variables**

   Create `.env.local` in the project root:

   ```env
   # Supabase (required)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

   # TMDB (required for discovery and watch providers)
   TMDB_API_KEY=your-tmdb-api-key

   # OMDb (optional – for IMDb ratings on movie/TV pages)
   OMDB_API_KEY=your-omdb-api-key

   # Google AI (optional – for “Your Personal Recommendations” on home)
   GOOGLE_KEY=your-google-ai-api-key
   ```

3. **Database**

   Apply the schema in `schema.sql` to your Supabase project (SQL Editor or migrations).

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Use the landing “Get Started” to go to `/app` (sign up or log in to use lists and social features).

### Scripts

| Command       | Description                |
| ------------- | -------------------------- |
| `npm run dev` | Dev server (Turbopack)     |
| `npm run build` | Production build        |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint               |

## Deployment (e.g. Vercel)

- Set the same env vars in your host’s dashboard.
- **TMDB from India:** If your server runs in India, TMDB can be unreliable. Deploy in another region (e.g. US or EU). See `docs/API_AUDIT_TMDB_AND_FETCH.md` and `vercel.json` for region config.

## Docs

- `docs/API_AUDIT_TMDB_AND_FETCH.md` — TMDB usage, India/region options, fetch patterns
- `docs/FEATURE_RESEARCH_AND_OPTIONS.md` — Feature gaps and options
- `docs/PRIORITY_LIST.md` — Implementation priority list

## License

Private. All rights reserved.
