# 04 — Competitor interfaces, page by page

> Research note for the letsee redesign. Question: what do the best products in and around social film/TV journaling actually do on each page type (header, home, title, TV/season/episode, profile, person, search, lists, notifications, messages) as of 2025–2026, and what should letsee adopt, adapt or avoid?
>
> Status: complete first pass, 2026-10-03.
>
> Convention: **[E]** = evidence (sourced fact, dated where possible). **[O]** = opinion / design judgement.

## 0. Method and caveats

- **When and what.** Researched 2026-10-03 from:
  - live public pages
  - App Store "What's New" notes and APKMirror changelogs
  - official forums (forums.trakt.tv, forums.plex.tv, the StoryGraph roadmap)
  - news coverage and Pratt IXD design critiques
- **Signed-out views only.** Letterboxd's profile and home pages returned 403. Reddit, simkl.com and app.trakt.tv blocked automated fetching. IMDb, Rotten Tomatoes, JustWatch and Apple TV pages were read through a text proxy, so they show the signed-out web view.
- **Unchecked claims are marked** "unverified" or "from memory".
- **Two features are missing from every product checked:** a native "watched with" field and recommendation attribution. Section 12 covers both.

## 1. Letterboxd

The category leader.
- Members: 17M at end-2024, 27M in Jan 2026, over 30M by Jul 2026. 898.5M films logged in 2025. https://en.wikipedia.org/wiki/Letterboxd
- iOS: 4.8★ from about 88K ratings, Editors' Choice, v4.12.6 on 16 Sep 2026. https://apps.apple.com/us/app/letterboxd/id1054271011

**Global navigation**
- [E] **Web header**, left to right: wordmark → Films · Lists · Members · Journal → visible search box → green **"+ Log"** button. Signed out, Sign in / Create account come first. Year in Review, Pro and Apps sit in the footer. https://letterboxd.com/film/the-substance/
- [E] **iOS tab bar**: five icons, Home · Search · centre **+** · Activity · Profile. A Pratt critique (14 Sep 2026) found Search, + and Profile clear, and Home and Activity ambiguous. https://ixd.prattsi.org/2026/09/design-critique-letterboxd-ios/
- [E] **Earlier side drawer**: activity, watchlist, diary and lists were hidden in it, and redesign critiques called that the main navigation flaw. https://github.com/Aaron41402/Letterboxd-Redesign
- [E] **Android 3.0.4** (2 Sep 2025) was a "huge update to the interface and navigation" in Material 3. Follow-up releases had to restore scroll position (3.0.12) and member reviews on film screens (3.1.1, Oct 2025).
  - https://www.apkmirror.com/apk/letterboxd-limited/letterboxd/letterboxd-3-0-4-release/
  - https://www.apkmirror.com/apk/letterboxd-limited/letterboxd/letterboxd-3-0-12-release/
  - https://www.apkmirror.com/apk/letterboxd-limited/letterboxd/letterboxd-3-1-1-release/
- [E] **Search tab** doubles as Browse; Official Lists were added there in Apr 2026. https://scout.appaloosa.io/apps/ios/com.letterboxd.LetterboxdApp/history
- [E] **No DMs.** Contact happens through review comments with Anyone / Friends / You reply controls, and through private lists shared by secret link.
  - https://letterboxd.com/about/faq/
  - https://letterboxd.com/journal/comment-control/
  - https://letterboxd.com/journal/between-us-private-lists-sharing/

**Home**
- [E] **App home**: a segmented control (Films / Reviews / Lists / Journal) that opens on "Popular This Week". https://ixd.prattsi.org/2026/09/design-critique-letterboxd-ios/
- [E] **Ads and rentals**: since iOS 4.7.0 (Oct 2025), free members get a featured trailer and a once-a-day full-screen ad at launch. Video Store rentals also sit on Home (2026). https://apps.apple.com/us/app/letterboxd/id1054271011
- [E] **Web home** becomes personal as you follow people. https://letterboxd.com/welcome/
  - [O] From memory, since the page returned 403: friends greeting → "New from friends" poster row with each friend's avatar and stars under the poster → popular this week → reviews → Journal → lists.

**Film page** (web, fetched 2026-10: https://letterboxd.com/film/the-substance/)
- [E] **Order**: backdrop → title, year, "Directed by" → tagline, synopsis, runtime with IMDb/TMDB links → "Where to watch" (trailer + JustWatch services) → tabs Cast | Crew | Details | Genres (with "Themes") | Releases → half-star histogram with fans count → Popular reviews → Similar Films → "Mentioned by".
- [E] **Log dialog**: date, rating, spoiler toggle, privacy (Anyone / Close Friends / You), draft. Diary date and watched status stay public even when the entry is private. https://letterboxd.com/wireframe/activity/
- [E] **App log screen**: the Pratt critique counts too many toggles (first watch, spoilers, replies, tags, like, rating). https://ixd.prattsi.org/2026/09/design-critique-letterboxd-ios/
- [E] **App film screen**: member reviews moved onto it in Oct 2025, and long cast lists were truncated. https://apps.apple.com/us/app/letterboxd/id1054271011
- [O] **Signed-in extras** (from memory):
  - a right-side action panel: Watch / Like / Watchlist, a star rater, "Review or log…", lists, share
  - an **"Activity from friends"** strip (avatars, each with stars) above the reviews, and friends' reviews before popular ones
  - on a phone, backdrop, title, poster and one big "Rate, log, review…" button fill the first screen
  - This is the canonical order: friends first, crowd second, one primary button.

**TV.** [E] Letterboxd covers miniseries, TV movies and a few exceptions only: "we do not support 'returning' TV shows at this time". https://letterboxd.com/about/faq/ Its TV plans met community pushback and nothing had launched by Oct 2026. https://en.wikipedia.org/wiki/Letterboxd

**Profile**
- [E] **Tabs**: Activity, Films, Diary, Reviews, Watchlist, Lists, Likes, Tags, Network. https://letterboxd.com/wireframe/activity/
- [E] **Content**: 4 favourite films; pin 2 reviews and 2 lists by tagging them `profile`. Close Friends and private entries don't count toward stats. "Films" counts unique titles while the diary counts every viewing. https://letterboxd.com/about/faq/
- [E] **Paid tiers**: Year in Review needs 10+ diary entries and a paid plan. Pro ($18.99) adds stats, streaming filters and watchlist alerts; Patron ($48.99) adds custom posters. https://letterboxd.com/about/pro/
- [O] **Layout** (from memory):
  - identity: avatar, PRO badge, bio, then Edit (owner) or Follow (visitor)
  - counters: Films / This year / Lists / Following / Followers
  - main column: favourites → recent activity → pinned → reviews
  - sidebar: watchlist, diary by month, histogram

**Person page.** [E] Role tabs with counts, billing-order and rating sorts, a **"Fade watched films"** toggle, and filters for watched, watchlist, service, genre and decade. https://letterboxd.com/director/coralie-fargeat/ [O] "Fade watched" turns a filmography into a personal checklist, the best person-page idea in the category.

**Watched with.** [E] Not a feature. The FAQ suggests diary tags such as `with:mom`. https://letterboxd.com/about/faq/

**Praise and complaints**
- [E] **Pratt (Sep 2026)** praises the small gap between intent and action, and faults the icons and the log screen. https://ixd.prattsi.org/2026/09/design-critique-letterboxd-ios/
- [E] **Henry T. Casey (May 2026)**: no threaded replies, streaming alerts about single films rather than a digest, and tag-by-year breakdowns only on the web. https://henrytcasey.beehiiv.com/p/021-we-can-all-learn-from-letterboxd-s-flaws
- [E] **App reviews** call it "outdated and cluttered" in places, and say the stars are too small on the Instagram story sticker. https://grand-screen.com/apps/letterboxd/reviews/

## 2. Serializd

"Letterboxd for TV": free, Patreon-funded, claims 200k+ users. https://impresskit.net/serializd
- Ratings: iOS 4.5★ (1.2K), Play 3.6★. https://apps.apple.com/us/app/serializd/id1581244120 and https://gizmodo.com/download/serializd

- [E] **Releases**: a 2025 year in review ("Rewatch"), widgets (Mar 2026), a stats breakdown (May), discovery and badges (Jun), and a "Revamped home page!" with more episode detail (Aug 2026). https://apps.apple.com/us/app/serializd/id1581244120
- [E] **Show page**:
  - poster, title, "2022 • 3 seasons • Drama…", synopsis
  - tabs Home / Reviews / Lists / Media / Cast/Crew / Similar
  - a season-poster grid including Specials and announced seasons
  - details with "Nanogenres" and status; stats (average, watched and watchlisted counts)
  - https://www.serializd.com/show/severance-95396
- [E] **Show reviews**: filter by season and star value, with an **"Include episode ratings"** checkbox so episode reviews appear only on request. https://www.serializd.com/show/Severance-95396/reviews
- [E] **Season page**: "S01" badge, a horizontal season switcher, and tabs Episodes / Reviews / **Friends** / Lists / Media / Cast. The only season-level Friends tab in the category. https://www.serializd.com/show/Severance-95396/season/135726/1
- [E] **Tracking**: rate episodes, seasons or the whole series; a next-episode tracker; air-date notifications; watch-time and genre stats. https://apps.apple.com/us/app/serializd/id1581244120
- [E] **Complaints**:
  - crashes (Dec 2025)
  - no "mark all previous episodes watched"
  - rewatches double-count
  - the feed doesn't surface friends, and floods when everyone watches the same show
  - home feels "messy"
  - the watchlist is buried in the profile
  - https://mwm.ai/apps/serializd/1581244120 and https://justuseapp.com/en/app/1581244120/serializd/reviews
- [O] Lesson: aggregate the feed ("6 friends watched Severance S2E3 this week") rather than listing six rows.

## 3. Trakt (2024–2026 redesign): the cautionary tale

**Timeline**
- [E] **Oct 2024**: rebrand, red to purple; users flagged dark-mode contrast. https://forums.trakt.tv/t/trakt-gets-a-makeover/28951
- [E] **Feb 2025**: the free tier was capped at 2 lists and a 100-item watchlist, and VIP doubled to $60/yr ("low-key predatory"). https://alternativeto.net/news/2025/2/trakt-tv-has-set-stricter-limits-for-free-users-and-raised-vip-subscription-prices-by-100-/
- [E] **Feb 2025**: "Trakt Lite" launched as an opt-in web app. https://forums.trakt.tv/t/try-out-trakt-lite-your-new-go-to-for-a-better-faster-and-simpler-experience/47712
- [E] **31 Oct 2025**: Lite became the default ("New Trakt") with one look across web, iOS, Android and TV; Classic went into maintenance. https://forums.trakt.tv/t/new-trakt-default-web-experience/82458
  - Early reaction was "mostly negative": incomplete, a cluttered persistent "Now Playing" strip, and the Plan to Watch / On Hold / Dropped lists removed. https://alternativeto.net/news/2025/11/trakt-unveils-a-full-redesign-of-its-movie-and-tv-tracking-platform-for-web-and-mobile/
- [E] **May 2026**: V3 is the default for everyone by the end of June 2026. https://forums.trakt.tv/t/trakt-product-update-may-2026/111812

**Navigation**
- [E] **Web**: a left icon sidebar; tooltips added (Mar 2026), then expandable with a sticky filter and sort bar (Apr 2026). https://forums.trakt.tv/t/trakt-for-web/97506 and https://forums.trakt.tv/t/trakt-product-roundup-april-2026/108687
- [E] **iOS**: Search is a default tab, and iPad gets a sidebar. On iOS 26 a persistent bottom "Watching Now" bar works like a music mini-player. https://forums.trakt.tv/t/trakt-for-ios/80418 and https://releasebot.io/updates/trakt
- [E] **Verbs renamed (Jan 2026)**: "Check in" → "Now Watching" (eye icon), and "Mark as Watched" → "Track". https://releasebot.io/updates/trakt

**Home**
- [E] Up Next and Watchlist were replaced by two smart lists (Dec 2025):
  - **Continue Watching**: the next episode per show plus paused films, newest activity first
  - **Start Watching**: watchlist titles that have just come out
  - both under a Media / Shows / Movies toggle
  - https://forums.trakt.tv/t/new-trakt-feature-spotlight-continue-watching-start-watching/89875
- [E] **iOS adds** an upcoming schedule, a streak card, recommendations with "Why this?", and Social Activity with friends' ratings. https://forums.trakt.tv/t/trakt-for-ios/80418

**Title and TV pages**
- [E] **Web title page (Feb 2026)**: your rating shown separately from the average; a "sentiment card"; Where to Watch in a drawer grouped by service type; details and history in drawers. https://forums.trakt.tv/t/trakt-for-web/97506
- [E] **iOS v3.7** added a **"Who's watching this"** sheet showing friends' watches and ratings apart from global opinion. https://forums.trakt.tv/t/trakt-for-ios/80418
- [E] **Ratings** show as 5 stars on iOS and a percentage on Android. https://releasebot.io/updates/trakt
- [E] **Season pages** (with season ratings and comments) were dropped in iOS 3.0 (Jan 2026), and staff said they "won't come back". Full-screen season and episode views were back by May 2026. https://forums.trakt.tv/t/trakt-mobile-update/95412 and https://forums.trakt.tv/t/trakt-product-update-may-2026/111812
- [E] **Progress page** (many users' most-visited) was missing at launch. It returned in Apr–May 2026 as Up to Date / In Progress / Dropped, with a note when you drop a show. https://forums.trakt.tv/t/new-trakt-feedback/84794 and https://forums.trakt.tv/t/trakt-product-roundup-april-2026/108687
- [E] **Spoilers**: blurring was missing from the Android beta. https://forums.trakt.tv/t/introducing-a-new-vip-beta-of-trakt-for-android/84960

**Profile**
- [E] **iOS**: month-to-date progress, a "Screen Time" card (last 7 days, peak hours), all-time stats, a follow-request inbox, VIP fanart covers. https://forums.trakt.tv/t/trakt-for-ios/80418
- [E] **Web (2026)**: an activity heatmap, streaks, calendar history. https://forums.trakt.tv/t/trakt-for-web/97506
- [E] **Year in Review 2025**: 11 sections including "Watchlist Reality Check" and a community comparison, at a URL anyone can open. https://forums.trakt.tv/t/your-trakt-year-in-review-is-here/92275
  - Feedback: fewer stats than before, and films not split from TV. https://forums.trakt.tv/t/year-in-review-2025-feedback/92282

**Reaction**
- [E] **Feedback thread** (~400 replies from 31 Oct 2025): https://forums.trakt.tv/t/new-trakt-feedback/84794
  - horizontal carousels instead of lists on desktop
  - posters too small to read
  - a banner and menu that eat the screen
  - a "tablet layout on desktop"
  - dropped shows showing up in Continue Watching
  - Staff say monthly actives and retention were unharmed.
- [E] **Still missing in May 2026**: V2's filters, library management and calendar; history has no filters and scrolls forever. https://forums.trakt.tv/t/trakt-product-update-may-2026/111812
- [E] **App Store**: 4.1★. https://apps.apple.com/us/app/-/id1514873602
- [O] **Lessons**:
  1. Never remove the page people open daily.
  2. Desktop is not a stretched phone.
  3. Use one rating scale everywhere.
  4. Split you / friends / everyone into visual tiers, but don't bury core facts in drawers.

## 4. TV Time (shut down 15 July 2026): what people miss

**Shutdown**
- [E] **Announced 1 Jul 2026**, ending after 15 Jul: not sustainable free, and not enough demand for paid. https://en.wikipedia.org/wiki/TV_Time
- [E] **Owner** Whip Media had pivoted to AI analytics. TV Time had 26.4M lifetime installs. https://techcrunch.com/?p=3138586
- [E] **Notice**: about 13 days. https://www.techtimes.com/articles/319583/20260703/tv-time-closes-july-15-26-million-users-face-permanent-watch-history-deletion.htm
- [E] **Export**: history and ratings only; comments, reactions and GIFs were lost. https://wiki.archiveteam.org/index.php/TV_Time
- [E] **Scale (Nov 2024)**: 30M registered and 2.5M monthly actives. https://techcrunch.com/2024/11/20/tv-time-points-to-apples-significant-power-over-developers-after-being-removed-from-app-store
- [E] **Successor**: a co-founder launched "Bingers", with an importer and "community reactions". https://techcrunch.com/?p=3141543 and https://bingers.app

**UI**
- [E] **Tabs**: four bottom tabs, Shows · Movies · Discover · Profile. https://en.wikipedia.org/wiki/TV_Time
- [E] **Shows tab**:
  - a Watch List of next episodes, each poster with a yellow progress bar
  - swipe right or tap a check to mark watched
  - Upcoming, with reminders before airtime
- [E] **After marking an episode watched**:
  - rate it, pick a **feeling** (good, funny, wow, sad…), vote for a **favourite character**, say what device you watched on
  - then the episode's **community tab** of GIFs, memes (with a screencap meme-maker) and comments **unlocks**: marking it watched is the spoiler gate
  - https://techcrunch.com/2018/03/12/tv-time-the-tv-tracking-app-with-over-a-million-daily-users-can-now-find-your-next-binge
- [E] **Profile**: a running total of time spent watching, episode counts, badges. https://en.wikipedia.org/wiki/TV_Time

**What people miss**
- [E] **Instant per-episode reactions.** TechTimes says these have "no direct equivalent" in the apps that absorbed TV Time users. https://www.techtimes.com/articles/320754/20260716/tv-time-shuts-down-whip-medias-ai-pivot-ends-26-million-user-community.htm and https://alternativeto.net/news/2026/7/tv-time-is-shutting-down-its-service-on-july-15-2026-here-are-some-great-replacements/
- [E] **Requests to competitors from refugees**: a "mark all previous episodes watched" prompt, character and emotion ratings, images in comments. https://moviebase.featurebase.app/p/new-suggestions-as-previous-tv-time-user
- [O] The post-episode moment is the most valuable piece of UI nobody owns now. letsee should make it about *your people*: "2 friends have seen this. See what they felt."

## 5. Simkl

- [E] **What it is**: web-first, with a "Simkl Lists" app.
  - statuses Watching / Plan to Watch / Completed / On Hold / Dropped
  - next-episode view, calendar, IMDb and MAL ratings
  - imports from Trakt, MAL and Netflix; auto-tracking for Netflix, Plex and Kodi
  - https://apps.apple.com/us/app/simkl-lists-tv-anime-movies/id1229691035 and https://www.ithinkdiff.com/best-tv-time-alternatives-app-store/
- [E] **App Store (4.4★)**: praise for stats and the TV Time migration; requests to match the website and to show friends' activity. Same App Store link.
- [E] **Competitor view**: a rival's comparison describes season progress bars and compact title pages built around status controls, and calls Simkl closest to TV Time in feel. https://moviebase.app/resources/tv-time-vs-simkl
- [E] **Critics**: "UI is a total mess" (AlternativeTo, May 2025). https://alternativeto.net/software/simkl-tv-tracker/about/
- [E] **Third party**: "Simalytics" exists to add an Up Next queue and poster grids. https://apps.apple.com/us/app/simalytics/id6745519450

## 6. IMDb

**Navigation**
- [E] **Desktop header** (Oct 2026): Menu (hamburger) · search with an "All" category dropdown · IMDbPro · Watchlist · Sign In · Use app. https://www.imdb.com/
- [E] **App**: moved to a bottom tab bar in Feb 2021, replacing a top-right avatar; Help now says "tap the Profile tab". https://www.androidpolice.com/2021/02/05/imdb-app-picks-up-bottom-navigation-bar-in-ui-redesign/?amp and https://help.imdb.com/article/imdb/new-features-updates/mark-as-watched-faq/GR2SD7Y4LZVNHUVH
- [E] **iOS Search**: two sub-tabs, Streaming (by provider) and Browse (charts, awards, advanced search). https://help.imdb.com/article/imdb/new-features-updates/ios-search-browse-page-redesign/G5E3PYVRTNA3GWT5

**Home** (editorial): https://www.imdb.com/
- [E] **Order**: Featured today → **Episode Spotlight** → Join the community → Trending people → What to watch → streaming → Recently viewed.
- [E] **Episode Spotlight**: a poll asking which episode was best, showing the season average ("8.3 from 129K episode ratings") and each episode's rating.
- [E] **Discussions**: back in beta, with spoiler-tag rules, nine years after the boards closed in Feb 2017. https://www.imdb.com/interest/in0000244/discussion/ and https://en.wikipedia.org/wiki/IMDb

**Title page** (*Breaking Bad*, live: https://www.imdb.com/title/tt0903747/)
- [E] **Order**:
  - title, years → genre chips → poster and video
  - three side-by-side blocks: **IMDb RATING** (9.5/10, 2.7M) · **YOUR RATING** (tap to rate) · **POPULARITY**
  - plot → creators and stars → streaming buttons → **Add to Watchlist** and **Mark as watched**
  - Episodes → Videos → Photos → Top cast (with episode counts) → More like this → trivia → User reviews → Details
- [E] **"Watched"**: replaced "Seen" in Nov 2025; any rating, review or check-in counts. History is private for now. https://help.imdb.com/article/imdb/new-features-updates/mark-as-watched-faq/GR2SD7Y4LZVNHUVH
- [O] The empty YOUR RATING beside the global one is the clearest prompt to rate in the category. There is no friend layer at all.

**TV**
- [E] **Episodes page**: numbered season tabs plus dropdowns for years and top-rated; most-recent and top-rated episodes are featured first. Each row: still · "S1.E1 ∙ Pilot" · date · plot · "8.2/10 (26K)" · Rate. https://www.imdb.com/title/tt26545992/episodes/
- [E] **"Ratings by episode"** (`/ratings`): a season × episode grid of clickable ratings. https://www.imdb.com/title/tt0903747/ratings/
  - A 2026 userscript adds a 7-tier colour scale. https://greasyfork.org/scripts/563779-imdb-rating-colors
  - Heatmap apps such as Series Graph exist. https://www.producthunt.com/products/series-graph-2/launches

**Profile and lists**
- [E] **Profile**: join date, badges (redesigned Jun 2025), watchlist, polls taken, recently viewed. https://www.imdb.com/user/ur156923291/ and https://help.imdb.com/article/contribution/contribution-information/user-profile-badges/G86A698XFX3KTHXS
- [E] **Lists**: detailed / grid / compact views with drag-to-reorder. https://help.imdb.com/article/imdb/new-features-updates/list-pages-redesign/GLF7EF3VJPXM34XG

**Reaction**
- [E] **Userscripts as protest**: "IMDb Page Cleaner" (2022) strips the POPULARITY block and right rail and moves user reviews up. https://greasyfork.org/en/scripts/444255-imdb-page-cleaner
- [E] **Another userscript**, "Unfuck IMDb", re-compacts the page. https://openuserjs.org/scripts/heyxsh/Unfuck_IMDb
- [E] **Dense view kept**: the `/reference` view survives for loyalists. https://help.imdb.com/article/imdb/new-features-updates/title-reference-view/GUCFWCQC92JLUN2B
- [E] **Critique (2024)**: cluttered and inconsistent. https://ixd.prattsi.org/2024/12/imdb-redesign/
- [O] People hated promotion pushing facts below the fold.

## 7. Mubi

- [E] **Header**: Try 7 Days Free · Now Showing · MUBI GO · Gift · Film Database · Notebook · Search. https://mubi.com/en/us/films/aftersun
- [E] **Home**: one lead film → "Featured" (6 large editorial cards) → "New on MUBI". https://mubi.com/en/us/showing
  - Films leaving within 14 days are labelled, and watchlisting one sets a departure alert. https://help.mubi.com/article/262-how-long-are-films-available-to-watch-on-mubi
- [E] **Film page**: title, director, country, year, synopsis, "Watch now", then an editorial **"Our Take"** on why the film was picked, festival awards, and More Like This with blurbs. https://mubi.com/en/films/in-the-mood-for-love and https://help.mubi.com/article/22-what-makes-mubi-special
- [E] **Reviews and lists**: reviews live on a separate `/ratings` page (5 stars, halves allowed). List cards show the curator, film count, followers and 3 thumbnails. https://mubi.com/en/films/in-the-mood-for-love/ratings and https://mubi.com/en/lists
- [E] **App reviews (4.7★)** praise the curation and complain about short notice before films leave. https://apps.apple.com/us/app/mubi-curated-cinema/id626148774
- [O] "Our Take" is the model for a *person's* take: "why Priya put this on your list", with her face, at the top of the page.

## 8. Plex Discover, JustWatch, Apple TV, Netflix

### Plex Discover
- [E] **Discover Together** (public 1 Nov 2023): https://forums.plex.tv/t/discover-together-public-release/857227
  - three tabs: **Activity** (friends' watches, ratings and watchlist adds, all commentable), **People**, and **Profile** (history, ratings and watchlist, each shareable or hidden)
  - title pages show friends who watched
  - a "Week in Review" email on by default
- [E] **Privacy backlash (Nov 2023)**:
  - sharing was effectively opt-out, and weekly emails exposed friends' adult viewing. https://www.404media.co/plex-users-fear-discover-together-week-in-review-feature-will-leak-porn-habits-to-their-friends-and-family/ and https://forums.plex.tv/t/weekly-review-emails-data-leak/860206
  - onboarding said "private by default" while pre-setting sharing to Friends. https://cordcuttersnews.com/this-new-plex-feature-shares-your-weird-watch-history-with-friends-and-its-tricky-to-turn-off/?amp=1
- [E] **Public profiles** (Jan 2025): review visibility can be anyone, signed-in users, Friends, Friends of Friends, or private; default Friends; adult titles excluded from Activity. https://techcrunch.com/2025/01/22/streaming-service-plex-gets-more-social-with-public-profiles-and-reviews
- [E] **New mobile app** (31 Mar 2025): https://tech.yahoo.com/articles/plexs-big-mobile-app-redesign-163035542.html and https://forums.plex.tv/t/release-notes-for-plex-experience-preview-ios-android-mobile/894679
  - tabs Home · Library · Live TV · On-Demand · Discover, with the social feed under Discover
  - Watchlist in the top nav
- [E] **Forum backlash**: https://forums.plex.tv/t/it-s-been-one-week-with-the-new-experience-on-mobile-and-we-re-just-getting-started/912151
  - "crazy decision", "cripples essential functionality"
  - 30–90 second library loads
  - artwork "way too big", app "lacks identity"
- [E] **Removals and reversals**:
  - Watch Together was dropped. https://www.pcworld.com/article/2619590/plex-is-dropping-a-popular-feature-from-its-new-streaming-apps.html
  - In Aug 2026 the TV apps brought back a left menu after backlash. https://www.neowin.net/news/plex-reverts-tv-app-layout-after-intense-user-backlash/ and https://forums.plex.tv/t/new-tv-app-feedback/941835
- [O] **Lessons**: visibility defaults are a design surface, so ask, show the audience on every share, and never email someone's viewing by default. Oversized art reads as lost identity.

### JustWatch
- [E] **Header**: Home · New · Popular · Lists · Sports · Guide. https://www.justwatch.com/us/new
- [E] **Home**: a row of 40+ provider-logo filters → a filter bar → poster grid → Top 5. https://www.justwatch.com/us
- [E] **Title page** (*Severance*): https://www.justwatch.com/us/tv-show/severance
  - backdrop → **Watchlist** and **Seen all** → JustWatch rating with a trend arrow, plus IMDb
  - **jump chips** (Where to watch · Free · Episodes · Synopsis · Trailers · Charts · Similar)
  - season cards → offers filtered All / Subscription / Free / Disc
  - Movie pages add Rotten Tomatoes, rent and buy prices, and a "Seen" count. https://www.justwatch.com/us/movie/aftersun
- [E] **TV Time importer**: built Jul 2026. https://9to5mac.com/?p=1060170
- [E] **App reviews (4.7★)**: the cross-service watchlist is "a gamechanger"; complaints about lost watchlists and sorting. https://apps.apple.com/us/app/justwatch-movies-tv-shows/id979227482
- [O] Jump chips are the right way to tame a long mobile page. Where to watch belongs in one compact row, not the hero.

### Apple TV app
- [E] **Rebrand**: Apple TV+ → "Apple TV" (Oct 2025). https://en.wikipedia.org/wiki/Apple_TV%2B
- [E] **tvOS**: a sidebar (Search · Home · Apple TV · Sports · Store · Library · Channels) with a profile switcher. https://support.apple.com/guide/tv/navigate-the-apple-tv-app-atvb59b423ba/tvos
- [E] **Home**: **Continue Watching** across all services → **Watchlist** → charts and collections → personal picks. https://support.apple.com/guide/tv/find-things-to-watch-atvb7d7bec9f/tvos
- [E] **iOS/tvOS 26** (Sep 2025): https://www.apple.com/newsroom/2025/06/apple-tv-brings-a-beautiful-redesign-and-enhanced-home-entertainment-experience/ and https://www.macrumors.com/roundup/ios-26/
  - vertical "cinematic" posters fit more titles on screen
  - Liquid Glass controls float over video
  - tab bars float and shrink on scroll
- [E] **Show page**: Play / Add to Watchlist → episode cards (still, number, title, synopsis, runtime) → trailers → related → cast → how to watch. https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx
- [E] **Complaints**: the watchlist is buried under promotion. https://apps.apple.com/us/app/apple-tv/id1174078549
- [O] Resume → your list → editorial is the right baseline; it has no people layer. "Shared with You" is covered in §12.

### Netflix
- [E] **Mobile redesign** (from 30 Apr 2026, global by Aug):
  - four tabs: **Home · Clips · Search · My Netflix**
  - "New & Hot" folded into a swipeable top filter row
  - Clips is a vertical, deliberately finite feed with My List, Share and an open-title avatar
  - https://about.netflix.com/en/news/introducing-exciting-new-ways-to-find-and-enjoy-your-next-favorite-on-mobile , https://www.whats-on-netflix.com/news/netflix-mobile-updates-clips-new-navigation/ and https://www.bgr.com/2161485/netflix-vertical-clips-update-tiktok-why/
- [E] **TV home** (19 May 2025, the first overhaul since 2013): the hidden sidebar became a top nav, with bigger tiles. https://www.indailysa.com.au/news/in-depth/2025/05/09/netflix-homepage-changes
- [E] **TV backlash**:
  - 2–3 titles per screen instead of ~10. https://www.whats-on-netflix.com/news/netflix-is-rolling-out-its-new-tv-app-ui-and-not-everyone-is-a-fan/
  - "tablet UI on giant TVs". https://tech.yahoo.com/streaming/articles/netflix-says-users-ui-despite-135837260.html
  - "borderline unusable". https://techradar.com/streaming/the-new-ui-is-borderline-unusable-netflix-subscribers-are-still-complaining-about-the-app-re-design-and-im-100-percent-with-them
- [E] **Title page**: hero video → metadata → synopsis → cast → trailers → episodes with a **"Select Season" dropdown** → More Like This. https://www.netflix.com/title/80057281
- [E] **Ratings**: thumbs down / up / "Love this". https://techcrunch.com/2022/04/11/netflix-adds-a-two-thumbs-up-button-in-effort-to-learn-what-users-love-not-just-like
- [E] **My Netflix** (2023): profile, notifications, downloads, liked titles, My List. https://techcrunch.com/?p=2573374
- [O] Netflix, Trakt and Plex made the same 2025 mistake: fewer, bigger tiles. Users read lost density as lost control.

## 9. Rotten Tomatoes

- [E] **Header**: Trending · Movies · TV Shows · News · Showtimes · … with Search, App, Login and Watchlist on the right. https://www.rottentomatoes.com/
- [E] **Home** is editorial, not personalised: Certified Fresh → In Theaters → Free → Streaming → TV → Box Office → Staff Picks. Same source.
- [E] **Movie page**: https://www.rottentomatoes.com/m/one_battle_after_another
  - trailer and poster → a **score pair**: Tomatometer ("94%, 447 Reviews") beside Popcornmeter ("85%, 5,000+ Verified Ratings")
  - Stream Now / Watchlist → Where to Watch
  - **"What to Know"**: the critics consensus plus an audience summary
  - critics reviews → audience reviews → cast → similar
- [E] **Review filters**: All Critics / Top Critics / All Audience / Verified Audience. https://www.rottentomatoes.com/m/one_battle_after_another/reviews
- [E] **Popcornmeter**: replaced Audience Score on 21 Aug 2024. "Verified" means a ticket bought through Fandango. https://avclub.com/rotten-tomatoes-verified-hot-badge and https://www.rottentomatoes.com/about
- [E] **TV**: the series page averages both scores and adds a season carousel with a score per season; season pages have no per-episode score. https://www.rottentomatoes.com/tv/the_bear and https://www.rottentomatoes.com/tv/the_bear/s05
- [O] Two populations side by side, each labelled by *who* with a one-line summary, is the model for "your friends vs everyone".

## 10. Analogues: books, games, music, Spotify

### The StoryGraph
- [E] **Navigation**: five tabs, Home · Reading Stats · Challenges · Community · Profile. https://ixd.prattsi.org/2025/09/design-critique-the-storygraph-android-app/
  - Users can't find their lists, search or the friends' feed. The founder (Apr 2025): "We're mid a big redesign". https://roadmap.thestorygraph.com/requests-ideas/posts/improve-confusing-navigation
  - [O] Whole tabs for Stats and Challenges spend navigation on things checked monthly.
- [E] **Book page**: the community average is hidden by default (critique: a "gulf of evaluation"). Community data is aggregated instead: moods, pace, plot vs character, graded content warnings. https://momadvice.com/post/how-to-use-the-storygraph-app-for-a-better-reading-life
- [E] **Buddy reads, the best spoiler gate in any category**:
  - up to 9 readers, each on their own edition
  - each comment is pinned to the commenter's position and stays locked until your own logged progress reaches it
  - https://bookriot.com/buddy-reads-on-storygraph/ , https://roadmap.thestorygraph.com/features and https://roadmap.thestorygraph.com/requests-ideas/posts/option-to-unlock-buddy-reads-comment-regardless-of-your-progress
  - It breaks across editions and rereads; readers type "END OF CHAPTER FIVE" as a workaround. A long-standing request asks to see what a locked comment is about. https://roadmap.thestorygraph.com/requests-ideas/posts/add-visible-comments-to-buddy-reads
  - Readalongs scale this to 1,000 readers with per-section forums. https://roadmap.thestorygraph.com/changelog/readalongs-
- [E] **Profile**: up to 5 favourites, pinned or rotating (Sep 2025); private books still count in stats (Sep 2026). https://roadmap.thestorygraph.com/changelog
  - Stats are moving to cards. https://buttondown.com/nodunayo/archive/the-one-woman-dev-team-diaries-205
- [E] **2025 wrap-up**: a long public page (first/last book → mood map → months → genres → authors → comparison → grid). https://app.thestorygraph.com/wrap-up/2025/hanreadssbooks
  - It adds a people line only when it applies, e.g. 11% of reading was shared in buddy reads. https://app.thestorygraph.com/wrap-up/2025/revieread
- [O] TV has a cleaner position than books: an episode. Gate on it and always show the label ("about S2E4").

### Goodreads
- [E] **iOS tabs**: Home · My Books · Discover · Search · More. The critique faults a duplicated search, community buried under More, and a Home full of strangers' reviews. https://ixd.prattsi.org/2024/09/design-critique-goodreads-good-books-meet-bad-ux-ios-app/
- [E] **Book page**: https://www.goodreads.com/book/show/40121378-atomic-habits
  - cover with **Want to Read** → average and counts → description, genres, editions → "What do you think?" (Rate / Review)
  - **"Friends & Following" above "Community Reviews"**, which has a distribution, text search and filters
  - Since 2021 the cover stays sticky while you scroll, and friends' reviews are in random order. https://bookriot.com/new-goodreads-book-view/
- [E] **"Compare Books"**: side-by-side ratings on shared books, sortable by "inverse popularity", plus a compatibility %. https://bookriot.com/little-known-goodreads-features/ [O] The best taste-comparison UI found: obscure overlaps come first.
- [E] **Complaints**: shelving "takes five clicks", no half stars, "an early 2010s social network" (May 2026). https://apps.apple.com/us/app/goodreads-book-reviews/id355833469 and https://unstar.app/blog/goodreads-storygraph-fable-hardcover-bookly-reading-tracker-apps-ranked-2026
- [E] **Year in Books**: a long infographic, 3+ books required. https://www.goodreads.com/blog/show/3064

### Backloggd (games)
- [E] **No native app.** About 650K users (end-2025), run by a solo developer; mobile-web logging takes about 45s against about 10s native. https://www.twoaveragegamers.com/backloggd-review/ and https://www.twoaveragegamers.com/state-of-game-tracking-2026-the-complete-industry-report/
- [E] **Fan-made Android app**: tabs Home · **Log a Game** · Search · Profile, with Notifications, Library and Activity in a drawer. https://github.com/wagenknecht/backloggd-android-app [O] When users build their own app, logging gets a tab.
- [E] **Status model**: Playing / Backlog / Wishlist toggles; Played has sub-statuses Completed, Retired, Shelved, Abandoned; logs are **playthroughs** made of dated **sessions**. https://github.com/reubensinha/PlayniteBackloggdStatus and https://github.com/DenisionSoft/backloggd-mcp [O] This maps to TV rewatch → episodes.
- [E] **Profile**: favourite tiles plus an "ultimate" favourite, counters, Game of the Year lists pinned (May 2026), grouped notifications (Sep 2026). https://backloggd.com/about/ and https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=backloggd.com&limit=100

### Musicboard, Albumm, RateYourMusic
- [E] **Musicboard**: billed as "Ratings, Reviews, and Lists" on iOS and Android; its pages are JS-rendered and couldn't be inspected. https://musicboard.app/ and https://www.producthunt.com/products/musicboard
- [E] **Albumm**: not found at any URL tried.
- [E] **RYM**: 1.6M accounts and 176M ratings; "functionality over aesthetics". https://en.wikipedia.org/wiki/Rate_Your_Music
  - Its Sonemic rebuild still has profiles, lists and messaging pending. https://sonemic.com/
- [O] Dense, data-first pages can keep a devoted community, but they aren't a model for a mobile-first social app.

### Spotify
- [E] **Navigation**:
  - a hideable Create (+) in the bottom bar; a Sep 2026 critique says it duplicates the Library +. https://support.spotify.com/us/article/create-playlists/ and https://ixd.prattsi.org/2026/09/design-critique-spotify-ios-app-3/
  - Messages live in a drawer opened from the top-left avatar. https://support.spotify.com/us/article/messages/
  - Home has identical carousels and filter pills; 3 of 4 interviewees missed the pills. https://ixd.prattsi.org/2025/12/the-emotional-impacts-of-opaque-algorithmic-features-and-usability-challenges-on-spotifys-ios-app/
- [E] **Messages** (26 Aug 2025): https://musictech.com/news/industry/spotify-dms/ , https://designcompass.org/en/2025/08/29/spotify-dm/ and https://support.spotify.com/us/article/messages/
  - started from Share
  - **suggested contacts come from people you already share Jams, Blends or playlists with**
  - message requests for everyone else; groups of up to 10
  - Since Jan 2026: an opt-in live "now playing" in the chat row, and a Jam button inside chats. https://newsroom.spotify.com/2026-01-07/listening-activity-request-to-jam-messages-updates/
- [E] **Blend**: up to 10 people, refreshed daily, with a taste-match score and "the songs that bring you two together". https://support.spotify.com/us/article/blend/ and https://newsroom.spotify.com/2021-08-31/how-spotifys-newest-personalized-experience-blend-creates-a-playlist-for-you-and-your-bestie/
- [E] **Jam**: shows who queued what; 100M listening hours a month. https://newsroom.spotify.com/2025-08-25/jam-reaches-100-million-monthly-listening-hours/
- [E] **Wrapped**:
  - 2024 was "underwhelming". https://techcrunch.com/2024/12/04/spotify-users-are-disappointed-by-an-underwhelming-wrapped-this-year/
  - 2025 went multiplayer: a **Wrapped Party** for up to 9 friends with group awards, and share-to-Messages. https://techcrunch.com/2025/12/03/spotifys-2025-wrapped-becomes-a-multiplayer-experience/
  - Results: 200M users on day one and 500M shares, up 41% on 2024. https://techcrunch.com/2025/12/04/spotify-says-wrapped-2025-is-its-biggest-yet-with-200m-users-in-its-first-day/
- [O] Spotify is the strongest evidence here that people-first recaps beat solo stats, and that DMs should be seeded from people you've already *done something with*.

## 11. Pattern table

| Page / element | Strongest pattern seen | Who | letsee |
|---|---|---|---|
| Desktop header | Visible text nav, wide search, labelled "+ Log" button; no hamburger | Letterboxd | **Adopt**. NN/g found hidden desktop nav at least 39% slower |
| Mobile nav | Labelled bottom tab bar, 4–5 items | Letterboxd, Netflix (4), TV Time (4), StoryGraph (5) | **Adopt**. letsee's mobile burger hides notifications and messages |
| Log action | Raised centre "+" | Letterboxd, Spotify, Backloggd fan app | **Adapt**: a raised button that opens a sheet, not a fake tab (HIG) |
| Home | Resume → your list → friends → editorial | Apple TV, Trakt | **Adapt**: lead with resuming *with someone* |
| Friends on home | Poster row, each friend's face and stars | Letterboxd | **Adapt**: group by title (Serializd flood complaint) |
| Film hero | Backdrop + poster + one big log button | Letterboxd app | **Adopt**, short hero (Netflix/Plex backlash) |
| Your rating | Empty "YOUR RATING" block beside the global one | IMDb, Trakt | **Adopt** |
| Friends vs everyone | Friends above community; two populations side by side | Goodreads, Letterboxd, RT, Trakt sheet | **Adopt** as a labelled score pair |
| Long title page | Jump chips under the hero | JustWatch, RT | **Adopt** |
| Where to watch | One compact offer row, your services first | JustWatch, Letterboxd | **Adopt** |
| Reason to watch | "Our Take" editorial note | Mubi | **Adapt**: the friend's reason, with their face |
| Person page | "Fade watched films" + filters | Letterboxd | **Adopt**, plus "seen with" faces |
| TV progress | Continue / Start Watching; Up to Date / In Progress / Dropped | Trakt | **Adopt**, and never remove it |
| Season page | Season switcher + per-season Friends tab | Serializd | **Adopt** |
| Episode ratings | Season × episode grid | IMDb, Series Graph | **Adapt**: collapsed, unwatched cells hidden |
| Episode moment | Rate + feeling + character, then reactions unlock | TV Time | **Adapt**: your people first |
| Spoiler gate | Comment pinned to a position, locked until reached | StoryGraph | **Adopt**, with the episode label always visible |
| Bulk progress | "Mark all previous watched?" prompt | Requested by TV Time refugees | **Adopt** |
| Profile identity | 4 favourites, counters, pins | Letterboxd, Backloggd | **Adopt** |
| Profile stats | Heatmap, streak, month-to-date | Trakt 2026 | **Adapt**: one card, not a dashboard |
| Taste comparison | Side-by-side ratings sorted by inverse popularity, plus a % | Goodreads, Spotify Blend | **Adapt**: lead with disagreements |
| Recap | Multiplayer Wrapped with group awards | Spotify 2025 | **Adapt**: a recap that leads with people |
| Recommender | "From Juan" chip that opens the reply | Apple TV Shared with You | **Adopt** on every watchlist item |
| Messages | Contacts seeded from shared activity; requests for others | Spotify | **Adopt** |
| Privacy | Per-item audience (Anyone / Close Friends / You) | Letterboxd, Plex | **Adopt**. **Avoid** Plex's opt-out sharing and emails |
| Redesign style | Fewer, bigger tiles; carousels on desktop | Netflix TV, Trakt V3, Plex | **Avoid** |
| Hidden average | Community rating hidden by default | StoryGraph | **Avoid** |

## 12. Gaps nobody fills well

- **"Who I watched it with" is still a user request in 2026.**
  - Letterboxd users tag `with-mom` (§1).
  - An Aug 2026 request to the indie tracker Reel Savings asked to pick the friends you saw a film with; the developer pointed to a "person" tag type that adds a home-screen section. https://reelsavings.userjot.com/board/p/watched-with-friends-contacts
  - [O] No product makes the companion a linked person with a shared history that both people own.
- **Synchronous co-watching keeps dying.**
  - Disney+ removed GroupWatch (18 Sep 2023). https://www.techradar.com/streaming/disney-plus-just-removed-one-of-its-best-friends-and-family-focused-features
  - Twitch ended Prime Video Watch Party (2 Apr 2024). https://alternativeto.net/news/2024/3/twitch-to-discontinue-prime-video-watch-party-feature-on-april-2
  - Plex dropped Watch Together (§8).
  - [O] What lasts is the record afterwards: who was there, what each thought, what's next.
- **Recommendation attribution exists only at the OS level.**
  - The Apple TV app's "Shared with You" shelf puts a "From <name>" chip on titles shared in Messages. https://developer.apple.com/videos/play/wwdc2022/10094/ and https://www.howtogeek.com/764065/how-to-disable-shared-with-you-on-apple-tv/
  - Tapping it reopens the conversation; Apple's own example is quickly telling your friend you're about to watch the show.
  - [O] No journal keeps "recommended by" on the watchlist entry or tells the recommender when you watch it.
- **Deciding together lives in single-purpose swipe apps** that don't know your history: Cinetic, Matched, WatchPick, MoviePicker, FlickPicker.
  - https://www.producthunt.com/p/cinetic-what-to-watch/cinetic-what-to-watch , https://apps.apple.com/us/app/-/id1623287922 and https://apps.apple.com/app/id6759346000
  - Third-party "Blend" tools intersect two Letterboxd watchlists. https://chromewebstore.google.com/detail/ijphfjlmhlnffhnhagpfffagjbbdcnpf
- **Taste comparison is a number or nothing.**
  - Criticker's TCI compares percentile-normalised scores across at least 3 shared films. https://en.everybodywiki.com/Criticker
  - Spotify and Goodreads show a percentage.
  - [O] Nobody shows *where* two people disagree, which is the most interesting thing to talk about.
- **No one shows where each person is in a show.**
  - Serializd has a season Friends tab, and Trakt a "Who's watching" sheet.
  - [O] Neither says "Sam is on S2E6, you're on S2E4", which is what you need to talk safely.
- **Spoiler gates are global or per-reader, never per-relationship.**
  - TV Time unlocked the whole crowd at once; StoryGraph hides what a locked comment is about.
  - [O] Gate by episode, keep the label visible, and rank the people you watch with first.
- **Recaps lead with numbers.**
  - Letterboxd, Trakt and Goodreads lead with counts; only StoryGraph adds a passing people line.
  - Spotify's multiplayer turn raised shares 41% (§10).
- **Messages are missing where conversations start.**
  - Letterboxd and Trakt have no DMs; IMDb's boards only just came back.
  - [O] A message sent from a title should carry that title.
- **Redesigns trade density for spectacle and remove daily pages** (Netflix TV, Trakt V3, Plex; §3, §8).

## 13. Mobile navigation evidence

- [E] **NN/g hidden-navigation study** (Jun 2016; 179 people; 6 sites): https://www.nngroup.com/articles/hamburger-menus/
  - Hidden nav cut desktop discoverability by more than 20% and slowed tasks at least 39% on desktop and about 15% on phones.
  - On phones, navigation was used 86% of the time when partly visible ("combo") vs 57% when hidden.
  - Advice: never hide desktop nav; on mobile, show it when there are 4 or fewer top-level items.
- [E] **NN/g pattern primer** (2015): tab bars for few options, 5 or fewer, persistent; hamburgers only for browse-mostly sites. https://www.nngroup.com/articles/mobile-navigation-patterns/
- [E] **Spotify** replaced its iOS hamburger with a 5-tab bar (May 2016): +30% menu-item clicks, +9% clicks overall, and more first-session engagement. https://techcrunch.com/2016/05/03/spotify-ditches-the-controversial-hamburger-menu-in-ios-app-redesign/
- [E] **Apple HIG**: tab bars are for navigation, not actions; use the fewest tabs, 3–5 on iPhone, and keep the bar visible. https://developer.apple.com/design/human-interface-guidelines/tab-bars
- [E] **Material 3**: 3–5 destinations in the bar; more than that needs a drawer; it becomes a navigation rail on large screens. https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- [E] **The centre slot follows the most-used action.** Instagram's late-2025 test moved Create to the top-left and put **DMs** in the centre tab, because "Reels and DMs" are what people use most. https://techcrunch.com/2025/09/29/instagram-is-testing-a-reels-first-ui-in-india-and-south-korea and https://www.engadget.com/instagram-tests-new-layout-that-puts-the-spotlight-on-reels-and-dms-215407062.html
  - Letterboxd, Spotify and the Backloggd fan app keep a central create/log action.
  - [O] In a journal, logging is the frequent action, so it earns the centre, styled as a raised button since tabs shouldn't act.
- [E] **Thumb reach** (Hoober, 1,333 people): 49% one-handed, 36% cradled, 15% two-handed. https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
  - [O] Put log and rate in the bottom third.
- [E] **Mobile web caveat.** In iOS 26 Safari the glass toolbar floats at the bottom, and fixed content can't render below it. Developers report bottom gaps and viewport bugs after the keyboard closes, partly fixed in 26.1. https://developer.apple.com/forums/thread/800798 , https://bugs.webkit.org/show_bug.cgi?id=297779 and https://9to5mac.com/2025/09/15/iphone-ios-26-safari-new-compact-design/
  - [O] Still use a bottom bar: pad for `env(safe-area-inset-bottom)`, test in the browser and as an installed PWA, and keep tap targets at least 44pt.

## Recommendation for letsee

**Today** (from `src/components/header/`):
- Desktop: a top bar with the wordmark, search, icons for People, Clubs, Tonight and Quick add, then the bell, messages and the account menu.
- Mobile: wordmark, search, Quick add and a burger, with notifications and messages hidden inside it and no bottom bar.
- [O] This is the hidden pattern NN/g measured as slower, and it hides the two person-to-person surfaces.

### Global navigation
**Desktop (≥1024px):** one top bar, nothing hidden.
1. **Wordmark, left.** Home link; the brand leads.
2. **Home · Tonight · Watchlist · Clubs as text links.** Visible labels beat icons (NN/g); Letterboxd proves text nav scales.
3. **Wide search box, centre.** Searches films, shows, people and members; visible like Letterboxd's and IMDb's.
4. **"+ Log" button, filled and labelled.** Letterboxd's header button: the core loop is one click away.
5. **Inbox (notifications + messages, one badge), then the avatar menu** (Profile, Diary, Lists, Import, Settings). Person-to-person surfaces get top-level icons.

**Mobile (<768px):** top bar has the wordmark plus a time-aware **Tonight** pill (the 9pm decision). The bottom bar has **5 labelled items**; labels always show, since the Pratt critique found Letterboxd's bare icons ambiguous.
1. **Home.** The default destination.
2. **Search** (with browse). IMDb, Letterboxd and Netflix all give it a tab.
3. **Log, a raised centre "+".** Opens a sheet: title → date → rating → *who you watched with*. Raised so it reads as an action, not a tab.
4. **Inbox,** notifications and messages segmented. Instagram moved DMs to the centre because that's where use is; for letsee, people are the product.
5. **You** (avatar). Profile with the watchlist as its first tab, because Serializd and Letterboxd users complain the watchlist is buried.

Hide the bar only inside the log sheet and the episode moment.

### Home (signed in)
1. **Resume, with faces.** "S2E4 of Severance, with Sam" plus Log. Trakt and Apple TV lead with resume; the companion makes it letsee's.
2. **Waiting on you** (shown only when non-empty). Watched-with confirmations, Tonight invites, "Priya watched your pick". Closes the person-to-person loops nobody closes (§12).
3. **Friends' viewings, grouped by title.** "Priya, Dev +2 watched X", each face with its stars. Letterboxd's row without the Serializd flood.
4. **Now available from your watchlist,** each with its recommender's chip. Trakt's Start Watching plus Apple's "From Juan".
5. **Decide together.** "You and Sam both want…", an intersection of two watchlists. Absorbs the swipe-app category into real history.
6. **Popular with friends of friends, then editorial.** Last for active users; first, with a follow prompt, when someone follows fewer than 5 people.

### Film page
1. **Short hero** (backdrop about 40% of the viewport, poster, title, year, director, runtime). Giant tiles were punished at Netflix and Plex; facts below the fold at IMDb.
2. **Personal status line.** "Seen twice · last 12 Mar with Sam", or "Recommended by Priya". The page knows you before it sells the film.
3. **Action row.** Primary **Log**, Watchlist toggle, inline stars as an empty "Your rating", Recommend. Letterboxd's one button plus IMDb's YOUR RATING; rows 1–3 fit the first phone screen.
4. **Friends vs everyone.** A labelled score pair, friends' faces and stars beneath, histogram on tap. Rotten Tomatoes' two populations with Goodreads' ordering.
5. **Where to watch, one compact row,** your services first. A fact, not a hero (JustWatch).
6. **Jump chips:** Friends' takes · Cast · Lists · Similar · Details. Tames the long mobile page (JustWatch, RT).
7. **Friends' reviews (written first), then popular reviews.** Fixes Goodreads' random friend ordering.
8. **Cast and crew,** marking people you've seen before. Letterboxd's "fade watched", turned around.
9. **Lists containing it, friends' lists first.** Lists are social objects; show whose they are.
10. **Similar titles with a "seen by" dot.** Discovery that stays social.
11. **Details, collapsed.** Density for loyalists without leading with it (IMDb `/reference`).

### TV show page
1. **Short hero plus status** ("Watching with Sam · you're on S2E4"). Personal state first.
2. **Progress card:** "Log S2E4", a bar per season, and each companion's position ("Sam: S2E6"). Trakt's most-opened page, plus the gap nobody fills.
3. **Friends vs everyone,** with ratings shown only for seasons you've finished. Same model as films, made spoiler-safe.
4. **Where to watch.**
5. **Seasons list:** poster, your progress, your season rating, friends who finished. Trakt removed season pages and had to rebuild them.
6. **Friends' takes, each labelled by episode** ("about S2E3") and locked past your progress. StoryGraph's gate plus the visible label its users want.
7. **Cast, lists, similar** as on films.

*Season page:*
- Serializd-style season switcher, then episode rows: still, number, title, date, your check, friends' faces.
- Unwatched episodes get blurred stills and hidden ratings.
- Checking a later episode offers "Mark E1–3 too?", the prompt TV Time and Serializd users asked for.
- A per-season **Friends** tab.

### Episode page
1. **Header:** S2E4 · title · date · runtime · previous/next. Orientation.
2. **Gate, if unwatched:** synopsis collapsed; "3 friends reacted, log it to see", with faces visible and words locked. TV Time's gate, made personal.
3. **The moment, once watched:** rating, a one-tap feeling, and "watched with" pre-filled from the show's companions. TV Time's best-loved screen, and the place to capture who was there.
4. **Your people's reactions, then everyone's,** each showing how far the writer had watched. The relationship ranks above the crowd.
5. **This episode's rating within its season row** (IMDb grid), only after watching.
6. **Guest cast and details.**

### Profile page
1. **Identity:** avatar, name, bio, counts.
   - Owner: Edit, plus a private-items marker.
   - Visitor: Follow and Message, plus a "you and them" strip: titles in common, match %, biggest disagreement, last watched together. Goodreads Compare and Spotify Blend, made legible.
2. **Four favourites.** Instant identity (Letterboxd, Backloggd).
3. **Currently watching,** each show with its companion. Trakt's progress, made social.
4. **Recent diary:** dated viewings with companion faces and ratings. A viewing is a dated event; show it as one.
5. **Watches most with:** top companions, shown only with their consent. The people-first stat no competitor has.
6. **This year card:** titles, hours, a small heatmap, linking to the year and month pages. Trakt's heatmap as one card, StoryGraph-style.
7. **Tabs: Diary · Films · TV · Watchlist · Lists · Reviews.** Letterboxd's set, trimmed. Watchlist items show their recommender.

## Sources

All sources are inline next to each claim, with dates where known. The main primary sources are the Letterboxd FAQ and film pages, the Trakt and Plex forums, the StoryGraph roadmap and changelog, the Spotify newsroom and support pages, Apple's HIG and WWDC22 session 10094, and the 2016 NN/g hamburger study.
