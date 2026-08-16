# Surpassing Letterboxd — What Needs To Be Done

> **Status:** All seven workstreams built — see §15. **Audited in §16: 21 of 28 criteria hold, 7 do not.** Six migrations (056–062) are written but **not yet applied**.
> **Written:** 2026-08-16, against `main` @ `faeb123`. Decisions resolved and W1 built the same day.
> **Supersedes the benchmark table in** `COMPLETE_AUDIT_AND_ROADMAP.md` §2, which measures the wrong thing (see §1).

---

## Table of Contents

1. [The honest gap](#1-the-honest-gap)
2. [The bet](#2-the-bet)
3. [What already exists that this builds on](#3-what-already-exists-that-this-builds-on)
4. [W1 — Tonight: the group decision engine](#w1--tonight-the-group-decision-engine)
5. [W2 — Cut and focus](#w2--cut-and-focus)
6. [W3 — Letterboxd import](#w3--letterboxd-import)
7. [W4 — Year in Review, shareable](#w4--year-in-review-shareable)
8. [W5 — Rating scale](#w5--rating-scale)
9. [W6 — TV as a first-class citizen](#w6--tv-as-a-first-class-citizen)
10. [W7 — Give reviews an audience](#w7--give-reviews-an-audience)
11. [Sequencing](#11-sequencing)
12. [Non-goals](#12-non-goals)
13. [How we'll know it worked](#13-how-well-know-it-worked)
14. [Decisions — resolved](#14-decisions--resolved-2026-08-16)
15. [What shipped](#15-what-shipped-2026-08-16)
16. [**Audit — every criterion re-checked**](#16--audit--every-acceptance-criterion-re-checked-against-the-code-2026-08-16)

---

## 1. The honest gap

`COMPLETE_AUDIT_AND_ROADMAP.md` §2 compares LetSee to Letterboxd feature by feature and marks nearly every gap "Minor." That table is accurate and useless. The four things Letterboxd actually beats us on are not features:

| # | Their advantage | Why features don't close it |
|---|---|---|
| 1 | **A review is a publication** | Their review has an audience — likes, "Popular reviews" on the film page, followers earned by writing. Ours is a `watched_items.review_text` column nobody will ever read, so nobody will write one. We have `/api/comments` and `/api/reactions`; we lack a surface that *distributes* good writing. |
| 2 | **Scope discipline** | Films-only for a decade is why their ranked lists, stats, and 4-favourite grid are legible — everyone's numbers mean the same thing. We span movies + TV + episodes + reels + clubs + waves + achievements. Each dilutes the meaning of the others. |
| 3 | **A coarse rating scale** | 5 stars with half-steps is instant to log and everyone's 4★ means roughly the same thing. Our 1–10 makes people hesitate and makes cross-user comparison mush — which quietly weakens taste-matching and compatibility, our best original features. |
| 4 | **Distribution** | ~15M+ members, filmmakers with public accounts, press quoting their lists, and an SEO position where every film page ranks. **This is the real moat and it is not code.** It cannot be closed by building. |

**Conclusion:** competing on Letterboxd's axis means competing on culture and network, where we lose by ten years. Every feature added on that axis makes us a worse Letterboxd, not a better one.

---

## 2. The bet

**Letterboxd is a museum of what you already watched.** Retrospective, solitary, post-hoc. Nobody opens Letterboxd at 9pm on a couch trying to decide what to put on.

**LetSee should own the moment *before* watching, with another person in the room.**

Letterboxd structurally cannot follow us there — their atomic unit is one person logging one film after the fact. Ours can be *a group, tonight, on the services they actually pay for, in the time they actually have.*

The diary then becomes a **byproduct of the decision** instead of a chore. That flips the retention loop: we get opened every time someone watches something, not after.

Everything in this document is either (a) building that, or (b) removing what obscures it.

---

## 3. What already exists that this builds on

Verified in the codebase on 2026-08-16. This is why the plan is smaller than it looks.

| Capability | Where | Notes |
|---|---|---|
| Pairwise taste overlap | `src/app/api/compatibility/route.ts`, `src/utils/tasteMatch.ts` | Rarity-weighted (IDF²) shared-title overlap + `icebreaker` sentence. Migration `043`. |
| Taste matches | `src/app/api/taste-matches/route.ts` | Ranked people + evidence. Works from a single tracked title. |
| Streaming availability | `src/app/api/watch-providers/route.ts`, `/list` | Per-title, per-region, TMDB. |
| Provider catalogue | `/api/watch-providers/list?region=&mediaType=` | Needed for the "which services do you have" picker. |
| Unified lifecycle status | `user_media_status` (migration `029`) | `watchlist / watching / watched / on_hold / dropped`, PK `(user_id, item_id)`. Single source of truth. |
| Runtime per title | `user_media_status.runtime_minutes` (migration `053`) | Movie: total. TV: avg episode. Nullable. |
| Solo mood picker | `/api/what-to-watch`, `src/components/home/WhatToWatch.tsx` | Mood/genre/runtime/decade → TMDB discover + genre-vector scoring. **Tonight is the group-aware evolution of this, not net-new.** |
| Watchlist smart picks | `/api/watchlist/smart`, `src/components/home/QuickPick.tsx` | Predicted rating + reason string. |
| Social proof on a title | `/api/title-audience`, `/api/friends-watched` | "N people here have seen it" + faces. Migration `048`. |
| Groups | `clubs`, `club_members` (migration `049`) | Open/request join, roles. Reuses `comments` and `reactions`. |
| DMs | `/api/messages`, migration `044` | Text + shared movie/TV cards. |
| Notifications | migrations `027`, `036`, `041`, `044` | Typed, with a notification-type enum to extend. |
| Data export | `/api/account/export` ✅ | Already shipped. **Import is the missing half.** |
| Charting + image capture | `chart.js`, `react-chartjs-2`, `html2canvas` in `package.json` | Everything Year in Review needs is already installed. |

**The only genuinely new user data this plan requires** is *which streaming services each user has* (W1.1). Everything else is a recombination of what's above.

---

## W1 — Tonight: the group decision engine

**The whole bet. If only one workstream ships, it is this one.**

One screen that answers one question: *two (or five) people, tonight, on the services they have, in the time they have — what do we watch?* Not a carousel of candidates. **One answer**, with a reason, and a "no, next" button.

### W1.1 — Know what people can actually stream

Without this the engine recommends things nobody can watch, and it is worthless.

**Schema** — `migrations/056_user_providers.sql`

```sql
-- 056: which services a user actually has, and where.
-- Tonight's hard availability gate is meaningless without it.

begin;

create table if not exists public.user_providers (
  user_id     uuid   not null references public.users(id) on delete cascade,
  provider_id integer not null,             -- TMDB provider id
  provider_name text  not null,             -- denormalised: TMDB ids are stable, names are for display
  created_at  timestamptz not null default now(),
  primary key (user_id, provider_id)
);

create index if not exists user_providers_user_idx on public.user_providers (user_id);

alter table public.users
  add column if not exists watch_region text not null default 'US';  -- ISO 3166-1

alter table public.user_providers enable row level security;

create policy "user_providers_self" on public.user_providers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Group resolution needs to read other participants' providers. Same
-- SECURITY DEFINER escape hatch used by is_blocked() / profile_visible_to_viewer().
create policy "user_providers_select_profile_visible" on public.user_providers
  for select using (public.profile_visible_to_viewer(user_id));

commit;
```

**API**

```
GET    /api/user/providers            → { region, providers: [{id, name}] }
PUT    /api/user/providers            body: { region, providerIds: number[] }
```

**UI**
- New step in the onboarding flow (`/app/welcome`): "Which of these do you have?" — grid of provider logos from `/api/watch-providers/list?region=`, preselect the top 8 by `display_priority`. Skippable, but the Tonight screen prompts for it on first use.
- Editable from profile settings.

**Acceptance**
- [x] A signed-in user can set region + services in under 15 seconds.
- [ ] ⚠️ Tonight degrades gracefully when a participant has set none (treat as "any provider", flag it in the result copy). — **fallback built, flag NOT built. See §16.**

### W1.2 — The session

A Tonight session is a short-lived object: who's watching, the constraints, the candidates shown, and the verdict.

**Schema** — `migrations/057_watch_sessions.sql`

```sql
begin;

create table if not exists public.watch_sessions (
  id           bigserial primary key,
  created_by   uuid not null references public.users(id) on delete cascade,
  region       text not null default 'US',
  max_runtime  integer,                     -- minutes; null = no limit
  media_type   text not null default 'any' check (media_type in ('any','movie','tv')),
  moods        text[],                      -- keys from staticData/moodMapping
  allow_rewatch boolean not null default false,
  decided_item_id   text,
  decided_item_type text check (decided_item_type in ('movie','tv')),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.watch_session_participants (
  session_id bigint not null references public.watch_sessions(id) on delete cascade,
  user_id    uuid   not null references public.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- Per-candidate verdicts. Feeds "next" and, later, learning.
create table if not exists public.watch_session_votes (
  session_id bigint not null references public.watch_sessions(id) on delete cascade,
  user_id    uuid   not null references public.users(id) on delete cascade,
  item_id    text   not null,
  item_type  text   not null check (item_type in ('movie','tv')),
  vote       text   not null check (vote in ('in','out')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, item_id)
);

create index if not exists watch_session_participants_user_idx
  on public.watch_session_participants (user_id);

alter table public.watch_sessions enable row level security;
alter table public.watch_session_participants enable row level security;
alter table public.watch_session_votes enable row level security;

-- Membership check as SECURITY DEFINER — a policy on participants that queries
-- participants recurses (see 049_clubs.sql for the same pattern).
create or replace function public.is_session_participant(p_session bigint, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.watch_session_participants
     where session_id = p_session and user_id = p_user
  );
$$;

create policy "watch_sessions_participant_read" on public.watch_sessions
  for select using (public.is_session_participant(id, auth.uid()));
create policy "watch_sessions_owner_write" on public.watch_sessions
  for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

commit;
```

### W1.3 — The resolver

`src/utils/tonight.ts` — the one piece of real logic. Given participants + constraints, return ranked candidates each with a human reason.

**Candidate pool** (union, deduped):
1. Titles in *any* participant's `user_media_status` with `status = 'watchlist'` — highest prior, they already opted in.
2. TMDB discover, filtered by mood genres (`staticData/moodMapping`), `with_runtime.lte`, `with_watch_providers` = union of the group's providers, `watch_region`.
3. Titles with high `friends-watched` signal among participants' follow graphs.

**Hard filters** (a candidate is dropped, not penalised):
- Not available on a provider **at least one participant has** in `region` (see open decision Q2 — union vs intersection).
- `runtime > max_runtime`.
- Any participant has `status IN ('watched','dropped')`, unless `allow_rewatch`.
- Any participant has voted `out` on it in this session.
- Blocked/adult per existing rules (`is_blocked()`, `item_adult`).

**Score**

```
score = 0.35 * watchlistOverlap    // share of participants who watchlisted it
      + 0.30 * tasteFit            // see below — MIN across participants, not mean
      + 0.20 * quality             // vote_average shrunk by vote_count
      + 0.15 * socialProof         // title_audience within the follow graph, log-scaled
```

**`tasteFit` uses the minimum across participants, deliberately.** A movie night fails if *one* person hates the pick; a mean lets an enthusiast drag a veto-worthy title to the top. Minimum optimises for "nobody is unhappy," which is the actual goal of a group watch. Reuse the per-user genre vector from `src/utils/genreVector.ts`.

**The reason string** is the highest-contributing term, rendered as evidence, never as a score:
- `"You both watchlisted it"`
- `"On Prime for everyone · 106 min"`
- `"You both rated Sicario 8+"` (reuse the `icebreaker` builder in `src/utils/tasteMatch.ts`)
- `"4 people you follow watched it this month"`

Never show a percentage. `043_taste_matching.sql` already documents why blunt similarity percentages read as noise.

**API**

```
POST /api/tonight                 body: { participantIds[], region?, maxRuntime?, mediaType?, moods[]?, allowRewatch? }
                                  → { sessionId, pick: Candidate, alternates: Candidate[] }
GET  /api/tonight/[id]            → { session, pick, alternates, votes }
POST /api/tonight/[id]/vote       body: { itemId, itemType, vote: 'in'|'out' } → { pick: Candidate }   // next pick
POST /api/tonight/[id]/decide     body: { itemId, itemType }                    → { ok: true }

Candidate = {
  itemId, itemType, itemName, imageUrl, runtime,
  providers: [{ id, name, logoPath, heldBy: userId[] }],
  reason: string,
  score: number   // internal / debug only, never rendered
}
```

`decide` is what makes the loop close: it sets `status = 'watching'` in `user_media_status` **for every participant**, writes the activity rows (the `051_watched_activity_on_update.sql` path already exists), and stamps `decided_item_id`. The diary entry writes itself.

### W1.4 — The screen

`src/app/app/tonight/page.tsx` — new route, linked from the navbar as a primary action.

1. **Who's here** — chips: you + pick from following / a club / a DM thread. Default to the last group used.
2. **Constraints** — one row: runtime ("under 2h" / "under 90m" / "any"), mood chips (existing `MOODS`), movie vs TV.
3. **The answer** — one large poster, title, runtime, provider logos, and the reason sentence. Two buttons: **Watch this** and **Next**.
4. **After Watch this** — a confirmation that they're now marked *watching*, and a nudge to rate when done.

Design constraint: **no grid, no carousel, no "12 picks for you."** The value is that we decided. If we show twelve, we've built another discover page and lost the bet.

**Acceptance**
- [ ] ⚠️ Two users with overlapping watchlists get a pick in < 2s. — **unachievable as designed: ~4s floor. See §16.**
- [ ] ⚠️ Every pick is genuinely streamable by at least one participant in their region. — **superseded: episode picks bypass the gate. See §16.**
- [x] "Next" never repeats a title within a session.
- [ ] ⚠️ "Watch this" writes `watching` status for all participants and appears in their feeds. — **superseded by Q6: caller only. See §14.**
- [x] Works for a single user (group of one) — that's the fallback that replaces `WhatToWatch.tsx`.

---

## W2 — Cut and focus

**Restraint is the thing we're missing from Letterboxd, and it is free.** Every surface below competes for attention with the one thing we want to be known for. Cutting is not cleanup here — it is the strategy.

`src/app/app/page.tsx` currently mounts ~15 section components including 9 `CollectionRow`s. Target: **5 sections.**

| Surface | Verdict | Rationale |
|---|---|---|
| `Tonight` | **Add, top of page** | The product. |
| `ContinueWatchingProgress` | Keep | Highest-intent, genuinely useful. |
| `FollowingFeed` | Keep | The social loop. |
| `AiringSoon` | Keep | Only forward-looking surface besides Tonight. |
| `TrendingNow` | Keep — one row only | Cold-start discovery. |
| 9 × `CollectionRow` (genre carousels) | **Cut to 0** | Move to `/app/moviebygenre` + `GenreExplorer`, which already exist. They are browsing, not deciding. |
| `QuickPick`, `WhatToWatch` | **Fold into Tonight** | Solo special-case of the same engine. Delete the components once Tonight ships. |
| `CommunityLeaderboard` | **Cut** | Gamifies volume. Actively hostile to taste; nobody's identity is "watched the most." |
| `AchievementsShelf` + migration `033` | **Cut from UI**, leave tables | Same reason. Dilutes the profile, which should read as taste. |
| `WaveButton` / waves (migration `047`) | **Cut** | A poke. Never the reason anyone returns. |
| Reels (`src/components/reel`, `/api/movieReel`) | **Cut** | An entire second product living inside this one, on a content axis (short-form video) we cannot win. |
| `ClubPickWidget` | Keep, but move to `/app/clubs` | Good feature, wrong altitude for home. |
| `PeopleYouMayKnow` / `DiscoverUsers` | Merge into **one** taste-match row | Two components doing one job. `taste-matches` has the better evidence. |

**Do the cuts behind a single PR per surface**, deleting components *and* their API routes *and* their unused migrations' UI paths. Leave the tables (dropping them is a separate, later decision).

**Acceptance**
- [x] Home page renders ≤ 5 sections and ≤ 6 network requests. — measured: 3–4 sections, 2 requests.
- [x] No dead components left importing deleted routes; `npm run build:check` clean.

---

## W3 — Letterboxd import

**The single highest-leverage acquisition feature available, and roughly two days of work.** Export already exists (`/api/account/export`) — that removes the reason not to try us. Import removes the switching cost. Both together are the whole "your data is yours" story.

Letterboxd's export is a ZIP of CSVs. The ones that matter:

| File | Columns | Maps to |
|---|---|---|
| `watched.csv` | `Date, Name, Year, Letterboxd URI` | `user_media_status.status = 'watched'` |
| `ratings.csv` | `Date, Name, Year, Letterboxd URI, Rating` (0.5–5.0) | `user_ratings.score` — ×2 → 1–10 |
| `watchlist.csv` | `Date, Name, Year, Letterboxd URI` | `user_media_status.status = 'watchlist'` |
| `reviews.csv` | `..., Review, Rewatch, Tags` | `watched_items.review_text` |
| `likes/films.csv` | `Date, Name, Year, Letterboxd URI` | `favorite_items` |

**The hard part is title resolution**, not parsing. `Name + Year` → TMDB id. We already have `fuse.js` and `fastest-levenshtein` installed and a fuzzy search path in `/api/search`.

Resolution strategy, in order:
1. TMDB `search/movie?query=&year=` — accept on exact normalised title + year match.
2. Levenshtein ≤ 2 on normalised title with matching year → accept.
3. Otherwise → **unresolved**, surfaced to the user for manual matching. Never guess silently.

**Run it as a background job.** Migration `024_background_jobs.sql` already gives us the table. A 2,000-film history is 2,000 TMDB lookups; it cannot happen in a request.

```
POST /api/account/import        multipart: file (zip or csv), source: 'letterboxd'
                                → { jobId }
GET  /api/account/import/[jobId] → { status, processed, total, resolved, unresolved: [{name, year, row}] }
POST /api/account/import/[jobId]/resolve  body: { row, tmdbId, mediaType }
```

**Acceptance**
- [x] A real Letterboxd export ZIP imports watched + ratings + watchlist + reviews.
- [ ] ⚠️ ≥ 95% auto-resolution on a 500-film sample. — **never run. See §16.**
- [x] Unresolved titles are listed with a one-tap manual match.
- [x] Import is idempotent — running it twice doesn't duplicate or downgrade existing status. *(One exception: `watched_at` is overwritten by the export's date.)*
- [x] Ratings convert 0.5–5.0 → 1–10 correctly (and correctly again if W5 lands).

---

## W4 — Year in Review, shareable

**Our only free distribution channel.** People voluntarily post Letterboxd's year wrap every December; that is millions of impressions Letterboxd does not pay for. Everything needed is already installed: `chart.js`, `react-chartjs-2`, `html2canvas`.

**Build:** `/app/profile/[id]/year/[year]` — a single, poster-shaped, screenshot-optimised page.

Content, in priority order:
1. Films + episodes watched, and the **one number that's honest** — note that `054_remove_hours.sql` deliberately removed hours; do **not** reintroduce a fabricated figure. Use counts and real `runtime_minutes` only where known.
2. Top 4 by rating, as the poster grid.
3. Genre breakdown (existing `statisticsGenre.tsx` logic).
4. Longest streak / busiest month.
5. **One line no other app can produce:** "You and @x watched 14 of the same films this year" — from `tasteMatch.ts`. That's the share hook, because it names another person.
6. A "Download image" button via `html2canvas`, sized 1080×1920 for stories.

**Acceptance**
- [x] Renders for any year with data, degrades honestly when sparse.
- [x] Image export is legible at story size, has the LetSee wordmark, and links back. — measured 1080×1920.
- [x] Public even when the profile is followers-only (the user opts in per-year).

---

## W5 — Rating scale

**Decision needed before W3 import lands**, since import writes ratings.

Move `1–10` → **5 stars, half-steps** (stored as `smallint` 1–10 internally, rendered as 0.5–5.0). Storage doesn't change; only input and display do.

**Why:** faster to log, and everyone's 4★ means roughly the same thing — which directly strengthens `agree(t) = 1 - |r_a - r_b| / 9` in `043_taste_matching.sql`, our best original feature. A 1–10 slider produces hesitation and incomparable numbers.

**Touches:** `src/components/.../UserRating`, `/api/user-rating`, `/api/episode-rating`, `rating-distribution`, profile stat rendering, and the `053` cached stats path (no schema change).

**Risk:** users who deliberately used the granularity of 1–10 will notice. Mitigate by keeping stored values and rounding display only — existing 7s render as 3.5★.

**Acceptance**
- [x] Rating a title is one tap, not a slider drag.
- [x] No stored value changes; `rating-distribution` still reads correctly.

---

## W6 — TV as a first-class citizen

Letterboxd structurally punts on TV. Trakt owns TV but has no taste culture. **"Great TV tracking + real social taste" is genuinely unoccupied**, and we're most of the way there already (`watched_episodes`, `/api/continue-watching`, `/api/upcoming-episodes`, `/api/tv-progress`, migrations `012`, `023`, `031`).

What's missing to actually own it:

- [ ] **TV in Tonight** — "we have 45 minutes" should return the next unwatched episode of a show both participants are mid-way through. This is a case Letterboxd can never serve and is arguably the strongest single feature in this document.
- [ ] **Season-level reviews** — a review anchored to a season, not just a series or an episode. Nobody does this well.
- [ ] **"Caught up" as an identity state** on the profile, not just a flag in `/api/continue-watching`.
- [ ] **New-episode notifications** for shows in `status = 'watching'` — the notification infra (migration `027`) and `/api/upcoming-episodes` both exist; the job doesn't.

---

## W7 — Give reviews an audience

Addresses gap #1 from §1. **Cheap, and it changes whether anyone writes at all.**

- [ ] **"Reviews" section on every title page**, ranked by reactions, not recency. `/api/reviews` and `/api/reactions` already exist — this is a surface, not a system.
- [ ] **Review permalinks** — `/app/review/[id]` exists; make it shareable, OG-tagged, and readable signed-out.
- [ ] **A review notification** when someone reacts or comments (migration `046` already wired the comment case).
- [ ] **Popular reviews this week** — one row on home, replacing one of the cut carousels.

Deliberately **not** doing: rich text editor, spoiler tags, review drafts. Those are polish on a loop that doesn't exist yet. Build the loop first.

---

## 11. Sequencing

Ordered by *what unblocks what*, not by size.

**Phase 1 — Prove the bet (the only phase that matters)**
1. W1.1 user providers + region
2. W1.2 session schema
3. W1.3 resolver
4. W1.4 the screen, solo-user path first, then groups
5. W2 cuts — ship alongside, so Tonight lands on a clean home page

**Phase 2 — Make it worth switching to**
6. W5 rating scale (before import)
7. W3 Letterboxd import
8. W6 TV in Tonight

**Phase 3 — Make it spread**
9. W4 Year in Review
10. W7 reviews get an audience
11. W6 remainder (season reviews, episode notifications)

**Explicitly deferred:** native apps, PWA polish, box office data, critic aggregation, news feed. All are listed in the older roadmap docs; none of them change the outcome of the bet.

---

## 12. Non-goals

Written down so they stop coming back:

- **Matching Letterboxd feature-for-feature.** Parity on their axis is a losing game (§1).
- **Growing the home page.** Every new section is a tax on the one that matters.
- **Volume gamification.** Leaderboards and achievement counts reward watching a lot, not watching well. Wrong identity.
- **Short-form video.** Reels is a second product on an axis we cannot win.
- **A percentage on anything taste-related.** `043_taste_matching.sql` already argues this; hold the line in the UI too.
- **Auto-scrobbling.** Requires integrations we don't have and doesn't serve the decision moment.

---

## 13. How we'll know it worked

| Signal | Why it's the right one | Target |
|---|---|---|
| **Sessions with ≥ 2 participants / week** | Directly measures the bet | The only number that matters in Phase 1 |
| **Decide rate** (sessions ending in "Watch this") | Whether the engine actually decides or just browses | > 50% |
| **Picks per decision** ("Next" presses before deciding) | Quality of the first answer | < 3 |
| **Watched-logs originating from a session** | Whether the diary really is a byproduct | > 30% of all logs |
| **Imports completed** | Switching cost removed | — |
| **Year in Review images downloaded** | Distribution working | — |

Deliberately **not** tracked: total titles logged, DAU, time in app. Those go up when we add carousels, which is the failure mode this plan exists to avoid.

---

## 14. Decisions — resolved 2026-08-16

All five open questions were called and W1 was built against them. See §15 for what shipped.

| # | Question | **Decision** | Reasoning |
|---|---|---|---|
| Q1 | Cuts before or after Tonight? | **Tonight first, then cuts — both now done** | Building Tonight is additive and safe; deleting Reels, achievements and the leaderboard needed explicit sign-off rather than a unilateral call. Sign-off given the same day; W2 shipped immediately after W1. |
| Q2 | Provider gate: union or intersection? | **Union, with attribution** | Intersection empties the candidate pool as soon as two people have different subscriptions, which is the normal case. The reason string names whose account it's on ("On Priya's Netflix"), which turns the looser gate into useful information rather than a hidden assumption. |
| Q3 | Signed-out access? | **No — 401** | A signed-out visitor has no watchlist, no services and no follow graph, so every term in the score collapses to TMDB popularity. That's a worse version of the trending row they already have. |
| Q4 | Drop the cut tables? | **Leave dormant** | Dropping is irreversible and buys nothing while the UI decision itself is unmade. Revisit one release after W2 lands. |
| Q5 | Rating-scale change: user-facing note? | **Yes, one dismissible line** | Stored values don't change, but a silent scale change reads as data loss even when nothing was lost. Applies when W5 is built. |

**One decision not on the original list, made during the build:**

**Q6 — Does "We're watching this" write status for every participant?** → **No. Caller only.**
The other participants are added to a room by whoever opened it; they never accept anything. Writing to their library on a friend's button press is mutating someone else's data without consent, and it would need the service-role client to bypass RLS to do it. The verdict is recorded on the session (`watch_sessions.decided_item_id`) so each participant's own client can offer to log it. **Group-apply needs a consent step first** — either an invite/accept on the session, or a notification with a one-tap "add it" — and is the top follow-up for W1.

---

## 15. What shipped (2026-08-16)

W1 is built and typechecks; `npm run build:check` is clean and `/app/tonight` is a registered route.

**⚠️ Not yet live: migrations 056 and 057 have not been applied.** They're written but need running against Supabase (SQL Editor, in numeric order) before Tonight works end to end. Until then the page renders and the auth gates behave, but opening a session will fail on the missing tables.

| Piece | File |
|---|---|
| Providers + region schema | `migrations/056_user_providers.sql` |
| Session schema | `migrations/057_watch_sessions.sql` |
| Providers API | `src/app/api/user/providers/route.ts` |
| Invitable people | `src/app/api/tonight/people/route.ts` |
| Resolver | `src/utils/tonight.ts` |
| Session loader | `src/utils/tonightSession.ts` |
| Open a session | `src/app/api/tonight/route.ts` |
| Re-resolve | `src/app/api/tonight/[id]/route.ts` |
| Vote / Next | `src/app/api/tonight/[id]/vote/route.ts` |
| Decide | `src/app/api/tonight/[id]/decide/route.ts` |
| Service picker | `src/components/tonight/ServicePicker.tsx` |
| The room | `src/components/tonight/TonightRoom.tsx` |
| Page | `src/app/app/tonight/page.tsx` |
| Entry points | `src/components/header/navbar.tsx`, `BurgerMenu.tsx` |

**Verified:** production build passes and registers the route; the signed-out page renders correctly; `/api/tonight`, `/api/tonight/people` and `/api/user/providers` all return 401 unauthenticated; `/api/watch-providers/list` returns a real catalogue for the picker.

**Not verified:** the signed-in path, which needs both the migrations applied and an account to sign into.

### W2 — the cuts, as executed

**26 files changed, 108 insertions, 1,922 deletions. 14 files deleted.**

| Cut | What went |
|---|---|
| **Reels** | `src/components/reel/`, `src/app/app/reel/`, `src/app/api/movieReel/`, plus links in navbar, BurgerMenu, QuickActions and the landing footer. `/app/reel` now 404s. |
| **9 × CollectionRow** | The component and all nine mounts — weekly top, anime series, anime films, five genre collections, Bollywood. |
| **CommunityLeaderboard** | Deleted. Gamified volume, which is the wrong identity for a taste product. |
| **AchievementsShelf** | Component, `/api/profile/achievements`, and the profile mount. |
| **Waves** | `WaveButton`, `/api/wave`, the welcome-page mount. |
| **QuickPick + WhatToWatch** | Both components and `/api/what-to-watch`, superseded by `/api/tonight`. |
| **DiscoverUser** | 318 lines of counter-based user cards, redundant with `/app/profile`, which does people-browsing properly. `PeopleYouMayKnow` survives as the single taste row because it leads with shared-title evidence. |
| **ClubPickWidget** | Moved, not cut — now on `/app/clubs`, where it's context rather than competition. |

**Two things beyond a literal reading of the W2 table, both deliberate:**

1. **The dead achievement write paths went too.** Five call sites (`user-media-status`, `watched-review`, `user-lists`, `quick-add/bulk`, `followerAction`) fired `check_achievements` — several `COUNT(*)` scans per write — for data nothing rendered any more. `user-media-status/route.ts` even carried the comment *"don't let achievement checks (several COUNT(\*) scans) slow this response down"*. Leaving them would have kept paying that cost for an invisible feature. Tables and RPCs are untouched per Q4, so reviving means restoring five call sites.
2. **`getHomeContent` went from 13 TMDB calls to 4.** Nine of them existed only to fill the deleted carousels. Kept: two trending calls for the hero and the trending row, two genre-list calls for GenreExplorer.

**Kept deliberately:** `/api/watchlist/smart` is now orphaned (its only consumer was QuickPick), but it's small and directly reusable as a better prior for Tonight's watchlist pool. Retire it only if that doesn't happen.

**Left intact:** the `wave` and `achievement_unlocked` cases in the notifications page, so rows already in the table keep reading correctly instead of degrading to "New notification from X". Nothing creates them any more.

**Verified after the cuts:** clean production build; `/app` 200, `/app/tonight` 200, `/app/clubs` 200, `/app/profile` 200, `/app/reel` 404; home renders 3 main sections signed-out (4 signed-in, with the Tonight banner) against a target of 5; **2 client API calls on home**, against a target of ≤6; zero console errors on a fresh load; no horizontal overflow; grep sweep clean for all twelve removed symbols.

*Not visually confirmed: the ClubPickWidget body on `/app/clubs` — `/api/club-pick/current` returns `{"pick": null}` on this database, so it correctly renders nothing. The mount itself resolves, or the build would have failed.*

### W3 — Letterboxd import, as built

**`/app/import`.** Drop the export ZIP (or a single CSV), watch a real progress bar, then clear a short list of films we wouldn't guess at.

| Piece | File |
|---|---|
| Schema | `migrations/058_letterboxd_import.sql` |
| Parser (ZIP + RFC4180 CSV + merge) | `src/utils/letterboxd.ts` |
| Title resolver | `src/utils/titleResolver.ts` |
| Library writes | `src/utils/importApply.ts` |
| Upload / list | `src/app/api/account/import/route.ts` |
| Progress + unresolved | `src/app/api/account/import/[id]/route.ts` |
| Chunked processing | `src/app/api/account/import/[id]/process/route.ts` |
| Manual match / skip | `src/app/api/account/import/[id]/resolve/route.ts` |
| UI | `src/components/import/ImportFlow.tsx`, `src/app/app/import/page.tsx` |

**Three decisions that departed from the W3 plan:**

1. **Not run on `background_jobs`.** The plan said migration 024 "already gives us the table." The table exists; the machinery doesn't. Nothing calls `registerJobHandler`, so `dispatchJob` always fails with *"No handler registered"*, and `vercel.json` declares no crons, so the runner is never invoked. Even repaired, cron granularity means an import that starts *later* — the wrong shape for a new user with an empty profile deciding whether to stay. Instead the browser uploads once and then drives `/process` a chunk at a time, with a progress bar fed by real completions. Each call is independent, so a closed tab costs at most one chunk and reopening resumes.

2. **One row per film, not per CSV line.** `watched.csv`, `ratings.csv`, `reviews.csv` and `likes/films.csv` all name the same films. Deduping on `(title, year)` at insert time makes a film cost **one** TMDB lookup instead of four — the difference between a 500-film import being pleasant and being a rate-limit problem.

3. **Reviews import as private diary notes, not public reviews.** They were public *on Letterboxd*. That isn't consent to republish them here under a different profile's visibility rules. Same reasoning as the caller-only status write in W1.

**The governing rule for writes is "add, never take away".** Someone importing five years of history has usually been using this app already, and the worst outcome is a migration that silently overwrites a rating they set here last week. So: `watched` wins outright; `watchlist` only fills an empty slot, never demoting a watched film; ratings, reviews and favourites are insert-if-absent. Running the same import twice is a no-op the second time, which is what makes retrying a half-finished import safe.

**The resolver is deliberately conservative**, because the costs are asymmetric — a missed match is one tap to fix, a *wrong* match is a film in someone's history they never saw and may never notice. Exact normalised match on localised or original title with the year agreeing (±1, since Letterboxd tends to use the festival date and TMDB the primary release); then Levenshtein, with tolerance scaled down for short titles so "Up" can't become "Us"; then a sole result with an exact year. No closest-guess fallback.

**Measured, not estimated:**

- On 16 real titles as Letterboxd writes them (including `Amélie`, `Good, Bad and Ugly, The`, `WALL·E`, `Se7en`, `Up`): **14 resolved, 2 refused** — and both refusals are correct. One was a film that doesn't exist; the other was `Dune` with no year, which is genuinely ambiguous across five real Dune films and correctly returned suggestions instead of guessing. That's **100% of the resolvable titles**.
- The W3 target was ≥95% on a 500-film sample. **That specific test has not been run** — 16 hand-picked titles is not a 500-film sample, and the real number will be lower once obscure and non-English titles are in the mix.
- Parser verified against a synthetic export built to be nasty: UTF-8 BOM, CRLF, a quoted title containing commas, a review with embedded blank lines, `__MACOSX` junk, and a nested `likes/films.csv`. All five files detected, merge correct, `4.5★ → 9` conversion correct, and a film appearing only in `ratings.csv` correctly inferred as watched.

**Verified:** clean production build and typecheck; all four API routes 401 unauthenticated; `/app/import` renders. **Not verified: the signed-in path** — it needs migration 058 applied and an account.

**New dependency:** `fflate` (8KB, zero-dep) for ZIP extraction. The CSV parser is hand-written rather than a second dependency, because the one hard part is small and well-defined: a review field legitimately contains commas, quotes *and newlines*, so splitting on lines before commas silently corrupts every multi-paragraph review.

### W4 — Year in Review, as built

**`/app/profile/[id]/year/[year]`.** A fixed 540×960 card that exports at exactly **1080×1920** — story size, no resampling.

| Piece | File |
|---|---|
| Sharing opt-in schema | `migrations/059_year_in_review.sql` |
| Year-scoped data | `src/utils/yearInReview.ts` |
| The card | `src/components/profile/YearInReviewCard.tsx` |
| Page + access gate | `src/app/app/profile/[id]/year/[year]/page.tsx` |
| Publish toggle | `src/app/api/year-review/route.ts` |
| Entry point | Stats section of `src/app/app/profile/[id]/page.tsx` |

**No hours, and no substitute for hours.** §W4 originally said to use "real `runtime_minutes` where known" — but `054_remove_hours.sql` dropped every runtime column in the schema, arguing that *a total nobody can verify is worse than no total*. A year-in-review card is exactly where the pull toward one big impressive fabricated number is strongest, so the card shows counts of rows the user actually created and nothing else. Films and shows also stay separate rather than being summed into "titles", which would make a series equal to a feature.

**Per-year publishing, not profile-wide.** A followers-only profile is followers-only for a reason, and "make your whole account public to share one card" is not an acceptable price. `year_reviews` holds one flag per (user, year); the page reads through the admin client **only after** checking it. That bypass is the narrowest possible: it exists because the flag is the user's own explicit choice, checked before a single row is read.

**The share hook is the line that names someone else** — *"You and @jojo both watched 14 films this year, including Sicario"* — because that makes posting it a message to a person rather than a statistic about yourself. Restricted to people the user follows: overlap with a stranger is trivia.

**A real bug caught by verifying the export**, which is the reason this feature needed more than a build check:

> `html2canvas` 1.4 throws `Attempting to parse an unsupported color function "oklab"`, and **Tailwind v4 compiles every `/opacity` modifier and every gradient to `oklab(…)`**. A single `bg-white/5` anywhere inside a capture target makes the export fail outright.

The card's own gradient now uses inline `rgba()`. **The pre-existing `ShareProfileCard` had the same bug** — five `/opacity` classes inside its capture target, meaning its "Save as image" button has never worked. Fixed the same way. Both were confirmed by measuring the produced canvas, not by eye:

| Card | Before | After |
|---|---|---|
| `YearInReviewCard` | threw on `oklab` | **OK 1080×1920** |
| `ShareProfileCard` | threw on `oklab` | **OK 1600×1460** |

**Verified:** clean production build and typecheck; both exports measured to produce real canvases at the right sizes; zero `oklab`/`color-mix` values left anywhere in either capture subtree; the card renders correctly with sample data (screenshotted via a temporary harness, since removed); the access gate shows "Not shared" to a non-owner and degrades correctly even with migration 059 unapplied; out-of-range years and unknown usernames 404.

**Not verified: the owner's live path** — real year data needs migration 059 applied and an account.

### W6 — TV as a first-class citizen, as built

All four items from §W6.

| Piece | File |
|---|---|
| Next-episode picker | `src/utils/tonightEpisodes.ts` |
| Episode scoring + merge | `src/utils/tonight.ts` |
| Logging the episode on decide | `src/app/api/tonight/[id]/decide/route.ts` |
| Season reviews schema | `migrations/060_season_reviews.sql` |
| Season reviews API + UI | `src/app/api/season-review/route.ts`, `src/components/tv/SeasonReview.tsx` |
| Caught-up derivation | `src/app/api/profile/tv-progress/route.ts` |
| Caught-up UI | `src/components/profile/TvShowCard.tsx` |
| New-episode job + schedule | `migrations/061_new_episode_notification.sql`, `src/utils/jobs/newEpisodeNotifier.ts`, `src/app/api/cron/new-episodes/route.ts`, `vercel.json` |

**1. TV in Tonight.** The flagship, and the case Letterboxd structurally cannot serve.

> **The rule that matters:** when two people are at different points in a show, the group's next episode is the one the person *furthest behind* hasn't seen. Watching A's next episode when B is two behind doesn't just skip B's episodes — it **spoils** them. So the episode is chosen by minimum progress across the room, the same "protect whoever is worst served" principle as taste fit.

Someone in the room who hasn't started the show at all is ignored rather than dragging everyone back to the pilot. Episodes are scored on the same 0–1 scale as films and compete for the single answer slot — a show two people are deep into lands ~0.8, which beats almost any film, and that's intended.

This needs a real season fetch. `/api/continue-watching` computes its next episode from season *summaries*, so it cannot tell an aired episode from an unaired one or know a runtime — and both matter when the whole question is "we've got 45 minutes".

**Availability is not enforced for episode picks.** Someone eight episodes into a series has demonstrated they can watch it more convincingly than a provider list can, since TMDB misses owned copies and regional deals. Providers are shown when known; they don't gate.

**2. Season reviews.** The season is the unit people actually argue about — *"season 4 is where it turns"* — and it had no home: series reviews are too coarse for a long-running show, episode notes too fine. Keeps the diary/public split from 009 and defaults to private.

> One trap worth naming: 060's public-read policy exposes the whole row, `review_text` included, to a permitted viewer. The API therefore never selects `review_text` for anyone but the author — the same trap the profile page already comments on for `watched_items`.

**3. Caught up is its own state.** `all_complete` asks whether every episode TMDB lists is watched, but season summaries include unaired episodes, so a show you're perfectly current on can *never* satisfy it. `last_episode_to_air` is the real waterline and arrives on the show detail already being fetched, so this costs nothing extra. An ongoing show you're current on now reads "Caught up · Next airs 4 Sep" instead of looking identical to one you abandoned.

**4. New-episode notifications** — the only notification here that isn't about what another user did to you. `notified_episodes` is the job's memory; without it every daily run re-announces everything and the feature becomes the reason people turn notifications off.

> This required confronting the dead queue rather than using it. It follows `checkWatchlistAvailability`'s pattern — a plain function a cron route calls directly — and **adds the first real `crons` entry `vercel.json` has ever had.**

**Verified:** clean build and typecheck; season-review GET/PUT/validation behave (200 signed-out, 400 on missing params, 401 on write); the season page renders the review block; `/api/cron/new-episodes` ran end-to-end against live data and returned `{showsChecked: 1, notificationsSent: 0}` — correctly zero, since no watched show had an episode in the last 8 days.

**Not verified:** the group episode pick with two real mid-show participants (needs 056/057 applied and two accounts); the notification insert path, which returned before reaching `notified_episodes` because nothing qualified; and the `caught_up` badge against a real ongoing show.

### W5 — Rating scale, as built

**1–10 → five stars with half steps. Nothing was migrated.**

| Piece | File |
|---|---|
| Conversion + formatting | `src/utils/ratingScale.ts` |
| The control | `src/components/ui/StarRating.tsx` |
| One-time notice | `src/components/ui/RatingScaleNotice.tsx` |
| Inputs | `src/components/movie/UserRating.tsx`, `src/components/tv/EpisodeRating.tsx`, `src/components/tv/SeasonReview.tsx` |
| Displays | `ActivityFeed`, `WatchedGrid`, `ActivityCard`, `ReviewsSection`, `RatingDistribution` |

**No schema change, and none needed.** Scores stay `smallint` 1–10 everywhere; doubling is exact in both directions, so a stored 7 was "7/10" and is now 3½ stars — the same judgement written two ways. The API contract, the Letterboxd import, `rating_distribution` and the cached stats path are all untouched. A pleasant consequence: Letterboxd's own 0.5–5 scale now round-trips as an identity (4.5★ → stored 9 → 4½★).

**Why bother.** A 1–10 grid asks a question people can't answer — the difference between a 6 and a 7 isn't a distinction anyone holds consistently, so the choice takes longer *and* means less. Worse, it means something different per person, which corrodes the best original feature here: taste matching scores agreement as `1 - |r_a - r_b| / 9` (043), and that term is only meaningful if two people's numbers are commensurate.

**Two details worth keeping:**

- **Input is ten buttons, not a slider** — two invisible halves per star. Costs nothing visually and makes the control keyboard-navigable and screen-reader-legible for free, each option announcing the rating it sets ("4½ out of 5 for Sicario").
- **TMDB vote averages were left on the 10 scale.** `MediaCard` and `TopResult` show TMDB's number, not ours; restating someone else's scale in our units would be a quiet misattribution. Only the community-ratings average (which *is* our data) was halved — and halved rather than re-rounded, since a mean legitimately has precision no single rating does.

**Verified by measurement, not eye:** all ten stored values round-trip through `scoreToStars`/`starsToScore` unchanged; the control renders correct half-fills at every value; clicking the "4½" target sets stored **9**; ten buttons with correct ARIA labels; clean build and typecheck.

> The build caught what typecheck couldn't: an automated import insertion put `import` above `"use client"` in four files, which TypeScript accepts and Next rejects. Worth remembering that `tsc --noEmit` is not a substitute for `next build` on this codebase.

**Not verified:** rating something end-to-end as a signed-in user, and how the notice reads to someone with a long pre-existing history.

### W7 — Reviews get an audience, as built

Closes gap #1 from §1 — the one the whole document opens with.

| Piece | File |
|---|---|
| Like notification + ranking RPCs | `migrations/062_reviews_get_an_audience.sql` |
| Popularity ranking | `src/app/api/reviews/route.ts` |
| Cross-title discovery | `src/app/api/reviews/popular/route.ts` |
| Home row | `src/components/home/PopularReviews.tsx` |
| Permalinks + Reply on title pages | `src/components/movie/PublicReviews.tsx` |
| OG metadata | `src/app/app/review/[id]/page.tsx` |
| Like notification text + link | `src/app/app/notification/page.tsx` |

**The finding that shaped this: liking a review notified nobody.** The `like` notification type has been in the enum since 027 with *nothing anywhere creating it* — `reactions` (026) has no trigger and the toggle route sends nothing. So you could write something, someone could like it, and you would never find out. That isn't a missing feature, it's the loop being severed at its one critical point, and it explains the empty review column better than any UI shortcoming.

**Reviews now rank by reactions, not recency.** Sorting by recency puts the newest review above the best one, which guarantees good writing sinks — and a review that sinks is a review nobody had a reason to write. `sort=recent` remains for anywhere that genuinely wants a timeline. Popularity needs an aggregate over `reactions`, which PostgREST can't order by, hence the `reviews_for_title` RPC.

**Two deliberate scoping calls:**

- **`popular_reviews` is public-profiles-only**, not `profile_visible_to_viewer`. This is a shared discovery surface shown to strangers and signed-out visitors; a row that appears for some viewers and not others is the wrong shape for "popular this week", and it would leak followers-only writing into a public list. The consequence is a genuinely shared-cacheable response — `/api/reviews` can't be, since it embeds whether *this* viewer reacted.
- **OG metadata re-checks visibility itself.** `generateMetadata` runs before the component's gate and is served to crawlers with no session, so it only ever describes a review a stranger may read; anything else falls back to a title revealing nothing.

**Still deliberately not doing:** rich text editor, spoiler tags, review drafts. Those are polish on a loop that, until this migration runs, still doesn't exist.

**Verified:** clean build and typecheck; `/api/reviews/popular` returns `{reviews: []}` and `/api/reviews` falls back to the recency query with 062 unapplied — the whole feature degrades to today's behaviour rather than breaking; the home row correctly renders *nothing* rather than an empty heading; metadata for a nonexistent review falls back to `Review · LetSee`; home renders with no overflow and every app request 200.

**Not verified:** the like→notification trigger, the popularity ordering, and a shared review's OG preview — all need 062 applied and real reviews with real reactions.

### Follow-ups this build opened

1. **Group-apply with consent** (Q6 above) — the biggest gap between what shipped and what §W1 described.
2. ~~`/api/what-to-watch` has a latent bug~~ — **resolved by deletion in W2.** For the record: its `buildGenreVector` compared stored genre *names* against `String(genre_id)`, so `"28"` never matched `"Action"`, the "Matches your taste" reason never fired, and every pick fell through to popularity. `src/utils/tonight.ts` maps ids → names via `GenreList` and does not inherit it.
3. **Runtime for TV** is average episode runtime, so "under 90 min" on a TV pick means one episode. That's the right reading for a weeknight, but it isn't stated in the UI.
4. **No rate limit on session creation.** Each resolve costs up to 4 discover calls plus 14 detail calls; TMDB throttling absorbs it, but a loop would be expensive.
5. **Run the real 500-film resolution test.** The W3 acceptance criterion (>=95%) is unverified; 16 hand-picked titles is not a sample. Needs a genuine large export.
6. **`background_jobs` (024) is dead infrastructure.** No registered handlers, no cron entries in `vercel.json`. Anything scheduled onto it silently never runs. Wire both ends up or drop the table.
7. **Audit every other html2canvas target for `oklab`.** The Tailwind-v4-vs-html2canvas incompatibility is a whole class of bug, not two instances. Anything added to a capture target later will break it silently — worth a lint rule or a shared `<ExportableCard>` wrapper that forbids opacity utilities.
8. **`/api/cron/check-availability` still has no schedule.** Written, working, never fires. Schedule it or delete it.
9. **`CRON_SECRET` must be set in production.** All three cron routes skip their guard when it's unset — an open endpoint otherwise.
10. **The home page has no signed-out Tonight affordance.** The banner is gated on `isLoggedIn`, so a visitor never learns the product's main idea exists. Cheapest fix is a signed-out variant that links to `/app/tonight`, which already explains itself and offers sign-in.

---

## Appendix — files this plan touches

**New**
```
migrations/056_user_providers.sql
migrations/057_watch_sessions.sql
src/utils/tonight.ts
src/app/api/tonight/route.ts
src/app/api/tonight/[id]/route.ts
src/app/api/tonight/[id]/vote/route.ts
src/app/api/tonight/[id]/decide/route.ts
src/app/api/user/providers/route.ts
src/app/api/account/import/route.ts
src/app/api/account/import/[jobId]/route.ts
src/app/app/tonight/page.tsx
src/app/app/profile/[id]/year/[year]/page.tsx
src/components/tonight/*
```

**Modified**
```
src/app/app/page.tsx                 (cuts + Tonight entry)
src/app/app/welcome/*                (provider picker step)
src/components/.../UserRating        (W5)
src/utils/tasteMatch.ts              (reuse icebreaker builder for reasons)
```

**Deleted**
```
src/components/home/QuickPick.tsx
src/components/home/WhatToWatch.tsx
src/components/home/CommunityLeaderboard.tsx
src/components/profile/AchievementsShelf.tsx
src/components/social/WaveButton.tsx
src/components/reel/*
src/app/app/reel/*
src/app/api/movieReel/*
src/app/api/wave/*
src/app/api/what-to-watch/route.ts   (superseded by /api/tonight)
```

---

## 16. Audit — every acceptance criterion, re-checked against the code (2026-08-16)

Each of the 28 criteria in §W1–W7 was re-read and verified against the shipped code, not against memory. **21 hold. 7 do not**, and four of those are the document being wrong rather than the code.

### Criteria that hold

| § | Criterion | Evidence |
|---|---|---|
| W1 | "Next" never repeats within a session | Rejections persist to `watch_session_votes`; `rejected` is rebuilt on every resolve. |
| W1 | Works for a single user | `participants.length === 1` is the normal path; ratios divide by it cleanly. |
| W2 | Home ≤ 5 sections, ≤ 6 requests | Measured: 3 sections signed-out / 4 signed-in, **2** client API calls. |
| W2 | No dead imports; build clean | Grep sweep clean for all 12 removed symbols; `build:check` passes. |
| W3 | Real export imports watched/ratings/watchlist/reviews | Tested against a synthetic export with BOM, CRLF, quoted commas, embedded newlines, `__MACOSX`, nested `likes/films.csv`. |
| W3 | Unresolved listed with one-tap match | `ImportFlow` renders suggestions with posters; `/resolve` applies. |
| W3 | Ratings convert 0.5–5.0 → 1–10 | Verified: 4.5★ → 9, 5.0★ → 10, 4.0★ → 8. |
| W4 | Legible at story size, wordmark, links back | Measured **1080×1920**; card carries "LetSee" + `letsee.app/<user>`. |
| W4 | Public even when the profile is followers-only | `year_reviews` flag + admin-client read, gated on the flag. |
| W5 | One tap, not a slider | Ten discrete buttons; clicking the 4½ target stores 9. |
| W5 | No stored value changes | **Zero** conversion calls in any API route — display-only, confirmed by grep. |
| W7 | Permalink readable signed-out | Only `followers` visibility requires a viewer; public passes with `viewerId === null`. |

### Criteria that do NOT hold

**1. W1.1 — "flag it in the result copy". ~~NOT BUILT~~ → FIXED.**
`serializeParticipants` sent `hasProviders`; the client type didn't declare it and nothing rendered it, so a room containing someone who skipped the picker got picks that person might not be able to play, silently. The answer now carries the caveat directly under the provider pills. The server also marks `isYou` per participant rather than leaving the client to infer the caller from array order — "you haven't set your services" and "Priya hasn't set hers" are different sentences and only one should ever be shown to Priya.

**2. W1 — "a pick in < 2s". UNACHIEVABLE AS DESIGNED.**
A resolve issues ~33 TMDB calls (4 discover + 14 hydrate + up to 12 episode show/season + 3 episode provider). The client enforces `MIN_GAP_MS = 120`, giving a **4.0-second floor before any network latency**. The number was written before the work and never re-derived. Either the budget or the fan-out has to change; the UI currently shows an undifferentiated spinner for the whole wait.

**3. W1 — "every pick is genuinely streamable". CONTRADICTED BY W6.**
Episode picks deliberately bypass the availability gate (`episodeToCandidate` attaches providers but never filters on them). Both decisions are defensible in isolation; the criterion was never reconciled with the later one.

**4. W1 — "'Watch this' writes `watching` for all participants". CONTRADICTED BY Q6.**
Decided against during the build — writing to someone else's library on a friend's button press. §15/Q6 explains the reversal; §W1 still asserts the original. **The document argues with itself**, and §W1 is the version a reader hits first.

**5. W3 — "≥ 95% auto-resolution on a 500-film sample". NEVER RUN.**
16 hand-picked titles is not a sample. Still open.

**6. Scoring defect — watchlist candidates always scored 0 on quality. ~~OPEN~~ → FIXED.**
`watchlistPool` seeds `voteCount: 0` because vote data only arrives at hydration, which runs *after* scoring — so the shrinkage read a missing value as "nobody rated this" and collapsed quality to exactly 0, landing hardest on the candidates with the strongest prior. An unknown quality is now **dropped from the sum and its weight redistributed** across the terms we do know, rather than scored as zero. Measured on a film both participants watchlisted: **0.455 → 0.569**, which correctly beats a strong discover film at 0.309.

**7. UX defect — the import promised a resume it could not deliver. ~~OPEN~~ → FIXED.**
The copy said *"reopening the import picks up where it stopped"*; the server genuinely supported it and `GET /api/account/import` listed unfinished jobs, but nothing in the UI ever called it, so a half-finished import was unreachable except by re-uploading. `/app/import` now checks for an unfinished job on mount and offers **"Pick up where it stopped"** with the real counts, or starting fresh.

### Structural issue worth knowing

**The candidate pool is keyed on `itemId` alone**, so a film and a series sharing a TMDB id collide — TMDB's movie and TV id spaces are independent, so low ids overlap. This mirrors `user_media_status`'s `(user_id, item_id)` primary key, which has the same flaw at the schema level. **Pre-existing, not introduced here**, but the resolver inherits it and a fix belongs at the schema.

### Honest summary

The features are built and the reasoning behind them is sound. What this audit found is that **the plan document was not kept honest as decisions changed** — four criteria describe a product that was deliberately not built — plus two real defects and one unbuilt sub-requirement.

**All three of those are now fixed** (items 1, 6, 7 above). What remains open is the documentation drift (items 3 and 4, where the criteria are wrong rather than the code), the unrun 500-film test (item 5), the sub-2s budget (item 2, which needs the fan-out reduced or the number changed), and the pre-existing `(user_id, item_id)` key collision.
