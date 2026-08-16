# One Place to Say It, One Path to Find It

> **Status:** D1 built — see the note in §D1. D2–D5 not started.
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
| Debounced multi-type search | `src/components/header/searchBar.tsx:198` | Already searches movie + tv + person + keyword in parallel with abort handling. Better than expected. |
| Fuzzy matching libraries | `fuse.js`, `fastest-levenshtein` in `package.json` | Installed. `fastest-levenshtein` is used by the import resolver; `fuse.js` is barely used. |
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
- [ ] Every name and keyword shown on a detail page is a link that leads somewhere real.
- [ ] No additional TMDB calls are added to the detail page. If a call is needed, it belongs in D3's engine, not here.

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
- [ ] "Marathi documentaries" is reachable in at most two interactions from a browse entry point.
- [ ] Every entity link from D2 lands on this engine, not a bespoke page.
- [ ] Adding or removing a filter never loses the others, and the URL always reflects what is shown.
- [ ] Back from a result returns to the same filter state and scroll position.

---

## D4 — Search that helps you before you commit

The search bar is better than it looks: it already debounces, aborts stale requests, and searches movie, TV, person and keyword in parallel. The gap is not plumbing.

**The constraint you named is real:** TMDB will not fuzzy-correct. Asking it to spell-check is asking the wrong service.

**So do not ask it.** Build a **local index** — the user's own library, plus a cached slice of trending and popular titles — and run `fuse.js` (already a dependency) over it on every keystroke. That gives instant, typo-tolerant suggestions with **zero network latency**, and TMDB search runs only when the user commits.

That is how you get "type and see" inside the provider's limits: the correction happens locally, against the few thousand titles a person is overwhelmingly likely to mean.

Also worth fixing while there: results should be *grouped and ranked* (titles first, then people, then keywords) rather than concatenated, and keyboard navigation should select.

**Acceptance**
- [ ] A suggestion appears within one frame of typing, before any network response.
- [ ] A misspelling of a title in the user's own library still surfaces it.
- [ ] TMDB is called on commit, not on every keystroke.

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
