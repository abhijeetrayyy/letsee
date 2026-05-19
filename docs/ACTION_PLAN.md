# LetSee — Strategic Action Plan

> **Execution roadmap** — Every task, prioritized, sequenced, and dependency-mapped.
> Last updated: May 19, 2026

---

## How to Use This Plan

- **P0** = Critical — blocks everything else, do first
- **P1** = High — major impact, do in current phase
- **P2** = Medium — important but not blocking
- **P3** = Low — nice to have, do when time permits
- Each task has: **ID**, **Priority**, **Effort** (S/M/L/XL), **Dependencies**, **Status**
- Work through phases in order. Within a phase, work top to bottom.
- Mark tasks `[x]` when complete.

---

## Phase 0: Cleanup & Foundation (Days 1-3)

> **Goal:** Remove dead code, fix build issues, establish patterns before building new things.

### 0.1 Remove Legacy Components

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 0.1.1 | Delete `src/components/profile/ProfileHero.tsx` (replaced by ProfileHeroNew) | P1 | S | None | [ ] |
| 0.1.2 | Delete `src/components/profile/ProfileTabs.tsx` (replaced by ProfileTabsNew) | P1 | S | None | [ ] |
| 0.1.3 | Delete `src/components/cards/cardMovie.tsx` (superseded by MediaCard) | P1 | S | None | [ ] |
| 0.1.4 | Delete `src/components/cards/chineCard.tsx` (unused) | P2 | S | None | [ ] |
| 0.1.5 | Delete `src/components/cards/cardMeter.tsx` (unused) | P2 | S | None | [ ] |
| 0.1.6 | Delete `src/components/clientComponent/topTv.tsx` (superseded) | P2 | S | None | [ ] |
| 0.1.7 | Delete `src/components/clientComponent/weeklyTop.tsx` (superseded) | P2 | S | None | [ ] |
| 0.1.8 | Delete `src/components/scroll/arrowbuttonScroll.tsx` (unused) | P2 | S | None | [ ] |
| 0.1.9 | Delete `src/components/buttons/intrectionButton.ts` (unused TS file) | P2 | S | None | [ ] |
| 0.1.10 | Delete `src/app/app/storeProvider.tsx` (Redux not used) | P2 | S | None | [ ] |
| 0.1.11 | Remove Redux dependencies from package.json (`@reduxjs/toolkit`, `react-redux`) | P2 | S | 0.1.10 | [ ] |
| 0.1.12 | Delete `src/redux/` directory (store, hooks, features) | P2 | S | 0.1.11 | [ ] |
| 0.1.13 | Delete `src/lib/mongoDb/` directory (unused) | P2 | S | None | [ ] |
| 0.1.14 | Delete empty API route dirs: `/api/poll/questions`, `/api/poll/responses` | P2 | S | None | [ ] |
| 0.1.15 | Run `npx next build` to verify nothing breaks after deletions | P0 | S | 0.1.1-0.1.14 | [ ] |

### 0.2 Fix File Naming & Typos

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 0.2.1 | Rename `src/components/clientComponent/ImaeViewer.tsx` → `ImageViewer.tsx` | P2 | S | None | [ ] |
| 0.2.2 | Rename `src/components/homeDiscover/client/seachForm.tsx` → `searchForm.tsx` | P2 | S | None | [ ] |
| 0.2.3 | Rename `src/components/profile/profllebtn.tsx` → `profileBtn.tsx` | P2 | S | None | [ ] |
| 0.2.4 | Rename `src/components/profile/recomendation.tsx` → `recommendation.tsx` | P2 | S | None | [ ] |
| 0.2.5 | Rename `src/components/buttons/serchbygenreBtn.tsx` → `searchByGenreBtn.tsx` | P2 | S | None | [ ] |
| 0.2.6 | Update all import references for renamed files | P1 | M | 0.2.1-0.2.5 | [ ] |

### 0.3 Establish Design Token Consistency

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 0.3.1 | Audit all files for hardcoded colors (e.g., `#22c55e`, `bg-surface-800/60`) — replace with design tokens | P2 | M | None | [ ] |
| 0.3.2 | Standardize border opacity: use `border-white/5`, `border-white/10` consistently | P2 | M | None | [ ] |
| 0.3.3 | Standardize backdrop blur values: `backdrop-blur-sm`, `backdrop-blur-md`, `backdrop-blur-xl` | P2 | S | None | [ ] |
| 0.3.4 | Create `src/components/ui/SectionHeader.tsx` reusable component (accent bar + title + subtitle + optional link) | P1 | M | None | [ ] |
| 0.3.5 | Create `src/components/ui/EmptyState.tsx` reusable component (icon + message + optional CTA) | P1 | M | None | [ ] |
| 0.3.6 | Create `src/components/ui/SkeletonCard.tsx` reusable skeleton for MediaCard | P1 | S | None | [ ] |
| 0.3.7 | Create `src/components/ui/SkeletonRow.tsx` reusable skeleton for list items | P1 | S | None | [ ] |
| 0.3.8 | Create `src/components/ui/ErrorBoundary.tsx` client error boundary component | P1 | M | None | [ ] |

### 0.4 Build Verification

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 0.4.1 | Run `npx next build` — must pass with zero errors | P0 | S | All Phase 0 tasks | [ ] |
| 0.4.2 | Run `npx next lint` — fix all lint errors | P1 | M | 0.4.1 | [ ] |
| 0.4.3 | Verify all renamed imports work in dev mode | P0 | S | 0.4.1 | [ ] |
| 0.4.4 | Commit and push cleanup | P0 | S | 0.4.1-0.4.3 | [ ] |

---

## Phase 1: Core UI Overhaul (Days 4-10)

> **Goal:** Every visible page and component uses the new design language. No exceptions.

### 1.1 Landing Page Redesign (`/`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.1.1 | Redesign hero: full-bleed animated backdrop, gradient text, animated stats counter | P1 | M | 0.3.4 | [ ] |
| 1.1.2 | Add dynamic TMDB stats to hero (total movies, TV shows, daily active users) | P2 | M | None | [ ] |
| 1.1.3 | Redesign features grid: use card-accent with icons, hover lift | P1 | M | 0.3.4 | [ ] |
| 1.1.4 | Add testimonial carousel with mock review cards (animated) | P2 | M | None | [ ] |
| 1.1.5 | Add interactive feature preview (mini search, sample movie card) | P2 | L | None | [ ] |
| 1.1.6 | Redesign CTA section: gradient background, animated button | P1 | S | None | [ ] |
| 1.1.7 | Redesign footer: multi-column links, social icons, TMDB attribution | P2 | M | None | [ ] |
| 1.1.8 | Add scroll-triggered animations (fade-up on scroll into view) | P2 | M | None | [ ] |

### 1.2 Auth Pages Redesign

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.2.1 | Redesign login page: centered card, glass effect, branded header | P1 | M | None | [ ] |
| 1.2.2 | Add social login buttons (Google, Apple) — UI only (backend later) | P2 | S | 1.2.1 | [ ] |
| 1.2.3 | Add "Forgot password?" link with proper routing | P1 | S | 1.2.1 | [ ] |
| 1.2.4 | Redesign signup page: match login style, add password strength meter | P1 | M | 1.2.1 | [ ] |
| 1.2.5 | Add password strength indicator (weak/fair/strong) with color bar | P1 | M | 1.2.4 | [ ] |
| 1.2.6 | Add email format validation with real-time feedback | P1 | S | 1.2.4 | [ ] |
| 1.2.7 | Redesign forgot-password page: email input, cooldown timer, success state | P2 | M | None | [ ] |
| 1.2.8 | Redesign update-password page: new password + confirm, strength meter | P2 | M | 1.2.5 | [ ] |
| 1.2.9 | Add loading spinners to all auth form submissions | P1 | S | None | [ ] |
| 1.2.10 | Add error toast for failed auth attempts | P1 | S | None | [ ] |

### 1.3 Home Dashboard Restructure (`/app`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.3.1 | **Reduce sections from 25 to 12-15** — remove duplicate genre sections | P0 | M | None | [ ] |
| 1.3.2 | Merge Romance, Action, Crime, Thriller, Dark Zones, Horror, Bollywood into single "Curated Collections" section with tabbed navigation | P1 | M | 1.3.1 | [ ] |
| 1.3.3 | Merge Anime Series + Anime Films + AnimeTags into single "Anime" section | P1 | S | 1.3.1 | [ ] |
| 1.3.4 | Add "Quick Actions" bar below hero: Search, What to Watch, My Watchlist, My Diary | P1 | M | None | [ ] |
| 1.3.5 | Add personalized greeting: "Good evening, [username]" with time-based icon | P1 | S | None | [ ] |
| 1.3.6 | Add "Continue Watching" progress visualization (progress bars on cards) | P1 | M | None | [ ] |
| 1.3.7 | Add "New Episodes" badge to TV shows with unwatched episodes | P1 | M | None | [ ] |
| 1.3.8 | Replace all section headers with `<SectionHeader>` component (from 0.3.4) | P1 | M | 0.3.4 | [ ] |
| 1.3.9 | Add skeleton loading states for each section | P1 | M | 0.3.5-0.3.7 | [ ] |
| 1.3.10 | Add "Load More" pagination for genre sections instead of showing all at once | P2 | M | None | [ ] |
| 1.3.11 | Add section collapse/expand (user can hide sections they don't want) | P2 | L | None | [ ] |
| 1.3.12 | Optimize `getHomeSections()` — add staggered revalidation (some 1h, some 15min) | P1 | M | None | [ ] |
| 1.3.13 | Add streaming ISR — stream sections as they load instead of waiting for all | P1 | L | None | [ ] |

### 1.4 Movie Detail Page Polish (`/app/movie/[id]`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.4.1 | Add streaming provider badges in hero (Netflix, Prime, etc. with logos) | P1 | M | None | [ ] |
| 1.4.2 | Add "Quick Rate" button in hero (1-10 tap rating without scrolling) | P1 | M | None | [ ] |
| 1.4.3 | Add "Watch Trailer" modal (YouTube embed) | P1 | M | None | [ ] |
| 1.4.4 | Add share button with options (copy link, Twitter, DM) | P1 | M | None | [ ] |
| 1.4.5 | Add "Where to Watch" section prominence (move above cast) | P1 | S | 1.4.1 | [ ] |
| 1.4.6 | Add skeleton loading for movie detail page | P1 | M | 0.3.5-0.3.7 | [ ] |
| 1.4.7 | Add "Similar Movies" horizontal scroll below main content | P2 | S | None | [ ] |
| 1.4.8 | Add "More Like This" section with reasoning ("Because you liked X") | P2 | M | None | [ ] |

### 1.5 TV Detail Page Polish (`/app/tv/[id]`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.5.1 | Add season accordion (expandable seasons instead of horizontal scroll) | P1 | M | None | [ ] |
| 1.5.2 | Add "Next Episode" countdown badge (if show is ongoing) | P1 | M | None | [ ] |
| 1.5.3 | Add binge timer (estimated time to finish season/show) | P2 | M | None | [ ] |
| 1.5.4 | Add "Mark Season Watched" button per season | P1 | M | None | [ ] |
| 1.5.5 | Add streaming provider badges in hero | P1 | M | None | [ ] |
| 1.5.6 | Add skeleton loading for TV detail page | P1 | M | 0.3.5-0.3.7 | [ ] |
| 1.5.7 | Add "Watch Trailer" modal | P1 | S | None | [ ] |
| 1.5.8 | Add share button | P1 | S | None | [ ] |

### 1.6 Season & Episode Pages

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.6.1 | Add season progress bar (X/Y episodes watched) | P1 | S | None | [ ] |
| 1.6.2 | Add "Mark All Watched" button for season | P1 | M | None | [ ] |
| 1.6.3 | Add episode sorting (by episode number, by rating, by runtime) | P2 | M | None | [ ] |
| 1.6.4 | Add episode discussion section (comments) | P2 | L | Phase 4 | [ ] |
| 1.6.5 | Add timestamped notes UI | P2 | L | Phase 5 | [ ] |

### 1.7 Person Detail Page

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.7.1 | Add filterable credits (by department, year, rating) | P1 | M | None | [ ] |
| 1.7.2 | Add filmography stats (total films, avg rating, most frequent collaborators) | P2 | M | None | [ ] |
| 1.7.3 | Add collaboration network visualization | P2 | L | None | [ ] |
| 1.7.4 | Add skeleton loading | P1 | S | 0.3.5-0.3.7 | [ ] |

### 1.8 Profile Page (`/app/profile/[id]`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.8.1 | Add lazy loading per tab (only load tab content when selected) | P0 | L | None | [ ] |
| 1.8.2 | Add skeleton states for each tab | P1 | M | 0.3.5-0.3.7, 1.8.1 | [ ] |
| 1.8.3 | Add error boundary around each tab | P1 | M | 0.3.8 | [ ] |
| 1.8.4 | Reorganize tabs: Overview, Diary, Films, Series, Reviews, Lists, Stats, Activity | P1 | S | None | [ ] |
| 1.8.5 | Add "Share Profile" button (generates shareable link) | P1 | S | None | [ ] |
| 1.8.6 | Add profile completeness checklist (visible to owner) | P1 | M | None | [ ] |
| 1.8.7 | Add "Edit Profile" button for own profile | P1 | S | None | [ ] |
| 1.8.8 | Optimize initial load — only fetch hero + stats, defer other tabs | P0 | L | None | [ ] |
| 1.8.9 | Add infinite scroll for activity feed tab | P1 | M | None | [ ] |
| 1.8.10 | Add year filter for diary and watched grid | P2 | M | None | [ ] |

### 1.9 Search Pages

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.9.1 | Add trending searches to search landing page | P1 | M | None | [ ] |
| 1.9.2 | Add category pills (Movies, TV, People, Keywords) on search landing | P1 | S | None | [ ] |
| 1.9.3 | Add sort options to search results (popularity, rating, release date, title) | P1 | M | None | [ ] |
| 1.9.4 | Add "Save Search" button | P2 | M | None | [ ] |
| 1.9.5 | Add search history with date stamps | P2 | S | None | [ ] |
| 1.9.6 | Add voice search UI feedback (listening indicator) | P2 | M | None | [ ] |
| 1.9.7 | Add skeleton loading for search results | P1 | S | 0.3.5-0.3.7 | [ ] |

### 1.10 Messages & Notifications

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.10.1 | Add message search within conversations | P1 | M | None | [ ] |
| 1.10.2 | Add media preview in chat (movie/TV card thumbnails) | P1 | M | None | [ ] |
| 1.10.3 | Add typing indicator | P2 | L | None | [ ] |
| 1.10.4 | Add read receipts (double checkmarks) | P2 | M | None | [ ] |
| 1.10.5 | Add notification categories (social, activity, recommendations) | P1 | M | None | [ ] |
| 1.10.6 | Add "Mark as Read" per notification (not just all) | P1 | S | None | [ ] |
| 1.10.7 | Add notification preferences page | P1 | M | None | [ ] |

### 1.11 Lists

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.11.1 | Create `/app/lists` index page (browse all user lists) | P1 | M | None | [ ] |
| 1.11.2 | Add list creation from home page (quick action) | P1 | M | None | [ ] |
| 1.11.3 | Add list collaboration (invite friends to contribute) | P2 | L | None | [ ] |
| 1.11.4 | Add list templates (Top 10, Watchlist, Genre Collection) | P2 | M | None | [ ] |
| 1.11.5 | Add list sharing (copy link, social share) | P1 | S | None | [ ] |
| 1.11.6 | Add list sorting (manual, by rating, by date added) | P1 | M | None | [ ] |

### 1.12 Genre Pages

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.12.1 | Add sort options (popularity, rating, release date) | P1 | M | None | [ ] |
| 1.12.2 | Add year filter | P1 | M | None | [ ] |
| 1.12.3 | Add grid/list view toggle | P2 | M | None | [ ] |
| 1.12.4 | Add skeleton loading | P1 | S | 0.3.5-0.3.7 | [ ] |

### 1.13 Reel Page

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.13.1 | Add like button on reels | P1 | M | None | [ ] |
| 1.13.2 | Add comment section on reels | P2 | L | Phase 4 | [ ] |
| 1.13.3 | Add share reel button | P1 | S | None | [ ] |
| 1.13.4 | Add "Create Reel" button (placeholder for now) | P2 | S | None | [ ] |

### 1.14 Build Verification

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 1.14.1 | Run `npx next build` — must pass | P0 | S | All Phase 1 tasks | [ ] |
| 1.14.2 | Test all redesigned pages in dev mode | P0 | M | 1.14.1 | [ ] |
| 1.14.3 | Test mobile responsiveness for all redesigned pages | P0 | M | 1.14.1 | [ ] |
| 1.14.4 | Commit and push | P0 | S | 1.14.1-1.14.3 | [ ] |

---

## Phase 2: Missing Pages (Days 11-17)

> **Goal:** Create all missing high-priority pages. Each page uses the established design language.

### 2.1 Dedicated Activity Feed (`/app/feed`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 2.1.1 | Create page structure: `src/app/app/feed/page.tsx` | P0 | S | None | [ ] |
| 2.1.2 | Create `FeedLayout` component with tabs: Following, Popular, Recent | P1 | M | None | [ ] |
| 2.1.3 | Build "Following" tab — existing FollowingFeed component | P1 | S | None | [ ] |
| 2.1.4 | Build "Popular" tab — trending activity across all users | P1 | M | None | [ ] |
| 2.1.5 | Build "Recent" tab — chronological activity from everyone | P1 | M | None | [ ] |
| 2.1.6 | Add filter by activity type (watched, rated, reviewed, list) | P1 | M | None | [ ] |
| 2.1.7 | Add infinite scroll pagination | P1 | M | None | [ ] |
| 2.1.8 | Add skeleton loading states | P1 | S | 0.3.5-0.3.7 | [ ] |
| 2.1.9 | Add empty state for new users (no activity yet) | P1 | S | 0.3.5 | [ ] |
| 2.1.10 | Add "Suggested Users to Follow" sidebar | P2 | M | None | [ ] |

### 2.2 Standalone Stats Page (`/app/stats`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 2.2.1 | Create page structure: `src/app/app/stats/page.tsx` | P0 | S | None | [ ] |
| 2.2.2 | Build stats overview cards (total watched, avg rating, total hours, streak) | P1 | M | None | [ ] |
| 2.2.3 | Build genre distribution chart (pie/bar chart) | P1 | M | None | [ ] |
| 2.2.4 | Build rating distribution chart | P1 | M | None | [ ] |
| 2.2.5 | Build yearly activity chart (heatmap like GitHub) | P1 | L | None | [ ] |
| 2.2.6 | Build monthly activity breakdown | P1 | M | None | [ ] |
| 2.2.7 | Build weekday/hour viewing patterns | P2 | M | None | [ ] |
| 2.2.8 | Build TV completion stats | P1 | M | None | [ ] |
| 2.2.9 | Build "Top Rated" list (your highest rated items) | P1 | M | None | [ ] |
| 2.2.10 | Build "Most Watched Genre" highlight | P1 | S | None | [ ] |
| 2.2.11 | Add time period filter (all time, this year, this month, this week) | P1 | M | None | [ ] |
| 2.2.12 | Add "Share Stats" button (generates image) | P2 | L | None | [ ] |
| 2.2.13 | Add skeleton loading | P1 | S | 0.3.5-0.3.7 | [ ] |

### 2.3 Full Calendar Page (`/app/calendar`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 2.3.1 | Create page structure: `src/app/app/calendar/page.tsx` | P0 | S | None | [ ] |
| 2.3.2 | Build calendar grid view (month view with release dates) | P1 | L | None | [ ] |
| 2.3.3 | Build list view (upcoming releases sorted by date) | P1 | M | None | [ ] |
| 2.3.4 | Add filter by media type (movies, TV, both) | P1 | S | None | [ ] |
| 2.3.5 | Add filter by genre | P2 | M | None | [ ] |
| 2.3.6 | Add "Add to Watchlist" button per release | P1 | S | None | [ ] |
| 2.3.7 | Add "Notify Me" toggle for upcoming releases | P2 | M | None | [ ] |
| 2.3.8 | Add past releases section (what came out this week) | P1 | S | None | [ ] |
| 2.3.9 | Add skeleton loading | P1 | S | 0.3.5-0.3.7 | [ ] |

### 2.4 Dedicated Settings Page (`/app/settings`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 2.4.1 | Create page structure: `src/app/app/settings/page.tsx` | P0 | S | None | [ ] |
| 2.4.2 | Migrate profile setup tabs to this page (Profile, Privacy, Display) | P1 | M | None | [ ] |
| 2.4.3 | Add Notification Preferences tab | P1 | M | None | [ ] |
| 2.4.4 | Add Account tab (email, password change, user ID, delete account) | P1 | M | None | [ ] |
| 2.4.5 | Implement account deletion flow (with confirmation + cooldown) | P1 | L | None | [ ] |
| 2.4.6 | Add data export (JSON download of watched, reviews, diary, lists) | P1 | L | None | [ ] |
| 2.4.7 | Add theme toggle (dark/light/system) | P2 | M | None | [ ] |
| 2.4.8 | Add "Connected Accounts" section (for future social login) | P2 | S | None | [ ] |

### 2.5 Charts & Rankings Page (`/app/charts`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 2.5.1 | Create page structure: `src/app/app/charts/page.tsx` | P0 | S | None | [ ] |
| 2.5.2 | Build "Top 250 Movies" chart (TMDB API) | P1 | M | None | [ ] |
| 2.5.3 | Build "Top 250 TV Shows" chart | P1 | M | None | [ ] |
| 2.5.4 | Build "Most Popular This Week" chart | P1 | M | None | [ ] |
| 2.5.5 | Build "Most Popular This Month" chart | P1 | M | None | [ ] |
| 2.5.6 | Build "Box Office" chart (if TMDB provides revenue data) | P2 | M | None | [ ] |
| 2.5.7 | Build "Born Today" section (people born on this date) | P2 | M | None | [ ] |
| 2.5.8 | Build "On This Day in Cinema" section (movies released on this date) | P2 | M | None | [ ] |
| 2.5.9 | Add chart type tabs (Movies, TV, People) | P1 | S | None | [ ] |
| 2.5.10 | Add "Mark as Watched" quick action per chart item | P1 | S | None | [ ] |
| 2.5.11 | Add skeleton loading | P1 | S | 0.3.5-0.3.7 | [ ] |

### 2.6 Smart Watchlist Page (`/app/watchlist`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 2.6.1 | Create page structure: `src/app/app/watchlist/page.tsx` | P0 | S | None | [ ] |
| 2.6.2 | Build smart-sorted watchlist (predicted ratings from `/api/watchlist/smart`) | P1 | M | None | [ ] |
| 2.6.3 | Add sort options (smart, date added, title, release date, predicted rating) | P1 | M | None | [ ] |
| 2.6.4 | Add filter by genre | P1 | S | None | [ ] |
| 2.6.5 | Add filter by media type (movies, TV) | P1 | S | None | [ ] |
| 2.6.6 | Add "Watch Tonight" suggestions (based on runtime + your mood) | P2 | L | None | [ ] |
| 2.6.7 | Add "Remove from Watchlist" bulk action | P1 | M | None | [ ] |
| 2.6.8 | Add watchlist stats (total items, avg predicted rating, oldest item) | P1 | S | None | [ ] |
| 2.6.9 | Add skeleton loading | P1 | S | 0.3.5-0.3.7 | [ ] |

### 2.7 Browse Reviews Page (`/app/reviews`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 2.7.1 | Create page structure: `src/app/app/reviews/page.tsx` | P0 | S | None | [ ] |
| 2.7.2 | Build "From People You Follow" tab | P1 | M | None | [ ] |
| 2.7.3 | Build "Popular Reviews" tab (most liked) | P1 | M | None | [ ] |
| 2.7.4 | Build "Recent Reviews" tab | P1 | M | None | [ ] |
| 2.7.5 | Add filter by media type (movie, TV) | P1 | S | None | [ ] |
| 2.7.6 | Add filter by rating (1-3, 4-6, 7-10) | P1 | S | None | [ ] |
| 2.7.7 | Add search within reviews | P2 | M | None | [ ] |
| 2.7.8 | Add skeleton loading | P1 | S | 0.3.5-0.3.7 | [ ] |

### 2.8 Year in Review Page (`/app/annual-wrap`)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 2.8.1 | Create page structure: `src/app/app/annual-wrap/page.tsx` | P0 | S | None | [ ] |
| 2.8.2 | Build year selector (default: current year) | P1 | S | None | [ ] |
| 2.8.3 | Build "Total Watched" stat with comparison to previous year | P1 | M | None | [ ] |
| 2.8.4 | Build "Top 5 Movies" card | P1 | M | None | [ ] |
| 2.8.5 | Build "Top 5 TV Shows" card | P1 | M | None | [ ] |
| 2.8.6 | Build "Favorite Genre" highlight | P1 | S | None | [ ] |
| 2.8.7 | Build "Total Hours Watched" stat | P1 | M | None | [ ] |
| 2.8.8 | Build "Most Active Month" highlight | P1 | S | None | [ ] |
| 2.8.9 | Build "Average Rating" stat | P1 | S | None | [ ] |
| 2.8.10 | Build "Longest Binge" stat (most episodes in a day) | P2 | M | None | [ ] |
| 2.8.11 | Build "First Watched of the Year" highlight | P1 | S | None | [ ] |
| 2.8.12 | Build "Last Watched of the Year" highlight | P1 | S | None | [ ] |
| 2.8.13 | Add "Share as Image" button (generates shareable card) | P1 | L | None | [ ] |
| 2.8.14 | Add skeleton loading | P1 | S | 0.3.5-0.3.7 | [ ] |

### 2.9 Build Verification

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 2.9.1 | Run `npx next build` — must pass | P0 | S | All Phase 2 tasks | [ ] |
| 2.9.2 | Test all new pages in dev mode | P0 | M | 2.9.1 | [ ] |
| 2.9.3 | Test mobile responsiveness for all new pages | P0 | M | 2.9.1 | [ ] |
| 2.9.4 | Update navbar to include links to new pages | P1 | S | 2.9.1 | [ ] |
| 2.9.5 | Commit and push | P0 | S | 2.9.1-2.9.4 | [ ] |

---

## Phase 3: UX & Accessibility (Days 18-24)

> **Goal:** Fix all UX issues, add accessibility, improve mobile experience.

### 3.1 Loading States

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 3.1.1 | Add skeleton to movie detail page | P1 | M | 0.3.5-0.3.7 | [ ] |
| 3.1.2 | Add skeleton to TV detail page | P1 | M | 0.3.5-0.3.7 | [ ] |
| 3.1.3 | Add skeleton to person detail page | P1 | M | 0.3.5-0.3.7 | [ ] |
| 3.1.4 | Add skeleton to profile page | P1 | M | 0.3.5-0.3.7 | [ ] |
| 3.1.5 | Add skeleton to messages page | P1 | S | 0.3.5-0.3.7 | [ ] |
| 3.1.6 | Add skeleton to notifications page | P1 | S | 0.3.5-0.3.7 | [ ] |
| 3.1.7 | Add skeleton to search results page | P1 | S | 0.3.5-0.3.7 | [ ] |
| 3.1.8 | Add skeleton to genre pages | P1 | S | 0.3.5-0.3.7 | [ ] |
| 3.1.9 | Add skeleton to lists page | P1 | S | 0.3.5-0.3.7 | [ ] |

### 3.2 Empty States

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 3.2.1 | Add empty state for empty watchlist | P1 | S | 0.3.5 | [ ] |
| 3.2.2 | Add empty state for empty favorites | P1 | S | 0.3.5 | [ ] |
| 3.2.3 | Add empty state for empty diary | P1 | S | 0.3.5 | [ ] |
| 3.2.4 | Add empty state for empty lists | P1 | S | 0.3.5 | [ ] |
| 3.2.5 | Add empty state for empty activity feed | P1 | S | 0.3.5 | [ ] |
| 3.2.6 | Add empty state for no notifications | P1 | S | 0.3.5 | [ ] |
| 3.2.7 | Add empty state for no messages | P1 | S | 0.3.5 | [ ] |
| 3.2.8 | Add empty state for no search results | P1 | S | 0.3.5 | [ ] |
| 3.2.9 | Add empty state for no followers/following | P1 | S | 0.3.5 | [ ] |
| 3.2.10 | Add empty state for no watched items | P1 | S | 0.3.5 | [ ] |

### 3.3 Error Boundaries

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 3.3.1 | Wrap movie detail page content in ErrorBoundary | P1 | S | 0.3.8 | [ ] |
| 3.3.2 | Wrap TV detail page content in ErrorBoundary | P1 | S | 0.3.8 | [ ] |
| 3.3.3 | Wrap profile page tabs in ErrorBoundary (per tab) | P1 | M | 0.3.8 | [ ] |
| 3.3.4 | Wrap home page sections in ErrorBoundary (per section) | P1 | M | 0.3.8 | [ ] |
| 3.3.5 | Wrap feed page in ErrorBoundary | P1 | S | 0.3.8 | [ ] |
| 3.3.6 | Wrap stats page in ErrorBoundary | P1 | S | 0.3.8 | [ ] |
| 3.3.7 | Wrap calendar page in ErrorBoundary | P1 | S | 0.3.8 | [ ] |
| 3.3.8 | Wrap search results in ErrorBoundary | P1 | S | 0.3.8 | [ ] |

### 3.4 Mobile Responsiveness

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 3.4.1 | Test and fix all carousels on mobile (touch scroll, no arrow buttons needed) | P1 | M | None | [ ] |
| 3.4.2 | Test and fix navbar on mobile (burger menu works, search accessible) | P1 | M | None | [ ] |
| 3.4.3 | Test and fix movie detail page on mobile (poster stacks above details) | P1 | M | None | [ ] |
| 3.4.4 | Test and fix TV detail page on mobile | P1 | M | None | [ ] |
| 3.4.5 | Test and fix profile page on mobile (tabs scrollable, content stacks) | P1 | M | None | [ ] |
| 3.4.6 | Test and fix home page on mobile (sections stack, carousels work) | P1 | M | None | [ ] |
| 3.4.7 | Test and fix search modal on mobile (full screen, keyboard handling) | P1 | M | None | [ ] |
| 3.4.8 | Test and fix messages page on mobile (chat bubbles, input bar) | P1 | M | None | [ ] |
| 3.4.9 | Add bottom navigation bar for mobile (Home, Search, Feed, Profile) | P1 | L | None | [ ] |
| 3.4.10 | Ensure all touch targets are at least 44x44px | P1 | M | None | [ ] |

### 3.5 Accessibility

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 3.5.1 | Add ARIA labels to all icon buttons | P1 | M | None | [ ] |
| 3.5.2 | Add ARIA labels to all navigation links | P1 | M | None | [ ] |
| 3.5.3 | Add ARIA labels to all form inputs | P1 | M | None | [ ] |
| 3.5.4 | Add focus management for modals (trap focus, return on close) | P1 | M | None | [ ] |
| 3.5.5 | Add focus management for dropdown menus | P1 | M | None | [ ] |
| 3.5.6 | Add skip-to-content link | P1 | S | None | [ ] |
| 3.5.7 | Ensure all interactive elements are keyboard navigable | P1 | L | None | [ ] |
| 3.5.8 | Add `role` attributes to all sections and landmarks | P1 | M | None | [ ] |
| 3.5.9 | Ensure color contrast meets WCAG AA standards | P1 | M | None | [ ] |
| 3.5.10 | Add `alt` text to all images (posters, avatars, banners) | P1 | M | None | [ ] |
| 3.5.11 | Add `aria-live` regions for dynamic content (search results, notifications) | P2 | M | None | [ ] |
| 3.5.12 | Test with screen reader (VoiceOver/NVDA) | P2 | L | 3.5.1-3.5.11 | [ ] |

### 3.6 Keyboard Shortcuts

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 3.6.1 | Implement `/` to open search | P1 | S | None | [ ] |
| 3.6.2 | Implement `g h` to go to home | P2 | S | None | [ ] |
| 3.6.3 | Implement `g f` to go to feed | P2 | S | None | [ ] |
| 3.6.4 | Implement `g s` to go to stats | P2 | S | None | [ ] |
| 3.6.5 | Implement `g p` to go to profile | P2 | S | None | [ ] |
| 3.6.6 | Implement `esc` to close modals | P1 | S | None | [ ] |
| 3.6.7 | Implement `?` to show keyboard shortcuts help | P2 | M | None | [ ] |
| 3.6.8 | Add keyboard shortcuts help modal | P2 | M | 3.6.7 | [ ] |

### 3.7 Content Warnings

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 3.7.1 | Add content warning overlay for adult-rated content (blur + click to reveal) | P1 | M | None | [ ] |
| 3.7.2 | Add spoiler blur for reviews marked as containing spoilers | P1 | M | Phase 4 | [ ] |
| 3.7.3 | Add "Trigger Warning" tag option for reviews | P2 | M | Phase 4 | [ ] |

### 3.8 Build Verification

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 3.8.1 | Run `npx next build` — must pass | P0 | S | All Phase 3 tasks | [ ] |
| 3.8.2 | Run Lighthouse audit on key pages (home, movie, profile) | P1 | M | 3.8.1 | [ ] |
| 3.8.3 | Fix any Lighthouse accessibility issues | P1 | M | 3.8.2 | [ ] |
| 3.8.4 | Commit and push | P0 | S | 3.8.1-3.8.3 | [ ] |

---

## Phase 4: Feature Additions (Days 25-31)

> **Goal:** Add missing high-priority features that enhance the core experience.

### 4.1 Social Features

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 4.1.1 | Add comments on activity posts (database schema + API + UI) | P1 | XL | None | [ ] |
| 4.1.2 | Add comment count badge on activity cards | P1 | S | 4.1.1 | [ ] |
| 4.1.3 | Add nested replies to comments | P2 | L | 4.1.1 | [ ] |
| 4.1.4 | Add "Like" count display on activity cards | P1 | S | None | [ ] |
| 4.1.5 | Add follow request notifications with accept/reject | P1 | M | None | [ ] |
| 4.1.6 | Add "Suggested Friends" based on taste compatibility | P1 | M | None | [ ] |
| 4.1.7 | Add friend activity summary in notifications | P2 | M | None | [ ] |

### 4.2 Review System

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 4.2.1 | Add rich text editor for reviews (bold, italic, lists, links) | P1 | L | None | [ ] |
| 4.2.2 | Add spoiler toggle for reviews (blur content until clicked) | P1 | M | None | [ ] |
| 4.2.3 | Add review editing (with edit history) | P1 | M | None | [ ] |
| 4.2.4 | Add review deletion with confirmation | P1 | S | None | [ ] |
| 4.2.5 | Add "Helpful" vote on reviews (separate from like) | P2 | M | None | [ ] |
| 4.2.6 | Add review sorting on profile (by rating, by date, by helpful) | P1 | M | None | [ ] |

### 4.3 Diary Enhancements

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 4.3.1 | Add custom tags on diary entries | P1 | M | None | [ ] |
| 4.3.2 | Add mood selector on diary entries (emoji-based) | P1 | M | None | [ ] |
| 4.3.3 | Add location/context field ("Watched at cinema", "Date night") | P1 | M | None | [ ] |
| 4.3.4 | Add diary entry editing | P1 | S | None | [ ] |
| 4.3.5 | Add diary calendar view (see entries on a calendar) | P2 | M | None | [ ] |
| 4.3.6 | Add diary export (print-friendly view) | P2 | M | None | [ ] |

### 4.4 List Enhancements

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 4.4.1 | Add list collaboration (invite friends via link) | P1 | L | None | [ ] |
| 4.4.2 | Add list comments | P2 | M | 4.1.1 | [ ] |
| 4.4.3 | Add list description/rich text | P1 | M | 4.2.1 | [ ] |
| 4.4.4 | Add list cover image | P1 | M | None | [ ] |
| 4.4.5 | Add list reordering (drag and drop) | P2 | L | None | [ ] |
| 4.4.6 | Add list import from CSV/JSON | P2 | M | None | [ ] |

### 4.5 Notifications

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 4.5.1 | Implement browser push notifications (Service Worker + Push API) | P1 | XL | None | [ ] |
| 4.5.2 | Add notification preferences (toggle per notification type) | P1 | M | None | [ ] |
| 4.5.3 | Add email digest (weekly summary of friends' activity) | P2 | L | None | [ ] |
| 4.5.4 | Add notification sound toggle | P2 | S | None | [ ] |
| 4.5.5 | Add notification grouping (bundle similar notifications) | P2 | M | None | [ ] |

### 4.6 Profile Sharing

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 4.6.1 | Generate shareable profile card image (html2canvas) | P1 | L | None | [ ] |
| 4.6.2 | Add profile card customization (choose stats to show) | P2 | M | 4.6.1 | [ ] |
| 4.6.3 | Add "Copy Profile Link" button | P1 | S | None | [ ] |
| 4.6.4 | Add share to Twitter/X, Instagram Stories | P2 | M | 4.6.1 | [ ] |

### 4.7 Data Management

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 4.7.1 | Implement full account deletion (with 30-day cooldown) | P1 | L | None | [ ] |
| 4.7.2 | Implement data export (JSON + CSV) | P1 | L | None | [ ] |
| 4.7.3 | Add "Download My Data" button in settings | P1 | S | 4.7.2 | [ ] |
| 4.7.4 | Add data import from Letterboxd (CSV format) | P2 | XL | None | [ ] |
| 4.7.5 | Add data import from Trakt.tv (API) | P2 | XL | None | [ ] |

### 4.8 Build Verification

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 4.8.1 | Run `npx next build` — must pass | P0 | S | All Phase 4 tasks | [ ] |
| 4.8.2 | Test all new features in dev mode | P0 | M | 4.8.1 | [ ] |
| 4.8.3 | Test database migrations for new features | P0 | M | 4.8.1 | [ ] |
| 4.8.4 | Commit and push | P0 | S | 4.8.1-4.8.3 | [ ] |

---

## Phase 5: Innovative Features (Days 32-50)

> **Goal:** Build world-class differentiating features that set LetSee apart.

### 5.1 Taste DNA

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 5.1.1 | Create Taste DNA computation engine (genre vectors + rating patterns) | P1 | L | None | [ ] |
| 5.1.2 | Build interactive radar chart visualization | P1 | L | 5.1.1 | [ ] |
| 5.1.3 | Add taste comparison with friends (side-by-side radar) | P1 | M | 5.1.2 | [ ] |
| 5.1.4 | Add taste evolution over time (animated timeline) | P2 | L | 5.1.1 | [ ] |
| 5.1.5 | Add "Taste Match" score on movie/TV detail pages | P1 | M | 5.1.1 | [ ] |
| 5.1.6 | Add taste-based recommendations ("Perfect for your taste") | P1 | M | 5.1.1 | [ ] |

### 5.2 Smart Queue

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 5.2.1 | Build smart queue algorithm (expiring, trending, taste match, friends) | P1 | L | None | [ ] |
| 5.2.2 | Build "Watch Tonight" suggestion engine (time + mood + device) | P1 | L | None | [ ] |
| 5.2.3 | Build queue UI with drag-and-drop reordering | P1 | L | None | [ ] |
| 5.2.4 | Add auto-remove suggestions (items you'll never watch) | P2 | M | 5.2.1 | [ ] |
| 5.2.5 | Add queue sharing with friends | P2 | M | None | [ ] |
| 5.2.6 | Add "Why this is here" explanation per queue item | P1 | M | 5.2.1 | [ ] |

### 5.3 Cinema Mode

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 5.3.1 | Build full-screen movie detail view (no nav, no chrome) | P1 | M | None | [ ] |
| 5.3.2 | Add ambient lighting effect (screen color bleeds to edges) | P1 | L | None | [ ] |
| 5.3.3 | Add auto-dim UI when reading synopsis | P2 | M | None | [ ] |
| 5.3.4 | Add ambient sound option (theater ambiance, rain) | P2 | M | None | [ ] |
| 5.3.5 | Add cinema mode toggle button on movie detail pages | P1 | S | None | [ ] |

### 5.4 Mood Radar

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 5.4.1 | Build multi-axis mood selector (energy, emotion, complexity, familiarity) | P1 | L | None | [ ] |
| 5.4.2 | Build mood-to-genre mapping engine | P1 | M | None | [ ] |
| 5.4.3 | Build mood-based recommendation results | P1 | M | 5.4.2 | [ ] |
| 5.4.4 | Add mood history tracking | P2 | M | None | [ ] |
| 5.4.5 | Add mood visualization on profile | P2 | M | 5.4.4 | [ ] |
| 5.4.6 | Replace current "What to Watch" with Mood Radar | P1 | L | 5.4.1-5.4.3 | [ ] |

### 5.5 Cinephile Challenges

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 5.5.1 | Design challenge system (database schema + API) | P1 | L | None | [ ] |
| 5.5.2 | Build weekly challenges UI | P1 | M | 5.5.1 | [ ] |
| 5.5.3 | Build friend challenges (compete to watch most in genre) | P1 | M | 5.5.1 | [ ] |
| 5.5.4 | Build achievement badge system | P1 | L | 5.5.1 | [ ] |
| 5.5.5 | Build challenge leaderboards | P2 | M | 5.5.1 | [ ] |
| 5.5.6 | Build shareable achievement cards | P2 | M | 5.5.4 | [ ] |

### 5.6 Director's Cut (Curated Journeys)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 5.6.1 | Design curated journey system (database schema) | P1 | L | None | [ ] |
| 5.6.2 | Build "The Kubrick Experience" journey (pre-curated) | P1 | M | 5.6.1 | [ ] |
| 5.6.3 | Build "Actor Retrospective" journey generator | P1 | M | 5.6.1 | [ ] |
| 5.6.4 | Build "Genre Evolution" journey generator | P2 | L | 5.6.1 | [ ] |
| 5.6.5 | Build journey progress tracking | P1 | M | 5.6.1 | [ ] |
| 5.6.6 | Build journey sharing | P2 | M | 5.6.1 | [ ] |

### 5.7 Review Assistant (AI)

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 5.7.1 | Build AI review structure generator (OpenAI API) | P1 | L | None | [ ] |
| 5.7.2 | Build "What stood out?" prompts (acting, cinematography, story) | P1 | M | None | [ ] |
| 5.7.3 | Build auto-generate review from diary notes | P1 | M | 5.7.1 | [ ] |
| 5.7.4 | Build tone adjustment (casual, analytical, humorous) | P2 | M | 5.7.1 | [ ] |
| 5.7.5 | Build AI review preview before posting | P1 | S | 5.7.1 | [ ] |

### 5.8 Build Verification

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 5.8.1 | Run `npx next build` — must pass | P0 | S | All Phase 5 tasks | [ ] |
| 5.8.2 | Test all innovative features in dev mode | P0 | M | 5.8.1 | [ ] |
| 5.8.3 | Performance test (Lighthouse) | P1 | M | 5.8.1 | [ ] |
| 5.8.4 | Commit and push | P0 | S | 5.8.1-5.8.3 | [ ] |

---

## Phase 6: Polish & Performance (Days 51-60)

> **Goal:** Optimize everything, add final polish, prepare for production.

### 6.1 Performance

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 6.1.1 | Implement streaming SSR for home page | P1 | L | None | [ ] |
| 6.1.2 | Implement streaming SSR for profile page | P1 | L | None | [ ] |
| 6.1.3 | Replace all `<img>` with `<Image>` from next/image | P1 | M | None | [ ] |
| 6.1.4 | Add image optimization for posters (WebP, responsive sizes) | P1 | M | 6.1.3 | [ ] |
| 6.1.5 | Add route prefetching for likely next pages | P1 | M | None | [ ] |
| 6.1.6 | Add service worker for offline caching | P1 | L | None | [ ] |
| 6.1.7 | Optimize database queries (add indexes, reduce N+1) | P1 | L | None | [ ] |
| 6.1.8 | Add API response caching (Redis or in-memory) | P1 | L | None | [ ] |
| 6.1.9 | Add bundle analysis (`npx next build --analyze`) | P1 | S | None | [ ] |
| 6.1.10 | Split large bundles (code splitting for heavy components) | P1 | M | 6.1.9 | [ ] |

### 6.2 Theme System

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 6.2.1 | Implement light mode theme (CSS variables for all colors) | P1 | L | None | [ ] |
| 6.2.2 | Add theme toggle in settings (dark/light/system) | P1 | M | 6.2.1 | [ ] |
| 6.2.3 | Test all components in light mode | P1 | M | 6.2.1 | [ ] |
| 6.2.4 | Fix any light mode styling issues | P1 | M | 6.2.3 | [ ] |
| 6.2.5 | Add custom theme support (user picks accent color) | P2 | L | 6.2.1 | [ ] |

### 6.3 Analytics

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 6.3.1 | Add page view tracking | P1 | M | None | [ ] |
| 6.3.2 | Add search query tracking | P1 | S | None | [ ] |
| 6.3.3 | Add feature usage tracking | P1 | M | None | [ ] |
| 6.3.4 | Add error tracking (Sentry or similar) | P1 | M | None | [ ] |
| 6.3.5 | Add performance monitoring (Core Web Vitals) | P1 | M | None | [ ] |
| 6.3.6 | Build analytics dashboard (admin only) | P2 | L | 6.3.1-6.3.5 | [ ] |

### 6.4 Final Polish

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 6.4.1 | Run full Lighthouse audit on all pages | P1 | M | None | [ ] |
| 6.4.2 | Fix all Lighthouse issues (performance, accessibility, SEO, best practices) | P1 | L | 6.4.1 | [ ] |
| 6.4.3 | Run full accessibility audit (axe DevTools) | P1 | M | None | [ ] |
| 6.4.4 | Fix all accessibility issues | P1 | L | 6.4.3 | [ ] |
| 6.4.5 | Test on all major browsers (Chrome, Firefox, Safari, Edge) | P1 | M | None | [ ] |
| 6.4.6 | Test on all major devices (desktop, tablet, mobile) | P1 | M | None | [ ] |
| 6.4.7 | Add PWA manifest improvements (icons, splash screen) | P2 | M | None | [ ] |
| 6.4.8 | Add SEO improvements (meta tags, structured data, sitemap) | P1 | M | None | [ ] |
| 6.4.9 | Add robots.txt | P1 | S | None | [ ] |
| 6.4.10 | Add sitemap.xml generation | P1 | M | None | [ ] |

### 6.5 Documentation

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 6.5.1 | Update README with new features | P1 | M | None | [ ] |
| 6.5.2 | Update API documentation | P1 | M | None | [ ] |
| 6.5.3 | Update database schema documentation | P1 | M | None | [ ] |
| 6.5.4 | Create user guide / help page | P2 | L | None | [ ] |
| 6.5.5 | Create contributor guide | P2 | M | None | [ ] |

### 6.6 Final Build & Deploy

| ID | Task | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|
| 6.6.1 | Run `npx next build` — must pass with zero errors | P0 | S | All Phase 6 tasks | [ ] |
| 6.6.2 | Run `npx next lint` — must pass with zero errors | P0 | S | 6.6.1 | [ ] |
| 6.6.3 | Run full test suite (if tests exist) | P0 | M | 6.6.1 | [ ] |
| 6.6.4 | Deploy to production | P0 | M | 6.6.1-6.6.3 | [ ] |
| 6.6.5 | Monitor production for 48 hours | P0 | S | 6.6.4 | [ ] |
| 6.6.6 | Fix any production issues | P0 | M | 6.6.5 | [ ] |

---

## Quick Reference: Task Summary by Priority

### P0 (Critical — Do First)
- 0.1.15 Build verification after cleanup
- 0.4.1 Build verification Phase 0
- 0.4.3 Verify renamed imports
- 1.3.1 Reduce home sections from 25 to 12-15
- 1.8.1 Lazy load profile tabs
- 1.8.8 Optimize profile initial load
- 2.1.1 Create feed page structure
- 2.2.1 Create stats page structure
- 2.3.1 Create calendar page structure
- 2.4.1 Create settings page structure
- 2.5.1 Create charts page structure
- 2.6.1 Create watchlist page structure
- 2.7.1 Create reviews page structure
- 2.8.1 Create annual wrap page structure
- All build verification tasks (`.1` at end of each phase)

### P1 (High — Major Impact)
- All skeleton loading states
- All empty states
- All error boundaries
- All mobile responsiveness fixes
- All accessibility improvements
- All new page content (Phase 2)
- All Phase 1 UI overhaul tasks
- All Phase 4 feature additions
- All Phase 5 innovative features

### P2 (Medium — Important)
- File renaming and typo fixes
- Social login UI
- Advanced features (collaboration, import/export)
- Theme system
- Analytics
- Documentation

### P3 (Low — Nice to Have)
- Custom themes
- Advanced chart features
- Poll system
- Franchise tracker enhancements

---

## Dependency Graph (Critical Path)

```
Phase 0 (Cleanup)
    ↓
Phase 1 (UI Overhaul) ← Depends on Phase 0 design tokens
    ↓
Phase 2 (Missing Pages) ← Depends on Phase 1 design language
    ↓
Phase 3 (UX & Accessibility) ← Depends on Phase 1-2 pages existing
    ↓
Phase 4 (Feature Additions) ← Depends on Phase 3 stability
    ↓
Phase 5 (Innovative Features) ← Depends on Phase 4 core features
    ↓
Phase 6 (Polish & Performance) ← Depends on everything above
```

### Parallel Work Opportunities
- Phase 2 pages can be built in parallel (feed, stats, calendar, settings, charts, watchlist, reviews, annual wrap)
- Phase 3 loading states can be built in parallel with Phase 2 pages
- Phase 4 features can be built in parallel (social, reviews, diary, lists, notifications)
- Phase 5 innovative features can be built in parallel (Taste DNA, Smart Queue, Cinema Mode, Mood Radar)

---

## Estimated Timeline

| Phase | Duration | Start | End | Status |
|---|---|---|---|---|
| Phase 0: Cleanup & Foundation | 3 days | Day 1 | Day 3 | [ ] |
| Phase 1: Core UI Overhaul | 7 days | Day 4 | Day 10 | [ ] |
| Phase 2: Missing Pages | 7 days | Day 11 | Day 17 | [ ] |
| Phase 3: UX & Accessibility | 7 days | Day 18 | Day 24 | [ ] |
| Phase 4: Feature Additions | 7 days | Day 25 | Day 31 | [ ] |
| Phase 5: Innovative Features | 19 days | Day 32 | Day 50 | [ ] |
| Phase 6: Polish & Performance | 10 days | Day 51 | Day 60 | [ ] |
| **Total** | **60 days** | | | |

---

*This is a living document. Update task statuses as you work through them.*
*Mark completed tasks with `[x]` and add notes for any deviations from the plan.*
