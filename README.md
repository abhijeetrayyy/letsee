# Letsee (Movie Social)

A **social app for deciding what to watch**: who's in the room, how long you've got, and what you can actually stream — then track it, review it, and share it with the people whose taste you trust.

## What it does

- **Tonight** — Pick the people watching, the time you've got, and get *one* answer with the reason behind it and where it's streaming. Marks it as watching when you commit, so the diary writes itself. (`/app/tonight`)
- **Discover** — Trending, browse by genre (movies & TV), search by title or keyword
- **Your lists** — Watchlist, Favorites, Watched (with genre stats on your profile)
- **Your rating** — Rate movies and TV 1–10 on detail pages; see “Your rating” and change it anytime
- **Reviews / diary** — Add a review or note to watched items; see "Watched on [date]" and review snippet on your profile
- **Where to Watch** — Streaming providers for each movie and TV show (TMDB/JustWatch data)
- **Recommendations** — Personalized picks computed from your favorites, watched list and taste overlap with other users (no LLM involved)
- **Social** — Follow friends, follow requests, DMs (text + share movie/TV cards), user-to-user recommendations
- **Activity feed** — See what people you follow watched, favorited, added to watchlist, or rated (on home)
- **Custom lists** — Create named lists (e.g. “Best 2024”), add/remove movies and TV, set visibility (public, followers, private); view on profile and at `/app/lists/[id]`
- **Calendar / upcoming** — "In theaters" and "TV this week" on home (TMDB now_playing + on_the_air)
- **Clubs** — Small groups that watch the same thing the same week and talk about it
- **Profiles** — Public, followers-only, or private; genre breakdown; paginated lists

## Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS
- **Backend:** Next.js API routes, Supabase (Auth, Postgres, Realtime)
- **Data:** TMDB, OMDB (IMDb ratings)

## Getting started

### Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) project (Auth + Postgres)
- [TMDB](https://www.themoviedb.org/settings/api) API key
- [OMDb](https://www.omdbapi.com/apikey.aspx) API key (optional, for IMDb ratings)

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

   # Service role key (required for visitors to see other users' profiles: watched, favorites, watchlist, lists)
   # Get it from Supabase Dashboard → Settings → API → service_role (never expose to the client)
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # TMDB (required for discovery and watch providers)
   TMDB_API_KEY=your-tmdb-api-key

   # OMDb (optional – for IMDb ratings on movie/TV pages)
   OMDB_API_KEY=your-omdb-api-key

   # Public origin (recommended)
   # Used for canonical URLs, Open Graph tags, robots.txt, sitemap.xml and the
   # links the share sheet copies. Falls back to Vercel's production domain.
   NEXT_PUBLIC_APP_URL=https://your-domain.example

   # Cron secret (REQUIRED in production)
   # Vercel sends this as `Authorization: Bearer $CRON_SECRET` on every scheduled
   # run. The cron routes fail closed without it: /api/cron/purge-deleted
   # permanently deletes accounts and /api/cron/{run-jobs,check-availability}
   # hold a service-role client, so an unset variable must not leave them open.
   CRON_SECRET=a-long-random-string
   ```

3. **Database**

   Run `migrations/000_baseline.sql` against a fresh Supabase project (SQL Editor). It is the
   complete schema — tables, functions, RLS policies, triggers, indexes and grants.
   For an existing database, apply the numbered migrations you are missing instead.

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

- `docs/SURPASSING_LETTERBOXD.md` — **Start here.** Product strategy, the decisions behind Tonight, and what shipped (W1–W7, all done)
- `docs/EXPRESSION_AND_DISCOVERY.md` — The next plan: one place to record an opinion, and one path to find anything
- `docs/AGENT_DB_AND_MIGRATIONS.md` — Which migrations exist, what each does, and which are applied
- `docs/API_AUDIT_TMDB_AND_FETCH.md` — TMDB usage, India/region options, fetch patterns
- `docs/FEATURE_RESEARCH_AND_OPTIONS.md` — Feature gaps and options (partly superseded)
- `docs/PRIORITY_LIST.md` — Implementation priority list (partly superseded)

## License

Private. All rights reserved.
