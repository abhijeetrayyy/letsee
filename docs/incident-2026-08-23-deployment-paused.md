# The deployment pause of 23 August 2026

On 23 August, Vercel paused the deployment. `letsee.online` served HTTP 402
and "This deployment is temporarily paused" to everyone.

Nothing was hacked, nothing was corrupted, and no code was broken. The site
was taken down by its own hosting bill, and every change that led there was
intentional and — individually — correct.

This document exists so the same shape of failure is recognisable next time.

---

## 1. The numbers

Usage for the window 24 Jul – 23 Aug, Hobby plan:

| Metric | Used | Limit | |
|---|---|---|---|
| Fast Origin Transfer | 13.71 GB | 10 GB | **over** |
| Function Invocations | 1,054,175 | 1,000,000 | **over** |
| Fluid Active CPU | 12h 1m | 4h | **over** |
| Fast Data Transfer | 10.06 GB | 100 GB | fine |
| Edge Requests | 964K | 1M | close |

`letsee` was **94.9%** of the origin transfer and **96.7%** of the invocations.
Everything else on the account was noise.

The usage graph is flat until **19 August**, then jumps to roughly 3 GB/day and
stays there.

---

## 2. What actually happened

Four changes, none of them wrong, arranged themselves into an outage.

**a. Nothing on the site could be cached.**

Every detail page answered:

```
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

Measured against the static `/` from the same build, which returned
`s-maxage=31536000`. So every request — human or robot, first or thousandth —
rebuilt the page from scratch. One function invocation plus a full origin
transfer of roughly 300 KB, every time.

This was true before any of the SEO work. It was simply never expensive,
because almost nobody was visiting.

**b. A sitemap invited crawlers to 1021 pages.**

On 19 August the site got names in URLs, canonicals, structured data, a
1021-URL sitemap and a robots.txt pointing at it. That is what SEO work is
*for*, and it worked. Crawlers arrived. The graph starts climbing that day.

**c. The cast pages grew the link graph fortyfold.**

The TV cast page had been showing **8 of 348** people because it read
`/tv/{id}/credits` (a stub) instead of `aggregate_credits`. Fixing that was
right. It also meant every cast page began emitting ~400 internal links into
`/app/person/[id]`.

The result is visible in Observability: `/app/person/[id]` became the busiest
route on the site at **22K invocations in 12 hours**, ahead of
`/app/movie/[id]` at 16K.

**d. Middleware ran a session refresh for visitors with no session.**

`updateSession` created a Supabase client and called `auth.getUser()` — a
network round trip — before doing anything else. Everything it then does is
inside `if (user)`.

A crawler has no cookies, so it could never produce a user. Every one of those
requests paid for a round trip to be told "no session" and returned the
response it already had. Middleware was **527,753 invocations, 50.1% of the
account total**, and is the most likely explanation for Active CPU at 12h
against a 4h limit.

### The chain, in one line

Sitemap invites crawlers → cast pages hand each one ~400 person links →
every page is rebuilt from scratch per hit → middleware adds a pointless
Supabase round trip on top of each rebuild.

---

## 3. Root causes

Not "we shipped SEO". The SEO was fine. These are the actual faults:

**R1 — Traffic-attracting work shipped without checking the site could serve
traffic.** A sitemap is a request to be crawled. Nobody asked "what does one
crawl of 1021 pages cost us?" before sending it. That question has a number,
and the number was knowable in advance.

**R2 — A cookie-reading Supabase client used where no session was needed.**
`createClient()` reads cookies, and reading cookies opts a route out of
caching entirely. In `relatedData.ts` this sat two components deep behind a
Suspense boundary and silently made *every* movie and series page uncacheable.
The session was never used — `related_by_audience` aggregates over everybody.

This is the **same fault, in the same codebase, for the second time**: it had
already happened in `sitemap.ts`, where the cookie client forced a dynamic
render and a `catch` swallowed the resulting error.

> A server client that reads a session you do not need is not a neutral
> default. It is a caching opt-out with no visible symptom.

**R3 — `revalidate` was assumed to enable caching. It does not, on its own.**
On a dynamic segment (`[id]`) without `generateStaticParams`, Next treats the
route as fully dynamic and emits `no-store` regardless of `revalidate`. The
first attempt at a fix therefore appeared to do nothing.

**R4 — A silently ignored fetch option.** The cast pages passed
`{ next: { revalidate: 3600 } }`, but `tmdbFetchJson` reads `revalidate` at the
top level and ignores the nested form. Those four calls had been running
`no-store` for their whole life. It was invisible until the page became static,
at which point Next refused to serve a prerender that re-fetched every time and
the pages 500'd.

**R5 — No usage alarm.** The first signal was the site being down.

---

## 4. What was fixed

| Fix | Effect |
|---|---|
| `generateStaticParams` returning `[]` + `revalidate` on movie / tv / person / both cast pages | `no-store` → `s-maxage=3600, stale-while-revalidate` |
| `relatedData` switched to a cookie-free anon client | removed the hidden caching opt-out |
| Cast page fetches moved to top-level `revalidate` | fetches actually cache; fixed the 500 |
| Middleware returns early when no `sb-*auth-token*` cookie is present | no Supabase round trip for crawlers or signed-out visitors |

Also, earlier the same week and pulling in the same direction: the movie page
payload went from **373 KB → 278 KB** (script payload 221 KB → 126 KB) by not
serialising TMDB fields nothing renders.

After the fix, a crawler hitting the same URL twice costs one render and then
nothing.

---

## 5. Rules to avoid a repeat

**Before shipping anything that increases traffic** — a sitemap, indexability,
a big expansion of internal links:

1. Check what the affected pages cost to serve. In the build output, `●` and
   `○` are cheap; `ƒ` is a full render on every single hit.
2. Multiply: *(pages) × (crawlers) × (revisits) × (KB per render)*. If that
   number is uncomfortable, cache before you invite.
3. Confirm with the actual header, not the build marker:
   `curl -sI <url> | grep -i cache-control`. `s-maxage=…` is cached;
   `private, no-store` is not.

**When adding a Supabase call in a server component:**

4. Ask whether the answer depends on *who* is asking. If not, use a bare anon
   client — never `createClient()`. One cookie read anywhere in a route's tree
   makes the whole route uncacheable, and nothing warns you.

**When making a page cacheable:**

5. `revalidate` alone is not enough on a `[param]` route. It needs
   `generateStaticParams` — returning `[]` is fine and means "prerender
   nothing, cache on demand".
6. Watch out for fetches that then fail: a static page containing a `no-store`
   fetch throws *Page changed from static to dynamic at runtime* and 500s.

**Operationally:**

7. Set a usage alert in Vercel at ~70% of each limit. The current signal is an
   outage.
8. Read Observability → Functions by route after any traffic-affecting change.
   That view is what identified `/app/person/[id]` and the middleware share;
   the aggregate usage page could not have.

---

## 6. Process lessons (how the mistakes were nearly missed)

Worth recording separately, because several checks reported "fine" while the
thing being checked was broken.

- **An invariant test passed twice while the rule it enforced was violated.**
  A regex for hand-built URLs first missed interpolated types
  (`/app/${kind}/…`), then missed dots (`/app/${t.itemType}/…`) because `\w+`
  does not match `.`. Both runs were green. Seventeen violations were found
  only on the third attempt. *A pattern that under-matches reads exactly like a
  pass.*

- **A revert-and-retest produced the wrong conclusion.** A page 404'd five
  times, stashing the changes made it work, and the obvious reading was "I
  broke it". Restoring the changes also made it work — the real variable was
  TMDB being unreachable. *One green run after a revert is not a bisect.*

- **Several greps reported false negatives.** React emits `<!-- -->` between an
  interpolated number and adjacent text; `grep -c` on a shell variable counts
  lines, not matches; a `sed` that strips the origin hides a canonical whose
  value *is* the origin; and a CDN can serve a stale copy of a page you just
  deployed. *A failed check is not the same as a failed feature — verify the
  checker before believing it.*

- **A comment asserting something is safe is not evidence.** A canonical was
  placed on a layout with a comment explaining why it was fine. It was not
  fine: `alternates` is inherited, and a child route's noindex fallback
  immediately began claiming the parent's canonical. Reading the rendered HTML
  found it; reasoning had not.

---

## 7. Still open

Ordered by value.

1. **Vercel usage alerts.** Still not set, and still the cheapest item here.
   It is a dashboard setting, not code — Vercel → project → Settings →
   Notifications/Usage. Set one at ~70% of each limit. Right now the first
   signal is an outage.

2. **`next/image` — deliberately NOT adopted.** `remotePatterns` is configured
   for `image.tmdb.org` and nothing imports `next/image`. Converting the 88
   `<img>` tags looks like an obvious win and would have made this incident
   *worse*: Vercel meters Image Optimization as its own resource, so every TMDB
   poster would become a billed transformation on a plan that just blew three
   limits. The existing `loading="lazy"` already does the useful part — 88 of
   95 images on a detail page carry it. Revisit only on a plan where
   transformations are not scarce.

3. **Routes still rendered per request**, with 12-hour invocation counts:

   | route | invocations | why it cannot be cached |
   |---|---|---|
   | `/app/browse` | 2.8K | reads `searchParams`, which forces dynamic rendering — tested, still `no-store` with `revalidate` set |
   | ~~`/app/tv/[id]/season/[seasonNumber]`~~ | ~~439~~ | **done** — see below |
   | `/app/review/[id]` | — | reads the author's visibility settings server-side |

   `/app/browse` remains the honest entry on this list. `searchParams` forces
   a dynamic render and there is no way around that short of Partial
   Prerendering.

   `/app/review/[id]` is now a *decision* rather than an open item, and the
   page says so in its own header comment: the author sees their own review
   before the visibility gate runs, and a follower sees a followers-only
   review that a stranger must not. ISR caches per URL and serves that render
   to whoever asks next, so caching it would publish the first viewer's
   version. The same reasoning applies, more strongly, to `/app/profile/[id]`.
   Both were made cheaper *inside* the render instead — see below.

### Done since this document was first written

- Middleware now skips sessionless requests via matcher `has` conditions
  rather than returning early inside the function — the invocation itself is
  gone, not just its cost. Guarded by `tests/invariants/proxy-matcher.test.ts`,
  because the failure mode (wrong project ref → signed-in users silently
  logged out) is invisible.
- 13 unreferenced API routes deleted.
- `/api/user-rating`'s unused parameters explained rather than removed: the
  name is already recorded by `watched_items` before the handler runs.

---

## 9. Second cost pass, 25 August 2026

The first pass fixed what took the site down. This one went looking for what
was still being paid for once it was back up. Six findings, grouped by what
they cost.

### 9.1 Invocations nobody asked for

**Two client timers were billing while nobody was looking at the page.**

`BurgerMenu` polled `/api/notifications/unread-count` on a bare
`setInterval(…, 60_000)` with no visibility check. A signed-in person who
leaves the site open in a background tab — the normal way a tab like this one
gets used — spent 60 invocations an hour, all night, keeping a badge correct
on a page that was not being rendered. Sixteen such tabs is a million
invocations a month on their own. It now polls only while
`document.visibilityState === "visible"`, at 120s, and reads once on becoming
visible. The badge is *more* current than before: returning to the tab is now
itself a refresh, where previously it could show a number 60 seconds old.

`AuthProvider`'s self-heal was worse, because it had no attempt limit. It
fires while the app believes you are signed out *and* a Supabase cookie is
still present — written for a request that raced a token refresh, which the
next check resolves. But an expired refresh token, a cookie from a different
project, or a server-side revocation all leave the cookie in place, so the
condition never stopped being true. Every 15 seconds, forever, and because
`fetchUser` retries an "anon" answer up to three more times when a cookie is
present, one tick was up to four invocations: roughly 16 requests a minute
from a browser that is simply logged out. It is now four attempts on a
doubling ladder (15s, 30s, 60s, 120s) and then silence, re-armed by
`visibilitychange`.

**The client router cache was off**, which is Next's default and not a good
one here. `experimental.staleTimes.dynamic` defaults to **0**, so every
dynamically-rendered route throws its RSC payload away the moment you navigate
off it. Grid → film → back → film → back was four renders of two pages. It is
now 30 seconds — the length of a single browsing gesture — and Back inside
that window is served from memory. Faster and cheaper at once. Nothing that
must be live is affected: it is all client-fetched through SWR, and the two
`router.refresh()` call sites clear the cache explicitly.

### 9.2 Three more pages that could be cached and were not

All three were `ƒ` in the build output and are `●` now, confirmed by a
production build.

| route | what was blocking it |
|---|---|
| `/app/lists/[listId]` | `createClient()` — **R2, third occurrence** |
| `/app/tv/[id]/season/[seasonNumber]` | one `initialStatus` prop |
| `…/episode/[episodeId]` | a session read feeding a **dead variable** |

The list page renders nothing on the server but JSON-LD and metadata
describing a *public* list — the list itself is a client component that
fetches its own data. It was uncacheable purely because it reached for the
cookie-reading client out of habit. That is the same fault as `sitemap.ts` and
`relatedData.ts`, for the third time, which is why `createAnonClient()` now
exists as one import in `src/utils/supabase/anon.ts` rather than six lines
that have to be remembered.

The season page's only viewer-dependent read was `initialStatus` on the
Watchlist/Watching selector — and `TvStatusSelector` already knew how to fetch
its own status when the prop is omitted. This document called that fix "real
work for a small return". It was fourteen lines, and the return is every
season URL in the sitemap.

The episode page opened a session and read the viewer's own score out of
`episode_ratings` into a local called `userRating`. **Nothing read it.** The
most numerous page type on the site was uncacheable in order to compute a dead
variable.

`TitleTalk`'s `isAuthenticated` prop is now optional, falling back to
`useMediaInteraction()`. Computing it on the server was the last session read
on both TV pages.

### 9.3 The min-of-all-fetches trap, again

Raising a route's `revalidate` does nothing if a fetch inside it is shorter —
R3, which cost this codebase a measurement round once already.
`TMDB_REVALIDATE_SEC` in `tmdbTvShow.ts` was **300 seconds**, and seven call
sites read through it, so it was the real ceiling on the season page no matter
what its own `revalidate` said. Now 21600, matching the series page and the
episode page, and chosen for the same reason: this payload carries
`next_episode_to_air`.

**The stated tradeoff:** a newly aired episode can take up to six hours to
appear in continue-watching and in a season's episode list. The product
already accepts coarser than that — the new-episode notification cron runs
once a day.

Four other TMDB call sites were running `no-store` without meaning to.
`fetchTmdb` falls back to `no-store` when no `revalidate` is passed, which is
easy to miss at a call site that passes no options at all: `searchPage` (×3),
`quick-add/feed` (×2), `tvMediaStatus` (×3, all requesting the identical URL
on write paths), and `homeSearch`.

### 9.4 A POST that should have been a GET

`/api/homeSearch` writes nothing. It reads a query, asks TMDB, returns the
answer — the same answer for everybody. But **no CDN caches a POST**, by
definition, so every home-page search reached the origin even when the person
before had searched the same word a second earlier. It is a GET now, with
`s-maxage=1800` matching `/api/search`.

`/api/searchPage` was left as a POST: ten filter parameters, and the win is
smaller. Its TMDB fetches are cached instead.

### 9.5 A shared cache that was not quite honest

`/api/reviews/popular` carried a comment saying its response "is identical for
every viewer and can genuinely be shared-cached". Nearly true, and the gap
mattered: the client was the cookie-reading one, and RLS on `takes` and
`watched_items` is `auth.uid() = user_id OR profile_visible_to_viewer(user_id)`.
A signed-in reader's `limit(limit * 8)` window was therefore drawn from a
*wider* row set than a stranger's — their own private takes, and those of
accounts they follow — which the public-only filter then discarded. Not a
leak, but two viewers could get different results from the same query, and a
paginated window that spends itself on rows it is about to throw away is
simply wrong. Reading as `anon` fixes both.

Its empty response was also `maxAge: 0`, and "no public reviews in the last
seven days" is the *normal* state of a young site — so the one answer nobody
was caching was the one almost every home-page visitor got. Now 300s.

**A caution for the invariant test.** `tests/invariants/route-rules.test.ts`
decides a route is identity-aware by grepping for `getAuthUserId`,
`auth.getUser`, `viewerId`, `currentUserId`. That heuristic would have cleared
`/api/rating-distribution` for a shared cache, and it would have been wrong:
the route contained none of those words and was still per-viewer, because
`createClient()` reads cookies and RLS does the rest. **A cookie-reading
client is itself an identity read.** The test cannot see that, so a human has
to.

### 9.6 Round trips standing in a queue

`/app/profile/[id]` cannot be cached and should not be — it branches on
`isOwner` throughout, and ISR would hand the owner's view of a private profile
to the next visitor. So it was made cheaper inside the render instead:

- Nine independent queries — favourites, Taste in 4, recent activity, diary
  notes, currently-watching, the watchlist, the taste pair, the featured list,
  the pinned review — ran as nine sequential `await`s. None depends on any
  other; every input they need is known before the first one starts. They were
  serial because that is what one `await` per line does. Page wall time was
  the *sum* of nine round trips and is now the slowest one.
- `generateMetadata` and `fetchProfileData` each looked up the same user row,
  by the same username, in the same request. React's `cache()` makes that one
  read.

`/app/review/[id]` had the same doubling — the review row and the author row
read twice per render, four round trips where two would do. Its
`generateMetadata` comment claimed "the request is deduped anyway"; that is
true of `fetch` and supabase-js is not `fetch`. `cache()` is what actually
made the comment true.

### 9.7 Three dead routes deleted

`/api/rating-distribution`, `/api/friends-watched` and `/api/title-audience`
were superseded by `/api/title-room`, which consolidated all three, and then
left deployed and unreferenced. A superseded route is a publicly reachable
endpoint running a `user_ratings` scan for nobody. Deleting them is part of
superseding them.

### 9.8 Still open after this pass

1. **The usage alerts from 7.1 are still not set.** This remains the cheapest
   item in this document and the only one that is not code. Two passes of
   engineering have now gone into making the bill smaller; none of it tells
   anyone when it starts growing again.
2. **Confirm the three new `●` routes with a real header.** The build marker
   is the first check, not the last — §5.3 of this document exists because a
   marker and a header disagreed once already:
   `curl -sI https://letsee.online/app/lists/<id> | grep -i cache-control`
   should show `s-maxage`, not `private, no-store`.
3. **`/app/browse`** is unchanged and unchangeable without Partial
   Prerendering.
4. **`next/image` is still deliberately not adopted**, for the reason in 7.2.

## 10. Third pass, 26 August 2026: the browser talks to the database

The first two passes made the pages cheaper to serve. This one asks a different
question: **why is a Vercel function involved at all?**

### 10.1 The shape of the waste

Ninety API routes existed. Two used the admin client. The other eighty-eight
opened a *cookie-reading* Supabase client, ran a query, and returned the rows —
and every one of those queries was already gated by a row policy. There are 159
of them, and the `*_self` policies are `auth.uid() = user_id` for ALL commands.

> A route whose only contribution is reading the cookie is not a security
> boundary. The database is the security boundary. The route is a paid-for hop
> in front of it.

The browser holds the same anon key and the same JWT. PostgREST evaluates the
same policy either way. Moving the caller does not move the check.

### 10.2 What was on every single page view

Five function invocations, per page, per signed-in visitor, before the page
rendered anything:

| caller | route | what it actually was |
|---|---|---|
| `AuthProvider` | `/api/navbar` | one row of `users` |
| `MediaInteractionProvider` | `/api/user-media-status` | one `select` |
| `MediaInteractionProvider` | `/api/userPrefrence` | two `select`s |
| `MediaInteractionProvider` | `/api/user-rating` | **a 400** — see below |
| `UserPrefrenceProvider` | `/api/userPrefrence` | the same two `select`s again |

Both providers are mounted in `/app/layout.tsx`, so the third and fifth rows are
the same query, twice, on every navigation. All five are now direct queries and
none of them touches Vercel.

Two clocks went with them. The burger badge polled
`/api/notifications/unread-count` every 120 seconds for as long as a tab was
open; `notifications` and `messages` have been in the realtime publication since
070 and 079, so the database can say when the number changed. And
`AuthProvider`'s self-heal — the four-step ladder §9.1 installed — is gone
rather than tuned: it existed because `/api/navbar` could lose a race with a
token refresh, and `supabase.auth.getSession()` cannot lose that race because it
*is* the cookie read.

### 10.3 Then the rest of the hot path

| what | routes removed | ran on |
|---|---|---|
| the take composer and its thread | `/api/takes`, `/api/comments` | every movie, series, season and episode page |
| the Room | `/api/title-room` | every movie and series page |
| the home page | `/api/currently-watching`, `/api/club-pick/current`, `/api/profile/stats/summary`, `/api/profile/settings` | every signed-in session's first screen |
| the profile grids | `/api/UserWatchedPagination`, `/api/UserFavoritePagination` | every page of scroll — and both were **POST**, which no CDN caches |
| the bell page and every like | `/api/notifications`, `/api/reactions/toggle` | one invocation per tap |

Fourteen routes deleted. `tests/invariants/columns-exist.test.ts` asserts a
floor on the route count so the column rules cannot pass by iterating an empty
list; that floor was lowered deliberately, with a note saying it is expected to
keep falling.

### 10.4 What did NOT move, and why

- **Anything holding the TMDB key.** Search, discovery, the feed, availability,
  the import. A key in a browser is a key that is published.
- **The two service-role routes** (`cron/purge-deleted`) and the cron surface.
- **`/auth/callback` and `/auth/confirm`**, which are redirect targets.
- **Business logic spanning several tables** — the status write chain, the
  favourite chain. These are not "a query the browser can make": they are four
  statements that must all happen. They belong in a Postgres function, called in
  one round trip, not in four round trips from a client that might close the tab
  between the second and the third. That is the next pass, and it is a
  migration.

### 10.5 The rule this pass establishes

§5.4 already says: *if the answer does not depend on who is asking, use a bare
anon client.* This is the other half of it.

> **If the answer depends on who is asking, and RLS already knows who is asking,
> let the browser ask.** A route earns its invocation by holding a secret, doing
> something atomic, or being cacheable for everyone. Forwarding a query is none
> of those.

### 10.6 Four bugs found by moving the code

Not the point of the exercise, but this is what reading every call site turns
up.

1. **Ratings were never hydrated.** `MediaInteractionProvider` called
   `/api/user-rating` with no query string, and that handler answers **400**
   unless `itemId` and `itemType` are both present — there has never been a
   "give me all of them" form of it. `ratingRes.ok` was false on every load, so
   the map stayed empty and every star on every card rendered blank until the
   viewer rated something in that same session. The state was there in the
   database and had no path to the screen.
2. **A failed favourite stayed favourited.** Both rollback branches in
   `toggleFavorite` operated on the bare `itemId` while the optimistic write
   used the composite `type:id` key. The rollback removed a member that was
   never in the set and left the optimistic one in place.
3. **A reply could not be deleted.** `/api/comments` DELETE existed, worked, and
   had exactly one caller — the club/review thread. The composer on every title
   page never offered it, so anything posted by mistake stayed posted.
4. **A failed reply said nothing.** `postReply` checked `res.ok` and discarded
   the body. `trg_limit_comment_rate` raises a message written for a person to
   read, and nobody read it: the text stayed in the box, nothing appeared, and
   the only explanation was in the network tab.

Also: the profile visibility form acknowledged a save with `alert()` — blocking,
styled like a browser error, in an app that has had a toaster mounted the whole
time.

### 10.7 Applied

`087_the_thread_updates_itself.sql` — `comments` and `reactions` added to the
`supabase_realtime` publication, both `REPLICA IDENTITY FULL`. Applied and
verified: the publication now carries `comments`, `messages`, `notifications`,
`reactions`, `user_follow_requests`. Discussion threads and like counts update
without a reload.

### 10.8 Still open

1. **The usage alerts from 7.1 and 9.8.1.** Three passes of engineering have now
   gone into making this bill smaller. None of it says when it starts growing
   again. It is still a dashboard setting.
2. **Writes are still on routes.** The status, favourite and rating chains touch
   three to five tables each and need to be Postgres functions before they move.
3. **The two providers still both exist.** `MediaInteractionProvider` and
   `UserPrefrenceProvider` now read the same rows through one function, so they
   can no longer disagree — but thirteen components still consume the older
   bucket shape, and merging them is its own change.
4. **The remaining read routes**: lists, clubs, messages, the follow lists,
   tonight, the watchlist index. Same shape as the fourteen above.

## 11. Fourth pass, 26 August 2026: cheapest total, not cheapest Vercel

§10 asked "why is a Vercel function involved at all?" and answered it well
enough to overshoot. Moving work off Vercel is not the goal; **spending less
overall** is, and the two come apart in three places:

- A **realtime channel** is a Supabase cost, metered by concurrent connection.
  §10 opened one per visitor per title page to watch comment threads that are
  almost always empty. That is a bill for watching nothing happen.
- A **shared, expensive answer** is cheaper computed once on Vercel and served
  from the CDN than computed per viewer in Postgres. `/api/search/catalog` and
  `/api/reviews/popular` are exactly this and stay where they are.
- A **request that is never made** beats both. Most of this pass is that.

### 11.1 The thing nobody had measured: prefetch

`<Link>` prefetches when it scrolls into view. This app renders links by the
hundred. Measured against a production build, one prefetch:

| route | payload | cacheable? |
|---|---|---|
| `/app/person/[id]` | **172 KB** | `s-maxage=86400` |
| `/app/tv/[id]` | 128 KB | `s-maxage=21600` |
| `/app/movie/[id]` | 112 KB | `s-maxage=86400` |
| `/app/profile/[id]` | 15.6 KB | **`no-store`** |
| `/app`, `/app/browse`, `/app/tonight`, `/app/search/[q]` | ~15.6 KB each | **`no-store`** |

The `no-store` rows are function invocations, one per link, per viewport. A home
feed of twenty rows carries about **forty profile links** — forty invocations to
render one screen nobody has clicked. §2c of this document notes that TV cast
pages emit ~400 links into `/app/person/[id]`; at 172 KB each, scrolling one
could pull megabytes of pages nobody opens. Edge Requests sat at 964K against a
1M limit in the August window, and this is the traffic that fills that meter.

`@components/ui/AppLink` is `next/link` with `prefetch={false}` as its default;
80 files now import it, and `tests/invariants/links-do-not-prefetch.test.ts`
keeps the default from drifting back. Prefetching still happens on the fourteen
files where it earns its keep — the header, the footer, the landing page's one
call to action, the auth and onboarding flows: small link counts, high intent.

Navigation is unaffected. The detail pages are ISR-cached, so a click still
lands on a CDN copy. What stops is fetching the 95% of cards nobody clicks.

### 11.2 The home page renders once an hour now, not once a visit

`/app` was `ƒ`. The reason was a single `auth.getUser()` in the page body, used
to choose between a greeting and a sign-up card — R2 again, on the page every
signed-in session starts at.

The branch was not the problem; where it was evaluated was. `AuthProvider`
already knows the answer, from the same cookie, without a request. So the page
prerenders both possibilities and the browser picks one (`AuthGate`). Confirmed
with the header rather than the build marker, as §5.3 insists:

```
before: cache-control: private, no-cache, no-store, max-age=0, must-revalidate
after:  cache-control: s-maxage=3600, stale-while-revalidate=31532400
        x-nextjs-cache: HIT
```

Both branches ship in the HTML — about a kilobyte on a 131 KB page, against a
full render per visitor. The children that cost something are client components
gated by the same check, so nothing fetches for the wrong audience.

Moving the greeting also fixed it. `new Date().getHours()` ran wherever the
function ran, so it wished someone in Sydney good evening over breakfast. A
greeting about the time of day is about the *reader's* time of day.

`/app/clubs/[slug]` went `ƒ` → `●` the same way: R2 (fourth occurrence) in its
`generateMetadata`, plus R3 — `revalidate` needs `generateStaticParams`
returning `[]` on a `[param]` route. The club metadata read is `createAnonClient`
now, which is *not* the service key: it carries the anon key and stays fully
subject to RLS, so the day `clubs` grows a visibility column the file inherits
it. The old comment treated "cookie client" and "service key" as the only two
options, and the third one is the one this codebase added in §9.2.

### 11.3 Nothing below the fold asks for anything

`useInView` gates a section's data on being scrolled to, one screen early.
Applied to the six heaviest deferred loads:

| section | what it was doing on every page view |
|---|---|
| The Room | nine queries, two of them aggregates over every rating on the title |
| The take composer and thread | two queries per title page |
| `FollowingFeed` | the heaviest route in the app — every followed account, four activity kinds, TMDB enrichment |
| `PeopleYouMayKnow` | taste comparison across accounts |
| `ContinueWatchingProgress` | a TMDB lookup per tracked show |
| `AiringSoon`, `PopularReviews` | a route each, in the sidebar |

All of them sit below the fold on pages most sessions do not scroll. This is the
cheapest kind of saving because it costs nothing: the fetch starts a screen
before the reader arrives.

One trap worth recording. `PopularReviews` renders `null` when it has nothing to
show, and "not fetched yet" looks identical to "nothing to show" — so returning
null before the first fetch removes the element the observer is watching, and
the section never loads at all. Every deferred component needs a placeholder
that carries the sentinel. *A section that silently never loads is a worse
outcome than never having deferred it.*

### 11.4 A thread earns its websocket

§10 subscribed on mount. Now a channel opens only when there is a conversation
to be live about: somebody has already written something, or the viewer just did
and is plausibly waiting for a reply. Otherwise the thread refreshes on scroll,
on post, and on focus — which SWR does for nothing.

The one channel per signed-in user for notifications and messages stays. That
one replaces a poll and is the shape realtime is for.

### 11.5 Images

Confirmed rather than changed: `next/image` stays unadopted for the reason in
§7.2 — Vercel meters Image Optimization separately and every TMDB poster would
become a billed transformation. Posters come from `image.tmdb.org` at `w185`,
which costs this project nothing on either bill.

What was missing was `loading="lazy"` on 60 of 88 `<img>` tags. 44 gained it,
plus `decoding="async"`. Deliberately skipped: heroes, banners and the title
poster, which are the LCP element and would be made worse by deferring; the
lightbox and image viewers, which are opened on purpose and already on screen;
and the two share cards, which are rasterised by `html2canvas` — that captures
whatever has loaded, so a lazy image there exports as a blank patch.

### 11.6 What stays on Vercel, and why

- **Anything holding the TMDB key.** Search, discovery, the feed, availability,
  the import, quick-add.
- **`/api/search/catalog` and `/api/reviews/popular`.** Identical for everybody
  and expensive to compute: one invocation per cache window serves every
  visitor, which beats one Postgres query per visitor. `/api/library/index` —
  the *other* half of the same search index — went the opposite way in §10, for
  the opposite reason: per-viewer, uncacheable, up to 5,000 rows.
- **Writes**, still. The status, favourite and rating chains touch three to five
  tables each and are ordered statements in one handler. Splitting them across
  client round trips would be worse; making them Postgres functions is right and
  is a migration with real correctness risk. At this traffic — bounded by human
  actions, not page views — it is not where the money is.
- **Cron, auth callbacks, and the two service-role routes.**

### 11.7 The rule

> Spend the resource where it is cheapest, and prefer not spending it at all.
> A per-viewer answer belongs in the browser, against RLS. A shared expensive
> answer belongs in a cached function. A websocket belongs where something is
> actually happening. And anything below the fold belongs nowhere until someone
> scrolls to it.

## 8. The honest summary

Three of the four contributing changes were made in the four days before the
outage, and none of them was wrong on its own terms. The sitemap, the complete
cast list and the richer pages are the product getting better.

What was missing was the question that connects them: **can the hosting serve
the traffic this will attract?** That question was never asked, and it had a
knowable answer.

The fixes are in. The alert in item 7.1 is what makes the next one boring.
