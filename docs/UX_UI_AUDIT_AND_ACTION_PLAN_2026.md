# LetSee UX/UI Audit and Action Plan

**Audit date:** 28 September 2026

**Scope:** all 37 page routes, shared navigation, responsive layout, loading/empty/error states, and the core component system
**Evidence:** current source code, signed-in production walkthroughs, desktop and mobile viewport checks, and established design-system/accessibility guidance

## 1. Executive diagnosis

LetSee already has the feature depth of a serious product: logging, ratings, reviews, TV progress, social activity, lists, recommendations, provider availability, clubs, messages, imports, exports, and unusually rich taste data. The primary problem is not missing features. It is that too many features are presented at the same visual and informational level.

The current experience often feels like a feature inventory instead of a task-led product:

- Home asks the user to absorb a large hero, profile dashboard, quick links, social feed, trends, people, releases, and genres before it establishes one clear next action.
- Movie, TV, person, and profile pages become extremely long documents. Important actions are mixed with exhaustive reference data.
- The same content appears in several places: navigation, home quick actions, profile sections, watchlist, and discovery shelves.
- Pages use many locally invented layouts, colors, card treatments, widths, and section headings. They belong to the same dark theme, but not yet to one disciplined design system.
- Loading is improved, but several deferred areas still reserve large blank regions or stay visually dominant longer than the information deserves.
- Mobile layouts generally reflow, but long content does not become simpler. A single-column version of a very long desktop page is still a very long page.

The north-star change is:

> Organize every screen around the decision the user came to make, then progressively disclose the reference material.

## 2. What is already strong

These elements should be retained and refined rather than redesigned from scratch:

- The dark neutral palette, green brand color, poster-led visual language, and Geist typography are appropriate for a film journal.
- The movie/TV hero has strong artwork, identity, metadata, and immediately recognizable actions.
- The new watchlist lanes—Lined up, From people, Someday—are more useful than a generic saved-items grid.
- Browse URLs encode filters and support shareable, server-rendered result pages.
- Profiles have distinctive data: Taste in 4, genre affinity, year/month review, diary, TV progress, and comparison statistics.
- Search supports titles, people, recent queries, natural-language discovery, and structured results.
- Loading, empty, and error components now exist; the next step is to make them consistent and contextual.
- Intent-prefetch and navigation progress protect server cost without making clicks feel dead.

## 3. Research-backed product principles

### 3.1 Task before catalogue

Each first viewport should answer three questions:

1. Where am I?
2. What is most important here?
3. What can I do next?

Reference data belongs below that answer, behind tabs, accordions, drawers, or a dedicated subpage when it is not needed for the main decision.

### 3.2 Progressive disclosure, not content removal

LetSee's depth is an advantage. The goal is not to delete cast, crew, release history, statistics, or social context. It is to show a useful summary first and let interested users open the complete information.

### 3.3 Personal state outranks generic metadata

On a signed-in product, “where can I watch this?”, “have I seen it?”, “what did I rate it?”, “what is my next episode?”, and “which friend recommended it?” should appear before exhaustive production credits or generic recommendations.

### 3.4 One primary action per state

The primary action changes with context:

- Unwatched film: **Log / mark watched**
- Watching a series: **Continue next episode**
- Watchlisted title: **Plan when to watch**
- Search: **Refine or open a result**
- Empty list: **Add the first title**
- Another user: **Follow** or **Message**, depending on relationship

Other actions remain available, but should not have equal weight.

### 3.5 Adaptive information architecture

Material Design's canonical layouts distinguish feed, list-detail, and supporting-pane layouts across compact, medium, and expanded widths. LetSee should do the same rather than merely stack desktop columns on mobile.

- Compact: bottom navigation, action sheet, sticky primary action, collapsible metadata
- Medium: single content column plus selective horizontal shelves
- Expanded: main content with a stable supporting pane where it genuinely helps

### 3.6 State completeness

Every data surface needs designed states for loading, partial success, empty-first-use, empty-after-filter, permission denied, offline/error, and success. Empty states must give one useful next action; skeletons must reserve the final geometry and disappear as soon as content is ready.

### 3.7 Accessibility is part of visual quality

Adopt WCAG 2.2 AA as the release floor. In particular:

- 44–48px preferred touch targets for primary/custom controls
- visible high-contrast focus treatment
- no meaning conveyed by color alone
- logical heading structure and landmark order
- keyboard-operable search, filters, dialogs, galleries, rating controls, and menus
- reduced-motion behavior for carousels, shimmer, parallax, and animated transitions

## 4. Global design-system audit

### 4.1 Current inconsistencies

- Container widths vary between `max-w-3xl`, `5xl`, `6xl`, `7xl`, and `1400px` without a documented content rule.
- Brand green, amber/orange selection, purple/blue/pink section accents, and gold ratings compete without semantic definitions.
- Many labels are 10px uppercase gray text. Some combinations are too faint for comfortable reading and risk contrast failure.
- Buttons mix pills, rounded rectangles, icon squares, full-width slabs, and bespoke inline styles for equivalent actions.
- Cards mix glass, flat, elevated, borderless, gradient, and colored-accent treatments without hierarchy rules.
- `globals.css` contains a duplicated `.nav-link {` declaration that should be treated as a CSS defect, not design preference.
- Desktop navigation exposes a search field plus many icon-only actions. Several destinations are then repeated in the home sidebar.
- Hover lift/glow is used broadly, even where movement does not clarify interactivity.

### 4.2 Target foundation

Create a small, documented UI foundation before redesigning individual pages:

| Foundation | Decision |
|---|---|
| Content widths | Reading `720px`; standard `1120px`; immersive/media `1400px` |
| Page gutters | 16px compact, 24px medium, 32px expanded |
| Section rhythm | 24px within a group, 48–64px between major sections |
| Card radii | 12px compact controls, 16px content cards, 20px hero/feature cards |
| Type roles | Display, page title, section title, body, metadata, label; no route-local substitutes |
| Color roles | Brand/action, rating/gold, warning, danger, info, success; section identity should not invent new accents |
| Buttons | Primary, secondary, quiet, destructive, icon; consistent sizes and pending/disabled states |
| Cards | Poster, person, activity, list, summary; one anatomy per content type |
| Feedback | Skeleton, inline status, toast, page error, empty state, progress bar |
| Responsive navigation | Desktop header; compact bottom bar for Home, Search, Log, Library, Profile |

### 4.3 Shared component work

Build or consolidate these components before route-by-route polish:

- `PageShell`, `PageHeader`, `SectionHeader`, `ResponsiveGrid`
- `Button`, `IconButton`, `ActionMenu`, `SegmentedControl`, `FilterDrawer`
- `MediaCard` variants: compact shelf, standard grid, list row
- `PersonCard`, `ListCard`, `ActivityCard`, `ReviewCard`
- `MediaStatusControl`: watched/watching/watchlist/favorite/list state in one predictable interaction
- `DetailTabs` / sticky section navigation
- `EmptyState`, `ErrorState`, `InlineNotice`, and route-specific skeleton templates
- `PosterImage` / `BackdropImage` with fixed dimensions, fallback, and loading priority rules

## 5. Target product information architecture

### Desktop navigation

- Brand / Home
- Search field
- Discover
- Library (Watchlist, Lists, Diary, TV progress, Data)
- Tonight
- One prominent **Log** action
- Notifications, messages, profile inside a clearly grouped utility area

Remove the redundant search icon when the full search field is visible. Keep Clubs under Discover until club usage justifies a top-level destination.

### Compact navigation

- Home
- Search
- Log (center action)
- Library
- Profile

Messages and notifications live in the profile/utility menu with badges. Tonight is a contextual card on Home and Watchlist, not another compact-nav destination.

### Primary page families

1. **Home:** resume, decide, people, personalized discovery
2. **Discover:** search/browse titles, people, lists, and clubs with appropriate facets
3. **Detail:** understand, watch, record, and discuss one title/person
4. **Library:** watchlist, diary/history, lists, TV progress, imports/exports
5. **Profile:** identity and public taste, separated from account settings
6. **Social:** feed, reviews, recommendations, clubs, messages, notifications

## 6. Route-by-route audit and decisions

### 6.1 Public, authentication, and utility routes

| Route | Current purpose / issue | Required decision | Priority |
|---|---|---|---|
| `/` | Marketing entry. Visually separate from the logged-in product and content-heavy for an uncommitted visitor. | Lead with one proposition: track, remember, and decide with people. Show one product screenshot, three benefits, trust/data portability, then sign-up. | P2 |
| `/login` | Functional auth form. | Keep focused; add password visibility, field-level errors, pending state, accessible autocomplete, and a small link back to product context. | P1 |
| `/signup` | Functional but should set expectations. | Reduce copy, explain confirmation once, show password requirements before submission, and preserve entered values on recoverable errors. | P1 |
| `/forgot-password` | Narrow recovery utility. | Match the auth shell; show clear sent-state and masked destination; prevent repeated accidental sends. | P1 |
| `/update-password` | Narrow recovery utility. | Match login styling and show success with a single “Return to LetSee” action. | P1 |
| `/tv-time` | Legacy/alternate TV utility with unclear placement in current navigation. | Decide whether it is a real product destination. Merge useful functionality into TV Progress/Library or remove the orphan route. | P0 decision |
| `not-found` / global error | Generic recovery. | Preserve the user's shell and provide Home, Search, and Back actions. Error copy should distinguish retryable failure from missing content. | P1 |

### 6.2 Home and discovery

| Route | Current sections / issue | Required decision | Priority |
|---|---|---|---|
| `/app` | Hero carousel; greeting; profile stats/sidebar; airing soon; quick actions; people; continue watching; memory; Tonight; feed; reviews; services; trending; genres. Strong content, but identity/dashboard chrome and discovery compete with resume/decide tasks. | First viewport: compact greeting + Continue Watching + Tonight. Second: following activity/reviews. Third: personalized services/trending. Remove quick-action duplication and collapse profile stats into Profile/Library. Reduce hero to a compact editorial feature or show it only when there is no resume state. | P0/P2 |
| `/app/search` | Search, suggestions/recent history, mixed entity results, natural-language affordance. Two search experiences exist (`/search` and `/search/[query]`) and hierarchy is complex. | One canonical search experience with URL state. Tabs/scopes: All, Titles, People, Lists. Show result counts, keyboard selection, recent/trending before input, and filters after results. | P2 |
| `/app/search/[query]` | Large result implementation with duplicated responsibilities. | Merge its result UI into canonical `/app/search?q=`; redirect old path. Preserve deep links and server metadata. | P2 |
| `/app/browse` | Good server-side faceting and result counts. Filters need stronger mobile behavior and saved state. | Desktop filter rail or bar; mobile filter drawer with applied-count badge and Clear all. Add provider, availability, year range, score, runtime, language, genre, and sort. Persist filters in URL and return focus after update. | P2 |
| `/app/profile` | “Discover people” shows username, bio, watched/favorite/watchlist counts, follow button, and sorts by account totals. This ranks database volume rather than social relevance. | Lead with compatibility/shared titles, mutual connections, recent public activity, language/genre signals, and “follows you.” Add filters for following/mutual/new/active. Demote raw watchlist count. Add reporting/moderation affordances for public bios. | P2 |
| `/app/person` | Redirect/dead-end-style entry rather than a useful people discovery page. | Redirect permanently into Search People or turn it into a curated cast/creator discovery surface; do not keep a near-empty intermediate page. | P0 |

### 6.3 Movie, TV, person, and review details

| Route | Current sections / issue | Required decision | Priority |
|---|---|---|---|
| `/app/movie/[id]` | Strong hero; actions; metadata; social context; release timeline; cast; exhaustive crew; media; providers; personal entry; reviews; related. Live page is several desktop screens long and puts Where to watch / Your entry after low-frequency reference content. | Above fold: identity, status, provider summary, primary log/rating action, friend context. Then tabs/anchors: Overview, Cast & crew, Media, Reviews. Show 8–12 cast and key crew; “View all” opens `/cast`. Collapse full release history and keywords. Keep related content last. | P0/P3 |
| `/app/movie/[id]/cast` | Existing full route is not clearly linked from the capped detail cast row; long unfiltered cast/crew lists. | Add visible “Full cast & crew.” Provide department filters, name search, role grouping, alphabetical/department navigation, and virtual/progressive rendering. | P0/P3 |
| `/app/tv/[id]` | Similar depth plus seasons/progress. Series continuation should dominate for an active viewer. | Dynamic primary CTA: Continue SxEy, Start series, or Add to watchlist. Put season/progress module immediately after hero. Tabs: Overview, Episodes, Cast & crew, Media, Reviews. | P0/P3 |
| `/app/tv/[id]/cast` | Hero uses non-responsive assumptions and the full list is unfiltered. | Rebuild with the same responsive full-credit template as movie cast; include episode counts/character tenure where available. | P0 |
| `/app/tv/[id]/season/[seasonNumber]` | Episode list and bulk tracking are useful but dense; failure/permission feedback is weak. | Sticky season picker, progress summary, “mark through episode” action, compact/list view, air-date status, and explicit logged-out/read-only state. Keep bulk operations in an action menu. | P3 |
| `/app/tv/[id]/season/[seasonNumber]/episode/[episodeId]` | Rich episode details; legacy galleries/videos and controls have accessibility/state issues. | Prioritize watched/rating/note and next/previous navigation. Lazy-load media, use an accessible dialog/lightbox, avoid eager embeds, and hide or explain auth-required controls. | P0/P3 |
| `/app/person/[id]` | Biography, known-for, on-screen/behind-camera filmography, portraits. Filmographies can contain hundreds of cards without meaningful filtering. | Compact hero and known-for row; filmography gets search, media type, department/role, decade, watched/unwatched, rating/popularity sorting, and list/grid modes. Portraits remain deferred. Remove per-card secondary controls from dense filmography. | P3 |
| `/app/review/[id]` | Standalone review with title context and social actions. | Treat the writing as the hero: readable 680–760px measure, author/title context, spoiler gate, reactions/comments, previous/next or related reviews. Avoid poster/grid chrome overwhelming text. | P3 |

### 6.4 Profile, diary, and statistics

| Route | Current sections / issue | Required decision | Priority |
|---|---|---|---|
| `/app/profile/[id]` | Hero currently includes owner visibility settings, follow data, four stats, completeness, Taste in 4, taste summary, favorites, watching, watch later, activity, films, TV progress, reviews, lists, stats, year review, share. It is one enormous page, and deferred panels create long placeholder regions. | Make Profile an overview, not the entire account. Public tabs/routes: Overview, Diary, Reviews, Lists, Stats, TV. Overview keeps hero, Taste in 4, 6–12 favorites, current activity, and highlights. Move privacy/completeness to Settings. Defer by route/tab, not giant empty panels. | P0/P4 |
| `/app/profile/[id]/month/[month]` | Shareable retrospective card. | Add previous/next month, back to Diary, clear period context, empty month state, and export/share actions that do not dominate the content. | P4 |
| `/app/profile/[id]/year/[year]` | Rich annual recap. | Use a narrative sequence with anchored sections, previous/next year, accessible chart summaries, and a compact share mode separate from the full analysis. | P4 |
| `/app/profile/setup` | Very large settings/editor route mixing identity, imagery, privacy, and taste configuration. | Split into Settings sections: Profile, Taste, Privacy, Streaming services, Notifications, Account/Data. Use live preview for avatar/banner and explicit save state. Warn before navigating with unsaved changes. | P1/P4 |

### 6.5 Library and personal data

| Route | Current sections / issue | Required decision | Priority |
|---|---|---|---|
| `/app/watchlist` | Thoughtful lanes, but no global query/filter/sort for large libraries and card density remains high. | Keep lanes as default. Add Search, Movie/TV, provider, genre, runtime, “leaving soon,” person, and custom sort. Offer Grid/List and bulk plan/remove actions. | P2/P4 |
| `/app/lists` | Public-list index with simple text cards and no discovery controls. | Add My lists / Following / Popular / Recent tabs; poster mosaics, search, sort, tags, and Create list. A public directory and personal management should be visually distinct. | P4 |
| `/app/lists/[listId]` | Detail/editor functionality exists, but long lists need stronger orientation. | Hero with poster mosaic, owner, description, count, privacy and actions. Add search/sort/filter, numbered/unranked mode, progress seen, notes, collaborators, reactions, and virtualized rows for large lists. | P4 |
| `/app/data` | Export/import/privacy entry. | Convert to a Settings/Data page with clear cards: Export, Import, Account status, Delete account. Explain file contents and last export/import status. | P1 |
| `/app/import` | Import flow exists as a separate journey. | Use a stepper: Upload → Map/validate → Resolve unmatched → Review → Import → Summary. Preserve progress and show reversible/error rows. | P1/P4 |
| `/app/quick-add` | High-value bulk logging flow but visually separate from the rest of the product. | Keep it fast: search-first, keyboard-first, recent/popular shortcuts, multi-select tray, date/rating defaults, undo, and a compact mobile flow. This should become the shared “Log” action from navigation. | P2 |

### 6.6 Social and decision features

| Route | Current sections / issue | Required decision | Priority |
|---|---|---|---|
| `/app/messages` | Thin server wrapper around conversation list. | Two-pane list/detail on expanded screens; single route stack on compact. Search conversations, unread filter, useful empty state, and message-request/spam safety. | P4 |
| `/app/messages/[id]` | Large client component with real-time thread and media sharing. | Stable composer, date/unread separators, message states, accessible send/error retry, media preview, block/report, and virtualized history. Do not make the header/actions scroll away. | P4 |
| `/app/notification` | 500+ line client page with many notification types. | Group Today/Earlier, All/Unread filters, Mark all read, per-type icons with text labels, deep links, actionable follow/co-log cards, and optimistic state with retry. | P4 |
| `/app/clubs` | Club list, house pick, inline create form. Useful but sparse at current scale. | Keep a simple list until usage grows. Add My clubs/Discover, activity timestamp, current pick, member avatars, search, and a modal/drawer creation flow. | P4 |
| `/app/clubs/[slug]` | Members, pick, discussion. | Make the current pick the primary object; show progress/deadline, member participation, comments, and archive of prior picks. Put management actions in an owner menu. | P4 |
| `/app/tonight` | Collaborative decision room is differentiated but needs clearer steps. | Explicit stepper: People → Constraints → Candidates → Vote → Decision. Preserve room state, show who has responded, explain provider/runtime exclusions, and make the final result shareable/reopenable. | P2/P4 |
| `/app/welcome` | Long onboarding collecting taste and people. | Three short, skippable steps: identity, choose 5–10 titles, follow people. Show progress, explain why each step matters, autosave, and land on a personalized Home. | P1 |

## 7. Specific keep / move / remove decisions

### Keep and elevate

- Continue Watching and Tonight
- Where to watch, personalized to selected services/region
- Taste in 4 and taste comparison
- Watchlist lanes and recommendations from people
- Diary/year/month review
- Quick Add as the universal logging entry
- Friend activity and reviews with meaningful context

### Move behind disclosure or dedicated routes

- Full crew and release history
- Full profile film/TV/review/list/stat sections
- Privacy and profile-completeness controls
- Exhaustive person credits and portraits
- Large media galleries and embedded videos
- Bulk/administrative actions

### Remove or merge

- Home quick links already present in global navigation
- Duplicate search result implementations
- Redundant search icon on desktop
- Orphan `/app/person` surface
- `/tv-time` if its unique value cannot be demonstrated
- Repeated raw watched/favorite/watchlist counts where taste compatibility or recent behavior is more useful
- Decorative accent colors and hover movement that do not encode meaning

## 8. Filters and visualization requirements

### Search / Browse

- Media type, genre, year/decade, original language
- streaming provider and monetization type
- minimum score and vote count
- runtime / episode length
- released/upcoming, watched/unwatched, watchlisted
- sort: relevance, popularity, release date, score
- active filters visible as removable chips; Clear all always available

### Person filmography

- department/role, movie/TV, year, watched state
- sort by chronology, popularity, score, billing/credit importance
- search within credits

### Watchlist / Lists

- title search, movie/TV, provider, genre, saved/release date
- “leaving soon,” “available on my services,” “under 2 hours”
- grid/list toggle and bulk actions

### Profile statistics

- Charts only when they answer a question; every chart needs a text summary and drill-through.
- Prefer small multiples and comparison labels over decorative doughnuts.
- Allow time range and movie/TV filters in one shared control row.
- Do not show zero/empty charts; replace them with a meaningful empty state.

## 9. Implementation plan

### Phase 0 — Stop the most visible UX failures

1. Fix the malformed `.nav-link` rule.
2. Add “Full cast & crew” links from movie and TV details.
3. Fix TV cast responsiveness.
4. Hide or explain auth-only season/episode controls; surface mutation errors.
5. Replace inaccessible legacy gallery/video behaviors.
6. Remove privacy controls from the public-profile hero.
7. Replace giant profile deferred placeholders with route/tab-level loading.
8. Resolve `/app/person` and `/tv-time` ownership.

### Phase 1 — Design foundation and shell

1. Create tokens for spacing, type, content widths, radii, elevation, and semantic color.
2. Consolidate Button, Card, Header, Filter, Empty/Error/Skeleton, and Dialog patterns.
3. Simplify desktop navigation and implement compact bottom navigation.
4. Establish keyboard/focus/dialog/gallery patterns and automated accessibility checks.
5. Create Storybook-style fixture pages or an internal component gallery.

### Phase 2 — Highest-frequency journeys

1. Logged-in Home
2. Canonical Search + Browse filters
3. Quick Add / Log
4. Watchlist
5. Discover people
6. Tonight

### Phase 3 — Media details

1. Shared movie/TV detail scaffold
2. Movie detail and full credits
3. TV detail, seasons, and episode detail
4. Person detail and filterable filmography
5. Review reading page

### Phase 4 — Profile, library, and social

1. Profile overview and tab/route split
2. Diary, stats, lists, TV progress, year/month review
3. List index/detail
4. Clubs
5. Messages and notifications
6. Settings, data export, and import

### Phase 5 — Public/auth polish and release QA

1. Landing and auth shell
2. Onboarding
3. All route states and copy review
4. Responsive and accessibility verification
5. Real-user task testing and analytics review

## 10. Recommended delivery sequence

Use small, reviewable pull requests instead of a single redesign branch:

1. `ui-foundation`
2. `app-shell-navigation`
3. `home-task-hierarchy`
4. `search-browse-unification`
5. `movie-detail-progressive-disclosure`
6. `tv-progress-and-detail`
7. `person-filmography`
8. `profile-information-architecture`
9. `watchlist-lists-library`
10. `social-clubs-messages-notifications`
11. `auth-onboarding-settings`
12. `responsive-accessibility-release`

Each PR should include screenshots at compact, medium, and expanded widths plus loading, empty, populated, error, and signed-out states where applicable.

## 11. Acceptance criteria

### Visual and responsive

- No horizontal overflow at 320, 390, 768, 1024, and 1440px.
- Route identity and its primary action are visible in the first viewport.
- Compact layouts reduce information, not merely stack it.
- No unexplained empty panels or layout jumps while data loads.
- Shared content types look and behave consistently across routes.

### Interaction and accessibility

- All actions are keyboard reachable in a logical order.
- Focus is visible and never hidden under sticky navigation.
- Custom primary targets are at least 44px; dense secondary controls retain safe spacing.
- Dialogs trap and restore focus; Escape closes; galleries have labelled previous/next/close controls.
- Status, validation, and mutation results are announced without relying on toast/color alone.
- All charts have equivalent text summaries.

### Search and filtering

- Query/filter/sort state is represented in the URL where sharing/back navigation matters.
- The interface displays result count, applied filters, Clear all, loading, and no-results recovery.
- Focus remains near the changed filter after results update.

### Performance and perceived speed

- Field targets at the 75th percentile: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1.
- Navigation feedback begins within 100ms for uncached transitions.
- Above-fold images have dimensions and deliberate priority; below-fold media is lazy.
- No screen starts hundreds of speculative route/image/video requests.
- Skeletons match final geometry and do not remain for already available data.

### Product outcomes

- A returning user can resume a show or log a title from Home in one action.
- A user can answer “where can I watch this?” from the title's first viewport.
- A user can filter a large watchlist, list, cast, or filmography without endless manual scrolling.
- Another user's profile communicates taste and recent behavior before raw collection volume.
- Settings and private controls never dominate the public-facing profile.

## 12. Validation plan

Before implementation, record baseline completion time and failure points for these tasks:

1. Resume the next episode of a currently watched series.
2. Find a sub-two-hour movie on one of the user's services and add it for tonight.
3. Log a watched title with date, rating, and note.
4. Find a film by language/genre/decade and open its provider options.
5. Discover a person with overlapping taste and follow them.
6. Find a title in a 100-item watchlist.
7. Find an actor's films from the 1990s that the user has not watched.
8. Open a friend's review and reply.
9. Check TV progress and mark multiple episodes watched.
10. Export account data and understand what the export contains.

Repeat the same tasks after each relevant phase. Track completion rate, time, backtracks, filter usage, empty/error encounters, and abandonment. Visual polish is successful only if these journeys become faster and clearer.

## 13. Reference standards and product benchmarks

- [WCAG 2.2 Understanding documents](https://www.w3.org/WAI/WCAG22/understanding/)
- [WCAG target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced)
- [Material Design canonical responsive layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
- [Carbon search pattern](https://v10.carbondesignsystem.com/patterns/search-pattern/)
- [Carbon filtering pattern](https://v10.carbondesignsystem.com/patterns/filtering/)
- [Carbon empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [Atlassian skeleton guidance](https://atlassian.design/components/skeleton/usage)
- [web.dev responsive design](https://web.dev/articles/responsive-web-design-basics)
- [web.dev Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)
- [Letterboxd product model](https://letterboxd.com/)
- [Plex Discover](https://www.plex.tv/discover/)
- [JustWatch filter model](https://www.justwatch.com/us)

## 14. Final recommendation

Do not begin by restyling individual cards. First simplify the product hierarchy and establish the component/layout rules. The highest-return implementation slice is:

1. Shell/navigation
2. Home
3. Search/Browse
4. Movie/TV detail
5. Profile split

Those five changes will improve almost every session and create the primitives needed to finish the remaining routes without another round of disconnected page redesigns.
