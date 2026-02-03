# Profile Page Research — Best-in-Class & Unique for Letsee

**Goal:** Design the absolute best profile page for a Letterboxd-like movie/TV social app while staying **unique** (not a clone). This doc summarizes competitor patterns, UX best practices, and concrete recommendations for Letsee.

---

## 1. What Competitors Do

### Letterboxd (film-first, social)

| Element | What they do |
|--------|----------------|
| **Hero** | Profile photo (square, 400×400+), **four favorite film posters** in a row, bio, optional location/website |
| **Identity** | Username as URL (`letterboxd.com/username`), “Your life in film” framing |
| **Tabs / sections** | Films (all watched), **Diary** (date-logged view), Watchlist, Reviews, Lists |
| **Stats** | Implied via list counts; Pro/Patron get deeper stats |
| **Year in Review** | “Wrapped” style: total films, hours, top director/actor, genre breakdown, highest-rated (differentiator) |
| **Social** | Follow/followers, likes on reviews, comments; profile is the “home base” for deciding to follow |

**Takeaway:** Taste is front and center (four favorites, diary, reviews). Profile = “should I follow this person?”

### Trakt (tracking-first, cross-platform)

| Element | What they do |
|--------|----------------|
| **Hero** | Avatar, username, “Discover. Track. Share.” |
| **Focus** | Watched history, progress (e.g. TV episodes), **stats** (movies/shows watched, time) |
| **Differentiator** | Scrobbling, sync with Kodi/Plex/Netflix, real-time “just watched” |
| **Profile** | Functional: what you’ve watched, lists, calendar; less “personality” than Letterboxd |

**Takeaway:** Profile is a **dashboard of activity**; stats and progress matter more than “four favorite films.”

### General profile UX (2024+)

- **First impression:** Profile photo + banner/hero; clear visual identity.
- **Information architecture:** Logical sections, scannable; avoid long walls of text.
- **Personal branding:** Bio + something that “tells your story” (e.g. favorites, top genres, year in review).
- **Discovery:** Profile should answer “why follow?” — taste, consistency, recency.
- **Trust:** Edit profile, visibility controls, export (you already plan this) reduce churn.

---

## 2. What Letsee Already Has

| Area | Current state |
|------|----------------|
| **Identity** | Username, bio (`about`), avatar (currently static `/avatar.svg`) |
| **Stats** | Watched / Favorites / Watchlist counts in 3 stat boxes; **genre bar chart** (top 5 from watched) |
| **Social** | Follow/followers, follow button, message; visibility (public / followers / private) |
| **Content** | Recommendation tile (carousel), **custom lists**, then Favorites → Watchlist → Watched (paginated, genre filter, date + review snippet) |
| **Lists** | User-created lists with name, description, visibility, item count |
| **Reviews** | Diary-style: `watched_at` + `review_text` (and public review) on detail; profile shows watched with date + snippet |

**Strengths:** Genre stats, custom lists, visibility, recommendations tile, diary-style reviews. You’re already close to “film diary + lists” like Letterboxd but with TV and a clearer stats/social mix.

---

## 3. Gaps vs “Absolute Best” Profile

- **No “taste at a glance”** — No “four favorite films” (or equivalent) or hero that instantly communicates taste.
- **No profile avatar/banner from user** — Avatar is static; no banner or user-uploaded image.
- **No “Year in Review” / “Wrapped”** — No shareable yearly stats (hours, top director, genre, etc.).
- **No “Recent activity” strip** — No compact “last 5 watches/ratings” on profile for visitors.
- **Stats are plain** — Counts only; no “hours watched,” “movies vs TV,” or “this year.”
- **Section order is fixed** — No tabs or reorder; everything in one long scroll.
- **No “featured list” or “pinned”** — Can’t highlight one list or one review above the fold.
- **Profile setup/edit** — You have setup and edit link; not clear if users can set favorites, avatar, or links.

---

## 4. Recommendations: Make It the Best *and* Unique

### A. Identity & first impression (unique)

1. **User avatar + optional banner**
   - Store `avatar_url` (and optional `banner_url`) in `users` (or Supabase Storage + URL in `users`).
   - Profile: large avatar, optional full-width banner behind header (like Twitter/GitHub). Makes profiles feel owned and recognizable.

2. **“Taste in 4” (your twist on “four favorites”)**
   - Letterboxd uses four films. You have **movies + TV**: e.g. “4 favorite titles” (any mix of movie/TV) chosen by user from watched/favorites.
   - Store as `user_favorite_display` (e.g. `user_id`, `item_id`, `item_type`, `position`, `image_url`) or simple JSON on `users`.
   - Show as a **poster strip in the hero** (not just a grid): e.g. 4 posters in a slight overlap or filmstrip style — visually distinct from Letterboxd’s 2×2.

3. **Short “profile tagline”**
   - Optional `tagline` (e.g. “Horror by night, rom-coms by day”) in addition to `about`. One line under the name; reinforces personality without reading the full bio.

### B. Stats that tell a story (unique)

4. **Rich stat cards**
   - Keep Watched / Favorites / Watchlist but add:
     - **Hours watched** (approximate: movies × 2, TV × 0.5 per episode or use TMDB runtime when available).
     - **This year** (e.g. “47 in 2025”) for watched.
     - Optional: **Movies vs TV** ratio (pie or small bar).
   - Makes the profile feel “alive” and shareable (“I watched 200 hours this year”).

5. **“Year in Review” / Letsee Wrapped**
   - Dedicated section or page: total films/shows, hours, top genre, top director (from cast/crew if you have it), top actor, highest-rated, “first watch of the year,” “most rewatched.”
   - Can be a **profile section** (e.g. “Your 2025”) or a separate `/app/profile/[id]/year/2025` page with share image (OG or download).
   - Big differentiator: do it for **both movies and TV** and make it shareable (image + link).

6. **Genre chart upgrade**
   - You already have top 5 genres. Consider:
     - Top 5–10 with a **distinct visual** (e.g. horizontal bars with movie-poster-style color or a small “film strip” per genre).
     - Optional “Movies vs TV” split per genre if data allows.

### C. Content layout & discovery (unique)

7. **Tabs or sticky sections**
   - Instead of one long scroll, use **tabs**: e.g. **Activity** | **Watched** | **Watchlist** | **Favorites** | **Lists** | **Reviews** (or combine Watched + Diary + Reviews into one “Diary” tab with filters).
   - Reduces overwhelm and matches “film diary” mental model; you can keep “Recommendations” as a strip above tabs.

8. **“Recent activity” strip**
   - Above or beside main content: last 5–10 items (watched / rated / list add) with poster + title + date (and optional one-line review). Gives visitors a quick “what are they into lately?” without scrolling.

9. **Featured list + pinned review**
   - Let **profile owner** choose:
     - One **featured list** (e.g. “Date night”, “Best 2024”) shown at top of Lists or in hero area.
     - One **pinned review** (diary entry) — e.g. “My best review” or “Film that changed my mind.”
   - Stored as `users.featured_list_id`, `users.pinned_review_id` (or equivalent). Makes each profile feel curated.

10. **Diary view**
    - You have `watched_at` + `review_text`. Add a **diary view** on profile: chronological (newest first) with date prominent, poster, title, rating (if any), and review snippet. Filter by movie/TV, year. Letterboxd’s diary is iconic; yours can be **movie + TV** with a clear timeline.

### D. Social & trust (align with best)

11. **Follow/followers placement**
    - Keep follow button and follower/following counts visible in header; consider adding “X people you follow follow them” if you have a follow graph (discovery).

12. **Visibility**
    - You already have public / followers / private. Keep visibility control clear for the owner; for visitors, a short “Only followers can see lists/diary” (or similar) is enough.

13. **Export**
    - From profile or settings: export watched/watchlist/favorites (and ratings, lists) as CSV/JSON. Builds trust and differentiates; you have it on the roadmap.

### E. Technical / schema hints

- **Users:** `avatar_url`, `banner_url`, `tagline`, `featured_list_id`, `pinned_review_id`; optional `favorite_display` (JSON array of `{ item_id, item_type, position }`) or small `user_favorite_display` table.
- **Stats:** “Hours watched” and “this year” can be computed from `watched_items` (and TMDB runtimes if you store or fetch them); no strict need for new tables.
- **Year in Review:** Computed from `watched_items` + `user_ratings` + TMDB (directors, cast); optional cache table or server-side generation + OG image.

---

## 5. Priority Order for “Absolute Best” Profile

| Priority | Item | Why |
|----------|------|-----|
| **P0** | Avatar (and optional banner) | Identity and first impression; low effort if using Storage. |
| **P0** | “Taste in 4” poster strip in hero | Instant taste; different layout (filmstrip) keeps it unique. |
| **P1** | Tabs (Activity / Watched / Lists / etc.) | Clear IA; matches diary + lists mental model. |
| **P1** | Recent activity strip | Quick “what they’re into lately” for visitors. |
| **P1** | Rich stats (hours, “this year,” movies vs TV) | Storytelling and shareability. |
| **P2** | Diary view (chronological, filters) | Core “film diary” experience; you have the data. |
| **P2** | Featured list + pinned review | Curation and uniqueness per profile. |
| **P2** | Year in Review / Wrapped (section or page + share) | Major differentiator; both movie + TV. |
| **P3** | Tagline, genre chart polish, “people you follow follow them” | Polish and discovery. |

---

## 6. What Makes It *Unique* (Not “Letterboxd Again”)

- **Movie + TV in one place:** Four favorites = any mix of movie/TV; diary and stats include both; Year in Review covers both.
- **“Taste in 4” filmstrip:** Visual treatment (e.g. overlapping strip) different from Letterboxd’s grid.
- **Recommendations tile:** You already have it; keep it prominent — “what I recommend to you” is social and distinctive.
- **Reels + profile:** Optional “My reels” or “Reels I liked” on profile (if you want to lean into short-form).
- **Visibility + messaging:** You already combine follow, visibility, and DMs; profile can surface “message” and “follow” in one clear social block.
- **One profile for both films and shows:** Single URL, one diary, one set of lists — no split between “movie profile” and “TV profile.”

---

## 7. Summary

- **Letterboxd:** Strong on taste (four favorites, diary, reviews) and year-end wrap; profile = “should I follow?”
- **Trakt:** Strong on tracking and stats; profile = “what have they watched?”
- **Letsee today:** Good base: genre stats, custom lists, visibility, recommendations, diary-style reviews.

To make the **absolute best profile** and stay **unique**: add a strong hero (avatar, banner, “Taste in 4” strip, tagline), richer stats (hours, this year, movies vs TV), tabs + recent activity + diary view, featured list + pinned review, and Year in Review for both movies and TV. Prioritize avatar + “Taste in 4” and tabs first, then stats and diary, then Wrapped and curation options.

If you tell me your preferred stack (e.g. where you want to store avatar/banner — Supabase Storage vs URL), I can turn P0/P1 into concrete schema changes and component list (e.g. `ProfileHero`, `ProfileTabs`, `RecentActivityStrip`) for implementation.
