# Profile Page — Complete Research & Upgrade Plan

> Analysis of the current LetSee profile page with recommendations for a world-class upgrade across four viewing modes: **Owner**, **Friend**, **Non-Friend (Public)**, **Anonymous**.

---

## 1. Current State Critique

### What Works Well
- Hero section is solid: banner, avatar, username, tagline, bio, stats strip, follow/message
- Visibility system (public/followers/private) is correctly enforced at API + RLS layers
- Taste in 4 is a good signature feature
- Viewing Dashboard (Chart.js, Year-in-Review export) is production-quality
- Smart Watchlist (drag-to-reorder, batch actions) is strong
- TV Progress panel with grid/list/calendar views is comprehensive

### What's Missing or Weak
| Issue | Details |
|-------|---------|
| **No profile completeness** | No guidance for new users on what to add next |
| **Section ordering is disjointed** | Taste in 4 → Currently Watching → Anime TV → Anime Movies → Highlights → Series Progress → Tabs. Too many standalone sections before tabs |
| **Hero lacks personality** | No theme/color customization, no website/social links, no location, no join date |
| **Friend view is identical to public** | Being a friend offers no special content or visual differentiation |
| **No quick-access navigation** | No sticky sub-nav or jump-to-section links for the above-hero sections |
| **Taste summary missing** | No "Loves Action, Sci-Fi; Avoids Horror" auto-generated summary |
| **Year in Review hidden** | Only in Dashboard tab (owner-only). Should be a shareable card on the profile |
| **Activity feed is basic** | Just recent watched items with timestamps — no social activity (follows, reviews, lists) |
| **No achievement/milestone system** | No badges, no "100th film" celebrations |
| **Anonymous experience is empty** | No teaser content, no "sign up to see more" value proposition |
| **Stats strip is just numbers** | No visualizations, no comparisons, no "this year vs last year" |
| **No QR code or shareable profile link** | Can't easily share profile outside the app |
| **No comparative stats** | No "you and X" comparisons outside the compatibility widget |
| **Profile edit flow is separate** | Settings at `/app/profile/setup` — no inline edit on profile page |

---

## 2. Four View Modes — Detailed Requirements

### 2.1 Owner View
**Who**: The profile's owner, logged in.

| Element | Behavior |
|---------|----------|
| Hero | Editable banner/avatar. "Edit profile" button. Visibility dropdown. |
| Stats strip | Full counts. "View Dashboard" shortcut. |
| Taste in 4 | Edit button, empty state with guidance. "Pick your 4" CTA if empty. |
| Currently Watching | Full management: add/remove/reorder. "Mark as done" button. |
| Highlights | Edit featured list / pin review. Empty state with setup CTA. |
| Series Progress | Full controls: manage episodes, mark next, batch update. |
| Profile completeness | Persistent banner/widget showing next suggested action. |
| Dashboard tab | Full Chart.js analytics, Year-in-Review export, export all as PNG. |
| Diary tab | Own ratings visible, private notes/diary shown. |
| Reviews tab | Own reviews with edit/delete. |
| Quick actions | "Add to diary" floating button, "Log a film" shortcut. |
| Settings shortcuts | Inline edit for banner, avatar, tagline, bio — no navigation to setup page. |
| Activity feed | All own activity (watched, reviewed, followed, listed). |

### 2.2 Friend View (following each other)
**Who**: Logged-in user who follows the profile owner AND is followed back (mutual).

| Element | Behavior |
|---------|----------|
| Hero | Follow button shows "Following + Friend". Message button prominent. |
| Friend Compatibility | Large, prominent — shown as hero sub-section with detail expand. |
| Content | Full access (same as public) **plus** friend-exclusive sections. |
| Friend-only sections | Mutual "recommendations for you" strip. "Compare stats" button. |
| Activity feed | Shows friend-specific interactions (e.g. "You both watched X"). |
| Shared lists | "View lists you have in common" widget. |
| Privacy | Still respects private items — friend status is not a bypass. |

### 2.3 Non-Friend (Public Profile)
**Who**: Logged-in user, not following, profile set to public.

| Element | Behavior |
|---------|----------|
| Hero | Follow button. Message button. Login prompt (anon). |
| Friend Compatibility | Compact version. "Follow to see full compatibility" upsell. |
| Content | All public content visible. |
| Highlights | Visible if exists. |
| Stats | View-only stats strip. Dashboard tab hidden. |
| Interaction | Follow, message, share profile. |

### 2.4 Anonymous View
**Who**: Not logged in.

| Element | Behavior |
|---------|----------|
| Hero | "Log in to follow or message" prompt. No buttons. |
| Content | Public content only. Teasers for gated content. |
| Conversion | "Sign up free — start tracking your watching" banner. |
| Highlights | Visible. |
| Stats | View-only. |
| Restrictions | No interactive elements. Login/signup CTA on follow, message, compatibility. |

---

## 3. Proposed Section Order & Layout

### New Layout (top to bottom)

```
┌─────────────────────────────────────────────────────────┐
│  1. HERO SECTION                                         │
│     [Banner | Avatar | @username | Tagline | Bio]        │
│     [Website · Location · Joined Date]                   │
│     [Edit Profile] [Visibility]  [Follow] [Message]      │
│     [1.2K Following] [1.5K Followers]                    │
│     [Stats Bar: Watched · This Year · Movies · TV · Episodes · Hours]  │
│     └── Profile Completeness Bar (owner only) ──────────┘   │
├─────────────────────────────────────────────────────────┤
│  2. FRIEND COMPATIBILITY (non-owner, logged-in)          │
│     [Radial match %] [Genre overlap] [Shared ratings]    │
│     [▼ Expand: genre breakdown, top shared picks]        │
├─────────────────────────────────────────────────────────┤
│  3. TASTE SUMMARY (auto-generated)                       │
│     "Loves Action, Sci-Fi · Rates high: Drama · Avoids: Horror"  │
│     [4 genre affinity pills with scores]                 │
├─────────────────────────────────────────────────────────┤
│  4. TASTE IN 4                                           │
│     [4 poster grid, larger than current]                 │
│     [Edit button (owner)] [Empty state CTA]              │
├─────────────────────────────────────────────────────────┤
│  5. YEAR IN REVIEW SNAPSHOT (current year)               │
│     [Movies] [Shows] [Hours] [Days] [Top Genre]          │
│     [▲▼ Toggle detail] [Export PNG] [Share]              │
├─────────────────────────────────────────────────────────┤
│  6. HIGHLIGHTS (if featured list or pinned review)       │
│     [Featured List Card] [Pinned Review Card]            │
├─────────────────────────────────────────────────────────┤
│  7. STICKY SECTION NAV (sub-nav / quick tabs)            │
│     [Diary] [Reviews] [Films] [Lists] [Stats] [Activity] [Series] │
│     └── Sticky on scroll ────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  8. TAB CONTENT (full height, replaces page sections     │
│     below the sticky nav)                                 │
│                                                          │
│     Diary Tab:                                            │
│     ┌───────────────────────────────────────────────────┐│
│     │ Paginated grid, year/month filter, rating badges  ││
│     │ Calendar heatmap showing watch activity           ││
│     │ "On this day" highlights                          ││
│     └───────────────────────────────────────────────────┘│
│                                                          │
│     Reviews Tab:                                         │
│     ┌───────────────────────────────────────────────────┐│
│     │ Review cards with star rating, text preview,      ││
│     │ Like/comment counts, sort by recent/popular       ││
│     └───────────────────────────────────────────────────┘│
│                                                          │
│     Films Tab (Watched Grid):                            │
│     ┌───────────────────────────────────────────────────┐│
│     │ Filterable grid, genre/media type/year filters    ││
│     │ Stats: "245 movies · 89 TV shows" header          ││
│     └───────────────────────────────────────────────────┘│
│                                                          │
│     Lists Tab:                                           │
│     ┌───────────────────────────────────────────────────┐│
│     │ List cards with cover, count, visibility badge    ││
│     │ "Create list" CTA (owner)                         ││
│     └───────────────────────────────────────────────────┘│
│                                                          │
│     Stats Tab:                                           │
│     ┌───────────────────────────────────────────────────┐│
│     │ Overview cards + genre bars + rating dist +       ││
│     │ yearly activity + TV completion + streaks         ││
│     └───────────────────────────────────────────────────┘│
│                                                          │
│     Activity Tab:                                        │
│     ┌───────────────────────────────────────────────────┐│
│     │ Social feed: watched, reviewed, followed, listed, ││
│     │ recommendations — with interaction buttons        ││
│     └───────────────────────────────────────────────────┘│
│                                                          │
│     Series Tab:                                          │
│     ┌───────────────────────────────────────────────────┐│
│     │ Grid/list/calendar views (moved from standalone)  ││
│     └───────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  9. CURRENTLY WATCHING (inline within Series tab)        │
├─────────────────────────────────────────────────────────┤
│ 10. FOOTER                                               │
│     [Share Profile] [Report] [Block]                     │
│     [Joined Date] [Last Active]                          │
└─────────────────────────────────────────────────────────┘
```

### Why this ordering?
1. **Hero first** — identity and social proof
2. **Compatibility** — social hook for visitors, shown early
3. **Taste Summary** — instant understanding of the user's taste (new)
4. **Taste in 4** — visual signature, compact
5. **Year In Review** — impressive highlight reel, shareable (new on profile)
6. **Highlights** — curated best content
7. **Sticky Nav** — always-accessible tab switching, replaces scattered standalone sections
8. **Tab Content** — main browsing area, better organized
9. **Currently Watching → integrated into Series tab** — reduces top-level clutter
10. **Footer** — utility links, social proof

---

## 4. Missing Feature Specifications

### 4.1 Profile Completeness Bar (Owner Only)
**What**: A horizontal progress bar below the hero stats showing profile completion percentage.
**Logic**:
- Fields checked: avatar, banner, tagline, bio, website, location, taste-in-4 filled, featured list set, pinned review set
- Each field = 10-15% weight
- Clicking the bar scrolls to the next missing section or opens the relevant modal
**UX**: Green/gray gradient bar with "Complete your profile — 60% done" text. Dismissible.

### 4.2 Auto-Generated Taste Summary
**What**: A compact card showing "Loves X, Y, Z" derived from genre affinities.
**Logic**:
- From `buildGenreProfile()` in Smart Watchlist API: top 3 positive-affinity genres = "Loves"
- Genres with affinity < -0.3 = "Avoids"
- Genre with highest average rating = "Rates high"
- Cached and updated on new rating
**UX**: Pills with icons: ❤️ Action, 🔥 Sci-Fi, ⭐ Drama. Green/red color coding.

### 4.3 Year in Review on Profile (All Viewers)
**What**: A compact version of the dashboard's Year-in-Review card, visible to all viewers (owner sees full + edit).
**Data**: Same as dashboard API's `yearInReview` section.
**UX**: Collapsible card. Shows: movies, shows, hours, days, top genre. "View full dashboard" link (owner) or "See your year" upsell (non-owner).

### 4.4 Sticky Section Navigation
**What**: A horizontal tab bar that sticks to the top of the viewport when scrolling past the hero.
**Tabs**: Diary · Reviews · Films · Lists · Stats · Activity · Series (owner: + Dashboard)
**UX**: Active tab underlined. Smooth scroll to section. "Back to top" floating button.

### 4.5 Achievement / Milestone System
**What**: Badges earned for reaching viewing milestones.
**Logic**:
- `watched_count >= 100` → "Century Club" badge
- `ratings_count >= 50` → "Critic" badge
- `watchlist_count >= 50` → "Curator" badge
- `streak_longest >= 30` → "Dedicated" badge
- `genres_watched >= 10` → "Explorer" badge
**UX**: Row of badge icons below the hero stats. Click to see details. Owner sees "+" for more.

### 4.6 Website & Social Links
**What**: Fields for website URL, Twitter/Letterboxd/Instagram handles in profile setup.
**Display**: Icon links in the hero section. Website shows as 🌐 link. Social shows as platform icon.
**Logic**: Validated URL. Displayed only if non-empty.

### 4.7 Location & Joined Date
**What**: "📍 New York, NY" and "Joined January 2024" in hero sub-text.
**Logic**: Location from profile setup. Joined date from `users.created_at`.

### 4.8 Profile QR Code
**What**: A QR code linking to the profile URL.
**UX**: Small icon button in the hero that opens a modal with the QR code + "Share profile" options.
**Implementation**: Use `qrcode` npm package or a simple QR API URL.

### 4.9 "On This Day" Widget (Diary Tab)
**What**: In the Diary tab, a small section showing what the user watched on this date in previous years.
**Logic**: Query `watched_items` where month/day match today, year < current year.
**UX**: Small horizontal strip of cards. "On this day in 2024, 2023..."

### 4.10 Activity Feed Enhancements
**Current**: Just recent watched items.
**Proposed**: Full social feed showing:
- "Watched [movie]" (with rating)
- "Reviewed [movie]" (with review snippet)
- "Followed [user]"
- "Added [list] — [list name]"
- "Completed [show]"
- "[User] recommended [item] to [user]"
- "Logged [N] episodes of [show]"
**Logic**: Unified feed from multiple tables (`watched_items`, `user_connections`, `user_lists`, `user_tv_list`, `messages.recommendations`).

### 4.11 Profile Themes / Banner Colors
**What**: When no banner image is set, use a gradient based on the user's top genre color.
**Logic**: Map top genre to a color (Action → red, Sci-Fi → purple, Comedy → yellow, Drama → blue). Apply as CSS gradient.
**Plus**: Owner can pick from 8 preset gradient themes in profile setup.

### 4.12 Comparative Stats (Friend View)
**What**: "You and [username]" stats widget.
**Data**:
- Shared watched count
- Genre overlap %
- Rating correlation
- "You both loved [movie]" cards
- "You rate [genre] higher, they rate [genre] higher"
**UX**: Expandable section in the compatibility area. Owner can pin to profile.

### 4.13 Inline Profile Editing
**What**: Owner can edit tagline, bio, avatar, banner directly on the profile page without navigating to `/setup`.
**UX**: Hover-reveal edit pencil on each hero element. Opens inline text input or file picker. Auto-saves on blur or with save button.
**Logic**: PATCH `/api/profile/settings` for each field.

### 4.14 Profile Share Sheet
**What**: Share button in the footer that opens the native share dialog (Web Share API) with profile URL and text.
**Fallback**: Copy link button for browsers without Web Share API.

---

## 5. UI/UX Design Recommendations

### 5.1 Visual Design Language
- **Glassmorphism**: Frosted glass cards (`backdrop-blur-sm bg-surface-900/40 border border-surface-800/50`) — already used in Dashboard, extend to all profile cards
- **Gradient accents**: Subtle genre-colored gradients in section headers
- **Consistent spacing**: 24px gap between sections, 16px internal padding
- **Typography**: Monospace for stats numbers, clean sans-serif for body

### 5.2 Hero Redesign
```
┌──────────────────────────────────────────────────────────────┐
│  [BANNER IMAGE — 3:1 aspect ratio, or gradient fallback]      │
│  ┌──────────┐                                                  │
│  │  AVATAR  │  @username          [Edit] [Visibility ▼]       │
│  │  (120px) │  "tagline"                                      │
│  └──────────┘  Bio text — max 2 lines, expand on click        │
│                🌐 website.xyz  ·  📍 NYC  ·  Joined Jan 2024  │
│                                                                │
│  [1.2K Following] [1.5K Followers]    [Follow] [Message]      │
│                                                                │
│  ┌──────┬──────┬──────┬──────┬──────┬────────┐               │
│  │ 245  │  89  │ 1.2K │  12  │ 450  │ 1,200h │               │
│  │Movies│  TV  │Episodes│Watch│ThisYr│ Hours  │               │
│  └──────┴──────┴──────┴──────┴──────┴────────┘               │
│  [████████████░░░░░░░] Profile: 65% complete  [Dismiss]      │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Staggered Entrance Animations
- Sections fade in + slide up on scroll with 80ms delay between sections
- Cards within a section stagger at 50ms
- Use `@keyframes` or IntersectionObserver with CSS `animation-delay`

### 5.4 Empty States
- **Owner**: Action-oriented — "Add your 4 favorite titles", "Write your first review", "Track your first TV show"
- **Visitor**: Informational — "No reviews yet — follow along!"
- **Anonymous**: Conversion — "Sign up to see what [username] has been watching"
- Each empty state should include an illustration/emoji and a clear CTA

### 5.5 Loading States
- **Skeleton loading**: Pulse-animated gray cards matching final layout shape
- **Hero skeleton**: Banner placeholder + avatar circle + text lines
- **Content skeleton**: 3-5 card placeholders per tab
- **Avoid spinners**: Use content-aware skeletons that hint at final layout

### 5.6 Responsive Breakpoints
| Breakpoint | Layout Changes |
|------------|---------------|
| < 640px | Single column. Hero compact. Stats as 2×3 grid. Tabs as horizontal scroll. |
| 640-1024px | 2-column for certain sections. Side-by-side compatibility + taste. |
| > 1024px | Full layout as specified. Max-width 5xl centered. |

---

## 6. Ability & Logic Upgrades

### 6.1 Profile API Consolidation
**Current**: `fetchProfileData()` runs 20+ individual Supabase queries sequentially.
**Problem**: Many round trips, slow initial load.
**Solution**: Consolidate into a single BFF endpoint `GET /api/profile/{username}` that runs all queries server-side in parallel and returns a single response.

### 6.2 Caching Strategy
- Profile data cached for 60 seconds (CDN or Next.js `stale-while-revalidate`)
- Stats cached for 5 minutes (rarely changes between page views)
- Owner always gets fresh data (`no-store`)

### 6.3 Visibility Cascade Logic
Current:
```
isOwner → full access
public → content visible
followers + isFollowing → content visible
else → VisibilityGate
```

Improved:
```
isOwner → full access + edit controls
isFriend (mutual follow) → full content + friend-only features
loggedIn + public → all public content
loggedIn + followers + isFollowing → all public content
loggedIn + followers + !isFollowing → teaser + follow prompt
anon → public content + limited preview + signup CTA
private + !owner → VisibilityGate (no exceptions)
```

### 6.4 Taste Profile Caching
The genre affinity profile (used for Smart Watchlist, Taste Summary, Friend Compatibility) should be:
- Computed once after each new rating
- Stored in `user_genre_profile` table
- Re-fetched instead of recomputed every time

### 6.5 Batch Operations for Profile
- "Mark all as watched" for a TV season
- "Add all to watchlist" for a franchise
- "Export my data" (JSON/CSV of watched items, ratings, reviews)

---

## 7. Implementation Priority

### Phase 1 — Quick Wins (1-2 days)
- [ ] Hero redesign: compact stats row, inline edit for tagline/bio
- [ ] Taste Summary card (auto-generated from existing API data)
- [ ] Location + Joined Date in hero
- [ ] Website/social links in hero
- [ ] Empty state improvements for all sections
- [ ] Skeleton loading for hero and grid
- [ ] Profile completeness bar (owner only)

### Phase 2 — Structural (2-3 days)
- [ ] Section reordering (move standalone sections into tabs)
- [ ] Sticky section navigation
- [ ] Activity feed enhancements (multi-type feed)
- [ ] Year in Review on profile (compact version)
- [ ] Profile share sheet (Web Share API)
- [ ] Responsive improvements

### Phase 3 — Social & Advanced (3-4 days)
- [ ] Friend view differentiation (friend-only widgets)
- [ ] Comparative stats widget
- [ ] Achievement/milestone badges
- [ ] "On This Day" in Diary tab
- [ ] Profile QR code
- [ ] Profile themes / banner gradient fallback
- [ ] Profile API consolidation
- [ ] Anonymous experience improvements

### Phase 4 — Polish (2-3 days)
- [ ] Staggered entrance animations
- [ ] Glassmorphism design consistency
- [ ] Profile editing without navigation to /setup
- [ ] Taste profile caching (DB table)
- [ ] Batch operations
- [ ] Loading skeleton variants for every section

---

## 8. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/components/profile/ProfileCompletenessBar.tsx` | Profile completion tracker |
| `src/components/profile/TasteSummary.tsx` | Auto-generated "Loves X, Y" card |
| `src/components/profile/ProfileYearInReview.tsx` | Compact Year in Review for profile |
| `src/components/profile/StickySectionNav.tsx` | Sticky tab navigation for sections |
| `src/components/profile/AchievementBadges.tsx` | Milestone badge display |
| `src/components/profile/ComparativeStats.tsx` | "You and X" comparison widget |
| `src/components/profile/ProfileShareSheet.tsx` | Share/QR functionality |
| `src/components/profile/OnThisDay.tsx` | "On this day in history" widget |
| `src/app/api/profile/[username]/route.ts` | Consolidated profile API |

### Files to Modify
| File | Changes |
|------|---------|
| `src/app/app/profile/[id]/page.tsx` | Section ordering, new components, view-based rendering |
| `src/components/profile/ProfileHeroNew.tsx` | Inline editing, links, location, completeness |
| `src/components/profile/ProfileTabsNew.tsx` | Additional tabs (Series), sticky behavior |
| `src/components/profile/FilmDiary.tsx` | On This Day widget, calendar heatmap |
| `src/components/profile/ActivityFeed.tsx` | Multi-type activity feed |
| `src/components/profile/FriendCompatibility.tsx` | Expandable detail, comparative stats |
| `src/components/profile/VisibilityGate.tsx` | Anonymous upsell improvements |
| `src/app/app/profile/setup/page.tsx` | Website, location, theme fields |

---

## 9. Research References (Best-in-Class)

| Platform | Key Features to Steal |
|----------|----------------------|
| **Letterboxd** | Taste in 4, film diary as primary, year in review cards, stats per genre, "on this day" |
| **Trakt** | Calendar heatmap, progress tracking, comparative stats with friends, scrobbling |
| **MyAnimeList** | Comprehensive stats page, genre affinity chart, "days spent watching", completion badges |
| **IMDb** | Ratings distribution bar, "known for" section, quick stats in hero |
| **GitHub** | Contribution heatmap, profile README, achievement badges, pinned repos (like Taste in 4) |
| **Goodreads** | Reading challenge progress, yearly wrap-up, friend activity feed, bookshelves (like lists) |
