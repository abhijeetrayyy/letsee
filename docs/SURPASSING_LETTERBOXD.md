# Surpassing Letterboxd — What Needs To Be Done

> **Status:** W1 (Tonight) and W2 (cuts) built — see §15. W3–W7 not started.
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
- [ ] A signed-in user can set region + services in under 15 seconds.
- [ ] Tonight degrades gracefully when a participant has set none (treat as "any provider", flag it in the result copy).

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
- [ ] Two users with overlapping watchlists get a pick in < 2s.
- [ ] Every pick is genuinely streamable by at least one participant in their region.
- [ ] "Next" never repeats a title within a session.
- [ ] "Watch this" writes `watching` status for all participants and appears in their feeds.
- [ ] Works for a single user (group of one) — that's the fallback that replaces `WhatToWatch.tsx`.

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
- [ ] Home page renders ≤ 5 sections and ≤ 6 network requests.
- [ ] No dead components left importing deleted routes; `npm run build:check` clean.

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
- [ ] A real Letterboxd export ZIP imports watched + ratings + watchlist + reviews.
- [ ] ≥ 95% auto-resolution on a 500-film sample.
- [ ] Unresolved titles are listed with a one-tap manual match.
- [ ] Import is idempotent — running it twice doesn't duplicate or downgrade existing status.
- [ ] Ratings convert 0.5–5.0 → 1–10 correctly (and correctly again if W5 lands).

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
- [ ] Renders for any year with data, degrades honestly when sparse.
- [ ] Image export is legible at story size, has the LetSee wordmark, and links back.
- [ ] Public even when the profile is followers-only (the user opts in per-year).

---

## W5 — Rating scale

**Decision needed before W3 import lands**, since import writes ratings.

Move `1–10` → **5 stars, half-steps** (stored as `smallint` 1–10 internally, rendered as 0.5–5.0). Storage doesn't change; only input and display do.

**Why:** faster to log, and everyone's 4★ means roughly the same thing — which directly strengthens `agree(t) = 1 - |r_a - r_b| / 9` in `043_taste_matching.sql`, our best original feature. A 1–10 slider produces hesitation and incomparable numbers.

**Touches:** `src/components/.../UserRating`, `/api/user-rating`, `/api/episode-rating`, `rating-distribution`, profile stat rendering, and the `053` cached stats path (no schema change).

**Risk:** users who deliberately used the granularity of 1–10 will notice. Mitigate by keeping stored values and rounding display only — existing 7s render as 3.5★.

**Acceptance**
- [ ] Rating a title is one tap, not a slider drag.
- [ ] No stored value changes; `rating-distribution` still reads correctly.

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

### Follow-ups this build opened

1. **Group-apply with consent** (Q6 above) — the biggest gap between what shipped and what §W1 described.
2. ~~`/api/what-to-watch` has a latent bug~~ — **resolved by deletion in W2.** For the record: its `buildGenreVector` compared stored genre *names* against `String(genre_id)`, so `"28"` never matched `"Action"`, the "Matches your taste" reason never fired, and every pick fell through to popularity. `src/utils/tonight.ts` maps ids → names via `GenreList` and does not inherit it.
3. **Runtime for TV** is average episode runtime, so "under 90 min" on a TV pick means one episode. That's the right reading for a weeknight, but it isn't stated in the UI.
4. **No rate limit on session creation.** Each resolve costs up to 4 discover calls plus 14 detail calls; TMDB throttling absorbs it, but a loop would be expensive.
5. **The home page has no signed-out Tonight affordance.** The banner is gated on `isLoggedIn`, so a visitor never learns the product's main idea exists. Cheapest fix is a signed-out variant that links to `/app/tonight`, which already explains itself and offers sign-in.

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
