# One Place to Say It, One Path to Find It

> **Status:** D1–D4 built. D5 not started. One D3 acceptance criterion is deliberately left open — crew links still go to the person page rather than the browse engine; see the end of D3.
> **⚠️ Migration `065` is not yet applied.** Until it runs, `/api/takes` degrades to an empty take rather than failing, so the pages render but nothing saves.
> **Written:** 2026-08-17, against `main` @ `c40ddf0`.
> **Companion to** `SURPASSING_LETTERBOXD.md`, which covers W1–W7 (all shipped).

---

## Table of Contents

1. [The principle these share](#1-the-principle-these-share)
2. [What already exists](#2-what-already-exists)
3. [D1 — One place to say what you thought](#d1--one-place-to-say-what-you-thought)
4. [D2 — Make the page navigable](#d2--make-the-page-navigable)
5. [D3 — One browse engine, many doors](#d3--one-browse-engine-many-doors)
6. [D4 — Search that helps you before you commit](#d4--search-that-helps-you-before-you-commit)
7. [D5 — Related, using the signal only we have](#d5--related-using-the-signal-only-we-have)
8. [Sequencing](#8-sequencing)
9. [Non-goals](#9-non-goals)
10. [Open decisions](#10-open-decisions)
11. [How these criteria get checked](#11-how-these-criteria-get-checked)

---

## 1. The principle these share

`SURPASSING_LETTERBOXD.md` §W2 deleted nine carousels, a leaderboard and an entire second product on the grounds that **restraint is the strategy**. This document adds pages. That looks like a reversal and isn't, but the reason matters more than the reassurance — it's the test to apply to anything proposed later.

**The carousels were undirected.** "Here are twenty action films" answers no question anyone arrived with. It is a shelf, and a shelf costs attention without returning any.

**Everything here is directed.** The user arrives already holding the question — *more from this director*, *Marathi documentaries*, *everything TVF made*, *what did I think of this last time*. Today the app has no path to any of them, so the question dead-ends and the person leaves.

> **Cut undirected browsing. Build directed navigation.**
> A surface earns its place if a user can arrive at it *wanting something specific*. If the only honest description of it is "things you might like", it is a carousel wearing a new hat.

Every item below passes that test. That is the only reason any of them are here.

---

## 2. What already exists

Verified against the codebase on 2026-08-17. Several of these are much cheaper than they look, because the data is already being fetched and simply isn't used.

| Capability | Where | Note |
|---|---|---|
| **Credits, keywords, recommendations, similar** | `src/app/app/movie/[id]/page.tsx:17`, `tv/[id]/page.tsx:16` | Both detail pages already `append_to_response=credits,videos,images,recommendations,similar,keywords,…`. **The data for D2 is already on the page.** |
| Production companies | Same request | Comes on the base object; no extra call. |
| Directors extracted | `src/components/clientComponent/movie.tsx:59` | Already filtered out of `credits.crew` — just not clickable. |
| Person page | `src/app/app/person/[id]/page.tsx` | Exists, with `combined_credits`. The destination for a director link is already built. |
| ~~Debounced multi-type search~~ | `src/components/header/searchBar.tsx` | **Replaced by D4.** It debounced two TMDB calls per keystroke to show suggestions TMDB returns nothing for the moment a letter is mistyped. Suggestions are now local; TMDB is called on commit. |
| Fuzzy matching libraries | `fuse.js`, `fastest-levenshtein` in `package.json` | `fastest-levenshtein` powers the import resolver; `fuse.js` was one `threshold: 1` re-rank in `searchFuzzy.ts` and now also backs the D4 index. Note it already shipped on every route — `SearchBar` is in the root layout. |
| Community taste signal | `user_title_affinity` view (migration `043`) | Rarity-weighted per-user title affinity. Built for taste matching; **nothing uses it for item-to-item similarity.** |
| Franchise data | `src/staticData/franchises.ts`, `/api/franchises` | Exists, no UI consumes it. Dead unless D3 adopts it. |

**Missing entirely:** company/studio pages, keyword pages, language browsing, collection pages, and any unified place to record an opinion.

---

## D1 — One place to say what you thought

**The largest item here, and the only one that makes the app smaller.**

### The problem is the schema, not the layout

A user's opinion about a single title can currently live in **seven** places:

| Where | Columns |
|---|---|
| `user_ratings` | `score` |
| `watched_items` | `review_text` (private diary) |
| `watched_items` | `public_review_text` |
| `season_reviews` | `score`, `review_text`, `public_review_text` |
| `episode_ratings` | `score`, `note` |
| `comments` | `body` |
| `reactions` | — |

Three tables carry near-identical shapes, behind three APIs, rendered by four components on one page (`UserRating`, `WatchedReview`, `PublicReviews`, `RatingDistribution`).

**But the root confusion is narrower than the scattering, and it is this:** `review_text` and `public_review_text` are *separate columns*. A user can hold both. So the interface has to explain which box is which, and no amount of gathering them into one section fixes that — they will still ask *"which one do I type in?"*

> **One text, one visibility toggle. Not two texts.**
> The moment private and public are the same field with a flag, the mental model collapses to something a person can hold without being taught.

### Schema

One table, one row per (user, thing, scope):

```sql
-- migrations/0XX_unified_takes.sql
create table if not exists public.takes (
  user_id        uuid not null references public.users(id) on delete cascade,
  item_id        text not null,
  item_type      text not null check (item_type in ('movie','tv')),

  -- What this take is *about*. A series, one of its seasons, or one episode.
  scope          text not null default 'title'
                 check (scope in ('title','season','episode')),
  season_number  integer,
  episode_number integer,

  score          smallint check (score between 1 and 10),
  body           text,
  -- One text. Visibility is a property of it, not a second column.
  is_public      boolean not null default false,

  watched_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  primary key (user_id, item_id, item_type, scope,
               coalesce(season_number, -1), coalesce(episode_number, -1))
);
```

> Note the key includes `item_type` — see migration `064` for why a bare `item_id` is ambiguous, and what it cost to find out.

**Scope is what makes it compose.** A series page can roll up your season takes; a season page can show your episode notes. Today those are unrelated tables and cannot see each other, which is why writing about season 4 leaves no trace anywhere a reader would look.

### Migration strategy — the part that needs care

This consolidates three tables holding live data. It must be **additive first, destructive later**:

1. **`0XX_unified_takes.sql`** — create `takes`, backfill from `user_ratings`, `watched_items` and `season_reviews`/`episode_ratings`. Old tables untouched and still written by the old code.
2. **Deploy** the new API and components reading and writing `takes`.
3. **Verify** with real signed-in accounts (see §11).
4. **`0YY_drop_legacy_take_tables.sql`** — only after (3), and as a separate decision.

Backfilling `review_text` vs `public_review_text` into one `body` + `is_public` needs a rule for rows holding *both*. Proposal: **two rows** — the public one and the private one — since they are genuinely two different pieces of writing. Losing either would be data loss.

### API

```
GET    /api/takes?itemId=&itemType=&scope=&season=&episode=
       → { mine: Take | null, others: PublicTake[] }
PUT    /api/takes    body: { itemId, itemType, scope, season?, episode?, score?, body?, isPublic? }
DELETE /api/takes?itemId=&itemType=&scope=&season=&episode=
```

One route replaces `/api/user-rating`, `/api/watched-review`, `/api/season-review` and `/api/episode-rating`.

> The public list must never select another user's private `body`. `060`'s read policy already demonstrates the trap: a permitted viewer can see the whole row, so the *API* has to do the narrowing. Same caveat, now in one place instead of four.

### UI

One card, `<YourTake>`, on every title, season and episode page. Stars, one text area, one visibility toggle, one save. Nothing else.

### What shipped (2026-08-17)

| Piece | File |
|---|---|
| Schema + backfill | `migrations/065_unified_takes.sql` |
| Read/write + legacy mirror | `src/utils/takes.ts` |
| API | `src/app/api/takes/route.ts` |
| The card | `src/components/takes/YourTake.tsx` |
| Mounted at four scopes | movie, tv, season and episode pages |

**Two design choices changed once the data was measured** rather than assumed — the same habit that `064` was rewritten three times for not having:

- **`is_public` is in the uniqueness key.** The plan proposed one row per scope. But exactly one row in this database holds both a private note and a public review, and they genuinely differ — 8 characters against 13. Short enough to look like test data, which is precisely the assumption that loses someone's writing. Keeping both costs one column in the key.
- **`season_number`/`episode_number` are `NOT NULL` with a `-1` sentinel.** A nullable column can't back the plain unique constraint PostgREST's `on_conflict` requires, and `0` was unavailable as the sentinel because season 0 is real — it's specials.

**The dual-write is the whole reason this was safe.** 36 files read `user_ratings` and `watched_items`' text columns — the profile grid, the feed, Year in Review, the public reviews list, the permalink, import, export, both recommendation engines. Every take is written to `takes` *and* mirrored back to those columns, so not one of those readers changed. `takes` is the source of truth; the legacy columns are a projection kept alive until their readers move.

**Deleted, because consolidation that leaves the old surfaces standing isn't consolidation:** `UserRating`, `WatchedReview`, `PublicReviews`, `SeasonReview`, `EpisodeRating`, `EpisodeNote`, the orphaned `clientComponent/movie.tsx`, and the `/api/season-review`, `/api/episode-rating` and `/api/watched-review` routes. Those three routes wrote to legacy tables *without* touching `takes`, so leaving them would have been a silent divergence waiting for a caller.

**Verified:** clean typecheck and production build; all four pages render; the card shows "Your take" and the three old surfaces are gone from the movie page; `/api/takes` returns 401 unauthenticated, 400 on a malformed identity, and **degrades to an empty take rather than 500 while 065 is unapplied**; the deleted routes 404.

**Not verified — and this is the part that matters:** every signed-in path. Saving a take, toggling visibility, the score staying in step across both rows, and above all **whether the backfill reconciles**. See §11.

**Acceptance** *(see §11 for how each is checked)*
- [ ] A user can rate, write, and set visibility in one place without navigating.
- [ ] The same component serves title, season and episode with only a `scope` prop.
- [ ] A season take appears on the series page; an episode note appears on the season page.
- [ ] No user's private `body` is ever returned to another user — verified by request, not by reading the code.
- [ ] Backfill loses nothing: row counts before and after reconcile, including rows that had both texts.

---

## D2 — Make the page navigable

**The cheapest item on this list.** The detail routes already fetch `credits`, `keywords` and the production companies. This is almost entirely a rendering change.

- **Director, writer, producer** → link to the existing `/app/person/[id]`.
- **Keywords** → link into the browse engine (D3), filtered to that keyword.
- **Production companies / studio** → same, filtered to that company.
- **Collection** (e.g. a trilogy) → the collection's titles.

Add a proper crew block: director, writers, producers, cinematographer, composer — grouped by department, not a flat list of ninety names.

**Acceptance**
- [x] Every name and keyword shown on a detail page is a link that leads somewhere real. — verified by following them; see below.
- [x] No additional TMDB calls are added to the detail page. — both `page.tsx` files are untouched; everything rendered was already in the existing `append_to_response`.

### What shipped (2026-08-17)

| Piece | File |
|---|---|
| URL contract D3 extends | `src/utils/browseUrl.ts` |
| Minimal destination | `src/app/app/browse/page.tsx`, `BrowseGrid.tsx` |
| Crew, grouped and deduped | `src/components/detail/CrewBlock.tsx` |
| Keyword chips | `src/components/detail/KeywordChips.tsx` |
| Linked name lists | `src/components/detail/EntityLinks.tsx` |

**A minimal `/app/browse` landed here rather than waiting for D3**, because D3's own acceptance says *"every entity link from D2 lands on this engine"* and §9 forbids a page per entity type. Shipping only the person links would have left keyword and studio chips sitting inert beside genre chips that have always been links — half of D2 does not pass D2. The scope fence held: D2 ships URL parsing, one source per facet, a grid and pagination. **No filter bar, chips, sorting or composition** — those are D3, and none of them change the URL shape, so not one link written today needs rewriting.

**Reusing the existing keyword search was rejected**, for three verified reasons: the search page renders the raw query as its heading, so a keyword link would be titled *"9715"*; `searchPage` hardcodes `discover/movie`, so a keyword on a series could never return TV; and single-digit ids bounce to the landing page because the route enforces a two-character minimum.

**A live bug fixed on the way.** The collection link pointed at `/app/movie/{collectionId}` — a collection id routed as a movie id. It fails by rendering *an unrelated real film* rather than 404ing, which is why nobody had noticed. Verified fixed by reading the titles: `?collection=10` now returns all nine Star Wars films in release order.

**Also deleted:** `MovieCast.tsx`, `KeywordTags.tsx` and `CollectionBanner.tsx` — all three had zero importers, used an older visual idiom, and `CollectionBanner` hardcoded a `/app/collection/{id}` route that §9 rules out. Dead code that looks authoritative is worse than no code, because it misleads the next copy-paste.

**Verified:** clean typecheck and production build. Every facet returns a real page with a real heading — keyword 818 → *"based on novel or book"* (movies **and** TV), company 420 → *"Marvel Studios"*, network 213 → *"Netflix"*, collection 10 → *"Star Wars Collection"*, all with populated grids. No facet gives the empty state; a malformed id degrades rather than crashing. On the film page: crew renders grouped by department with jobs merged per person, 16 keyword links, a studio link, and **no** `/app/movie/10` collection link. On the series page: crew renders, and **every** keyword link carries `type=tv`.

**Not verified:** the signed-in view of these pages, and pagination past page 1.

---

## D3 — One browse engine, many doors

**The architectural call: do not build five page types.**

TMDB's `/discover` already answers every question on the list through one endpoint:

| The question | The parameters |
|---|---|
| Marathi documentaries | `with_original_language=mr&with_genres=99` |
| Everything TVF made | `with_companies=<id>` |
| Films tagged "time loop" | `with_keywords=<id>` |
| This director's work | `/person/{id}/combined_credits` |
| French thrillers from the 90s | `with_original_language=fr&with_genres=53&primary_release_date.gte=1990-01-01` |

So: **one page, one filter model, many entry points.** A director link, a studio link, a keyword link and a language link all open the *same* browser with different presets.

```
/app/browse?lang=mr&genre=99
/app/browse?company=<id>
/app/browse?keyword=<id>&sort=rating
```

**Why this shape and not five pages:**
- Dramatically less code, and one place to fix ranking, paging and empty states.
- It makes your "less back and forth" possible: from any result the user *adds or removes a filter in place* rather than navigating away and back.
- Filters compose. Five bespoke pages never would — "Marathi documentaries" needs language × genre, which no single-entity page can express.

The filter bar should show active filters as removable chips, and the URL must carry the full state so a result is shareable and the back button behaves.

**Acceptance**
- [x] "Marathi documentaries" is reachable in at most two interactions from a browse entry point.
- [~] Every entity link from D2 lands on this engine, not a bespoke page. — **Everything except people.** See below.
- [x] Adding or removing a filter never loses the others, and the URL always reflects what is shown.
- [x] Back from a result returns to the same filter state and scroll position.

### What shipped

`browseUrl.ts` grew from a four-facet id carrier into the full contract: `genre`, `lang`, `decade` and `sort` alongside the D2 facets, plus `withBrowseFilters` (the single mutation idiom) and `activeFilters` (the chips, each knowing the URL that removes it). A new server-only `browseQuery.ts` turns params into a discover query. `BrowseFilterBar.tsx` is the whole interaction surface and holds no state of its own.

| File | What it is |
|---|---|
| `src/utils/browseUrl.ts` | The contract. Pure, no deps — three client components import it. |
| `src/utils/browseQuery.ts` | Params → TMDB discover. Server-only; owns the movie/TV parameter split. |
| `src/staticData/browseFilters.ts` | Genre, language, decade and sort option lists, checked in. |
| `src/app/app/browse/BrowseFilterBar.tsx` | Toggle, four selects, removable chips, Clear all. |
| `src/app/app/browse/BrowseGrid.tsx` | Grid + per-filter-set scroll memory. |

**Deleted**, because two genre browsers contradicts the whole argument: `app/moviebygenre/`, `app/tvbygenre/`, `components/scroll/movieGenre.tsx`, `tvGenre.tsx`, and the `genreSearchmovie` / `genreSearchtv` / `moviegenreList` API routes. Four permanent redirects in `next.config.mjs` keep the old URLs working, including the `/list/16-Animation` name-suffix form.

### Evidence

Per §11, no box above is ticked on inspection alone.

- **Two interactions**: from bare `/app/browse`, Language→Marathi gives `?lang=mr`; Genre→Documentary gives `?genre=99&lang=mr`, heading "Marathi Documentary Films", **41 films** — matching a direct TMDB call made independently.
- **Composition narrows, monotonically**: Netflix 2,833 shows → +Drama 1,163 → +Korean 93 → +2020s 76. Films 1,170,024 → +Documentary 226,617 → +Marathi 41 → +2010s 6.
- **Removal preserves siblings**: on `?genre=99&lang=mr`, the Documentary chip's href is `?lang=mr` and the Marathi chip's is `?genre=99`. Structural, via `withBrowseFilters`, not per-call-site discipline.
- **Back and scroll**: on `?genre=18&decade=1990`, scrolled to y=2400, opened *The Green Mile*, pressed Back → same URL, **y=2400**. (Chrome, via the in-app browser.)
- **Type switch**: Action+1990s → TV gives Action & Adventure+1990s, chip relabelled, decade kept; back to Movies returns Action.
- **Redirects**: all five old-form URLs return 308 to the right filter.
- **Contract**: 43 assertions in a scratchpad script — idempotence, D2 links unchanged, hostile input, genre validity, sibling preservation, the movie/TV parameter split.

### Three things worth knowing

**Genre is a scalar, not a list.** The plan called for comma-joined ids with OR semantics. A single `<select>` — the convention at all 14 select sites in this app — can only ever *replace*, so the list apparatus would have been unreachable except by hand-editing the URL. Dropped it. Multi-genre needs a real multi-select first.

**Genre validity is enforced in the parser, not in the write helper.** `with_genres=27` (Horror, films only) on `/discover/tv` returns zero results and no error — it reads as "no such show" rather than "not a TV genre". Most URLs arrive from somewhere other than the filter bar (a shared link, a redirect, a hand edit), so checking only on write would have left every one of those paths exposed.

**`/discover/tv` ignores `primary_release_date` rather than rejecting it.** Measured: `first_air_date.gte=2020-01-01` returns 5,645; `primary_release_date.gte=2020-01-01` returns 229,186 — the whole catalogue. A decade filter written the movie way would have looked like it worked and filtered nothing. `browseQuery.ts` exists mostly to keep that in one place.

### The one criterion not met: people

Crew and director links still go to `/app/person/[id]`, which is a bespoke page. That page already exists, is richer than a filtered grid (biography, images, combined credits), and this section's own table answers *"this director's work"* with `/person/{id}/combined_credits` rather than with a discover call — so the criterion and the table disagree, and the table is the better answer.

Two honest options, neither taken here: add `with_cast`/`with_crew` as browse facets so a director composes with genre and decade, or amend the criterion to exempt people. **Left open deliberately** rather than ticked, because a criterion quietly reinterpreted to fit what was built is exactly the failure §11 exists to prevent.

### Also fixed in passing

- `NaturalSearch`'s "Refine" button pointed at `/app/discover`, a route that has never existed — it 404'd. It now builds a browse URL, and carries the media type and language it already knew about and used to discard.
- `<html>` had `scroll-behavior: smooth` with no `data-scroll-behavior`, which Next warns about at runtime: CSS was animating Next's own route-transition scrolls, so every navigation glided down the old document instead of arriving at the top.

---

## D4 — Search that helps you before you commit

The search bar is better than it looks: it already debounces, aborts stale requests, and searches movie, TV, person and keyword in parallel. The gap is not plumbing.

**The constraint you named is real:** TMDB will not fuzzy-correct. Asking it to spell-check is asking the wrong service.

**So do not ask it.** Build a **local index** — the user's own library, plus a cached slice of trending and popular titles — and run `fuse.js` (already a dependency) over it on every keystroke. That gives instant, typo-tolerant suggestions with **zero network latency**, and TMDB search runs only when the user commits.

That is how you get "type and see" inside the provider's limits: the correction happens locally, against the few thousand titles a person is overwhelmingly likely to mean.

Also worth fixing while there: results should be *grouped and ranked* (titles first, then people, then keywords) rather than concatenated, and keyboard navigation should select.

**Acceptance**
- [x] A suggestion appears within one frame of typing, before any network response.
- [x] A misspelling of a title in the user's own library still surfaces it.
- [x] TMDB is called on commit, not on every keystroke.

### The premise, confirmed rather than assumed

"TMDB will not fuzzy-correct" was worth measuring before building a subsystem on it. Against `/search/multi`, every one of these returns **zero results** — not degraded, zero:

| typed | TMDB hits | | typed | TMDB hits |
|---|---|---|---|---|
| `Inception` | 13 | | `Incepton` | **0** |
| `Interstellar` | 32 | | `Intersteller` | **0** |
| `Shawshank` | 5 | | `Shawshenk` | **0** |
| `Parasit` | 138 | | `Gladeator` | **0** |

It matches prefixes — `Parasit` finds *Parasite* — but has no edit-distance tolerance at all, so one dropped letter is an empty page. Latency from this machine was 270–731ms, median 288ms, so even a correctly spelled query cost a round trip before anything could appear.

### What shipped

| File | What it is |
|---|---|
| `src/utils/searchIndex.ts` | The index and query logic. Pure — no React, no fetch — so it is verifiable by script. |
| `src/app/api/search/index/route.ts` | Public popular slice. `public, s-maxage=3600`. |
| `src/app/api/library/index/route.ts` | The signed-in user's titles. `private, no-store`, explicit column allowlist. |
| `src/components/header/useSearchIndex.ts` | Loads both layers on first modal open, once per session. |
| `src/components/header/searchBar.tsx` | Rewired: local suggestions per keystroke, TMDB only on commit. |

The change **removes** more than it adds to the search bar: the 250ms debounce, its `AbortController`, its response cache, the two-request-per-tick fetch and the `reRankAll` pass are all gone, because suggestions no longer come from the network.

### Evidence

- **Zero network per keystroke.** With `fetch` instrumented, opening the modal issued exactly two requests (`/api/library/index`, `/api/search/index`). Typing 12 characters then issued **`[]` — nothing**. The old path made two origin requests plus up to a dozen poster fetches *per debounce tick*.
- **Within one frame.** Keystroke → React commit, measured in the browser over 17 queries: **p50 5.3ms, p95 7.6ms, max 9.5ms** against a 16.7ms budget. Honest caveat: this is to commit, not through compositing, because the automation pane never fires `requestAnimationFrame`.
- **Misspellings resolve.** Live, in the app: `gladeator`→*Gladiator (2000)*, `shawshenk`→*The Shawshank Redemption (1994)*, `the grene mile`→*The Green Mile (1999)*, `brekingbad`→*Breaking Bad (2008)*, correctly grouped under TV Shows. TMDB returns zero for every one.
- **Index logic.** 32 assertions in a scratchpad script — typo→top-1 for library and popular titles, junk rejection, the short-query prefix path, grouping, dedupe preference, the cap, hrefs and normalization.
- **Headers.** `/api/library/index` signed out → `401` with `no-store`. `/api/search/index` → `200` with `public, s-maxage=3600`.

### The numbers behind the configuration

Every value was measured rather than chosen, because a threshold picked by feel is how typo-tolerance quietly becomes nonsense.

**Index cap — 5,000 rows.** fuse.js 7.1.0 search cost by corpus size, p50/p95: 500 → 0.37/1.12ms; 2,000 → 1.32/3.85ms; **5,000 → 3.25/9.56ms**; 10,000 → 6.72/**19.21ms**; 20,000 → 12.67/37.55ms. 10,000 misses the frame at p95, so the index is capped rather than the criterion softened.

**`threshold: 0.3`.** Rank-1 accuracy over 200 real titles × 3 typo classes on a 978-title corpus: 0.20 → 96.2%, **0.30 → 99.7%**, 0.40 → 99.5%, 0.50 → 99.5% *but junk starts matching*.

**`minMatchCharLength: 3`** is what actually excludes junk. On a ~3,900-title corpus, `asdf` returns 4 titles at length 2 and **none** at length 3, at every threshold up to 0.35. At threshold 0.4 even length 3 lets `aeiou` match 23 titles — which is why the two are tuned together.

**No prefix or word-boundary score boost**, despite the obvious temptation. Measured, plain Fuse at 0.3 already ranks correctly — `dark` → *Dark, Poldark, Dark Phoenix*; `godfather` → *The Godfather* first — and adding a prefix tier made it **worse**, promoting *Godfather of Harlem* above *The Godfather*.

### One bug this surfaced, and three honest limits

**`fetchTmdb` throttles cache hits.** It calls `waitForSlot()` *before* every request, so the 120ms rate-limit gap is paid whether or not Next serves from the Data Cache. The index route sat at a flat **3.95s on every request** — 22–33 calls × 120ms — with caching working perfectly and making no difference. Wrapping the build in `unstable_cache` took it to **2.6s cold, 4ms warm**. Worth knowing: any route here that fans out over TMDB pays this, cached or not.

- **Keywords lost their place in the dropdown.** The local index holds titles and people; TMDB has no "popular keywords" endpoint to seed a third group from. Keywords still appear on the committed search page. This is a real, if small, regression against the plan's "titles, then people, then keywords".
- **People are limited to the top 40.** `leonrdo` finds nothing, because DiCaprio isn't in the two pages of `/person/popular` the slice carries. Committing still finds him.
- **The index does not refresh mid-session.** It is built on the first modal open and rebuilt on the next page load. Refetching after every status toggle would mean a fresh download per episode marked; `resetSearchIndex()` exists for when that trade changes.

### Already present, so not built

The plan asked for keyboard navigation to select. `searchBar.tsx` already had it — `activeIndex`, ArrowUp/Down and Enter→select. The only change was extending the cycle so the "Search everything" row at index `-1` is reachable by arrow rather than only by clearing the selection.

---

## D5 — Related, using the signal only we have

TMDB's `/recommendations` and `/similar` are weak, and both are already fetched and shown.

But migration `043` built `user_title_affinity` — a rarity-weighted view of which users engaged with which titles — for taste matching between *people*. **The same data answers item-to-item similarity**, and nobody is using it for that.

> "People here who watched this also watched…" is the one related-titles signal a TMDB-backed competitor cannot copy, because it is this community's data rather than the provider's.

Proposed ranking, best signal first: shared keywords → same director → same collection → **our own affinity** → TMDB's list last.

**One section, not four.** Four mediocre related rails is how the home page reached twenty-five surfaces. One good section that says *why* — "shares 4 keywords with this", "also directed by X" — is worth more than four that say nothing.

**Acceptance**
- [ ] Every related title carries a one-line reason, in the evidence style used by `tasteMatch.ts` and Tonight.
- [ ] The section degrades to TMDB's list when the community has no signal yet, without an empty state.

---

## 8. Sequencing

1. **D1 — unified takes.** First, because it is the only item that *removes* surface area, and because D2/D3 will want to show "your take" on cards. Settle the model before building on it.
2. **D2 — entity links.** Cheap, immediately visible, and it creates the demand that justifies D3.
3. **D3 — the browse engine.** The largest new surface; worth having real traffic from D2 pointing at it first.
4. **D4 — search type-ahead.**
5. **D5 — related.** Last: it benefits from D2's keyword plumbing.

D1 and D3 are each comparable in size to a workstream from `SURPASSING_LETTERBOXD.md`. **This is not a weekend.**

---

## 9. Non-goals

- **Multiple related sections.** One good one. See D5.
- **A bespoke page per entity type.** See D3.
- **Rich text, spoiler tags, review drafts.** Still deferred, as in W7 — polish on a loop that should first be proven to work.
- **Replacing TMDB search entirely.** The local index is a *first pass* for correction, not a search engine.
- **Recommendation ML.** The affinity view is a join, not a model. Keep it explainable — every suggestion must be able to say why.

---

## 10. Open decisions

1. **Backfill rows holding both a private and a public text** — two rows (proposed) or one row plus a dropped field? Two loses nothing; one is simpler and loses writing.
2. **Do the legacy tables get dropped?** Proposed: not in the same release. Additive first, destructive as a separate decision after real verification.
3. **Does `takes` replace `comments` on reviews too?** Proposed: no. A comment is a *reply to someone else*, not a take on a title. Different thing, keep it separate.
4. **Should `/app/browse` be public (signed-out)?** Proposed: yes — unlike Tonight, it needs no personal data, and it is the app's only real SEO surface.
5. **Keyword page vs keyword filter.** Proposed: filter only. A keyword is a facet, not a destination.

---

## 11. How these criteria get checked

`SURPASSING_LETTERBOXD.md` §16 found that seven of its twenty-eight criteria did not hold, and **four of those were the document quietly going out of date** — a sub-2s budget that the design guaranteed could never be met, a provider flag specified and never built. They survived because nothing forced the plan and the code to be read together.

> **A criterion nobody re-checks is a claim, not a test.**

So every acceptance box above must name its evidence before it is ticked:

| Kind | Evidence required |
|---|---|
| Behaviour | A request or interaction with its observed result pasted in — not "looks right". |
| Privacy | A request made **as another user** showing the private field absent. Reading the policy is not evidence. |
| Performance | A measured number from where it runs, not an arithmetic floor. |
| Data migration | Row counts reconciled before and after, including the awkward cases. |

Anything that cannot be checked this way should be rewritten until it can, or dropped.
