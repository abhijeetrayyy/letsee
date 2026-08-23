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

1. **Vercel usage alerts.** Not set. This is the cheapest item here and the one
   that would have turned an outage into an email.
2. **Middleware matcher.** A further ~50% invocation cut is available by making
   the matcher skip requests with no auth cookie, so middleware never runs at
   all. Not done because a matcher can only test an exact cookie name, and
   supabase-ssr chunks large tokens into `.0`/`.1` — a wrong guess silently
   stops refreshing exactly the sessions big enough to need it. **Needs a
   decision; the failure mode is silent logout.**
3. **Routes still uncached**, with their 12-hour invocation counts:
   `/app/browse` (2.8K), `/app/tv/[id]/season/[seasonNumber]` (439),
   `/app/review/[id]`. The season and review pages read viewer state on the
   server, so they cannot be shared between visitors without moving that
   client-side. Small compared to the 38K already fixed.
4. **13 dead but authenticated API routes** (`/api/recommendations/*`,
   `/api/watchlist-alerts`, `/api/batch`, `/api/account/email`, …). Unreferenced
   from any client code. Left alone because deleting a half-built feature is a
   roadmap call, not a cleanup.
5. **`/api/user-rating` discards the `itemName` it is sent.** The client posts
   the title on every rating and the route drops it. Not fixed because
   `user_activity` has no UPDATE policy, so the route cannot patch the row its
   own trigger just wrote.
6. **`next/image` is configured and unused.** `remotePatterns` allows
   `image.tmdb.org`; zero files import `next/image`. 88 `<img>` tags. Existing
   lazy-loading already does the important work, so this is optional.

---

## 8. The honest summary

Three of the four contributing changes were made in the four days before the
outage, and none of them was wrong on its own terms. The sitemap, the complete
cast list and the richer pages are the product getting better.

What was missing was the question that connects them: **can the hosting serve
the traffic this will attract?** That question was never asked, and it had a
knowable answer.

The fixes are in. The alert in item 7.1 is what makes the next one boring.
