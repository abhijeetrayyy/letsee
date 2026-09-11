# Why People Come Back

> **What this is.** A research synthesis and a plan. Five research passes ran on 2026-09-10 and 2026-09-11: the behavioural science of why people keep a record of what they watch; what Letterboxd's own users love, miss and are leaving over; the full tracker landscape after TV Time's shutdown; how niche social networks retained, cold-started and died; and an inventory of what TMDB and adjacent data can actually power. The raw reports, with sources, are in `docs/research/`. This document is the part that argues.
>
> **Written against** `main` @ `fadd666`, with the database as described in `A_PLACE_TO_TALK.md` (3 users, a 300:1 ratio of logging to writing).
>
> **Fourth in the series**, after `SURPASSING_LETTERBOXD.md` (W1–W7), `EXPRESSION_AND_DISCOVERY.md` (D1–D5) and `A_PLACE_TO_TALK.md`. It does not reverse them. It sharpens them with evidence, and it names the one structural gap they all built on top of.
>
> **Status (2026-09-11): Bets 1–11 built; migrations `093`–`102` applied to production** (through the IPv4 session pooler; see `docs/AGENT_DB_AND_MIGRATIONS.md` §2). The code is not yet deployed or committed. Bet 12 (a supporter tier) is deferred by design. What shipped, per bet, is in §14 at the end.

---

## Table of contents

1. [The short version](#1-the-short-version)
2. [The moment we are in](#2-the-moment-we-are-in)
3. [Why people keep a record, and where letsee stands on each reason](#3-why-people-keep-a-record)
4. [What Letterboxd's users love, miss, and leave over](#4-what-letterboxds-users-love-miss-and-leave-over)
5. [The gaps nobody has solved](#5-the-gaps-nobody-has-solved)
6. [Mechanics that retain, mechanics that corrode](#6-mechanics-that-retain-mechanics-that-corrode)
7. [Data we can build on](#7-data-we-can-build-on)
8. [Letsee against the evidence: keep, reconsider, missing](#8-letsee-against-the-evidence)
9. [The plan: twelve bets in three phases](#9-the-plan)
10. [Not building, and why](#10-not-building-and-why)
11. [Getting the first hundred people](#11-getting-the-first-hundred-people)
12. [Measures that do not corrode](#12-measures-that-do-not-corrode)
13. [Sources](#13-sources)

---

## 1. The short version

People keep a record of what they watch for seven reasons, and the evidence for each is solid: **to remember** who they were, **to say** who they are, **to finish** something bounded, **to feel** it again before, during and after, **to decide** faster, **to be together**, and **to own** something they built. Every retention mechanic that has ever worked in this category serves one of those. Every mechanic that has ever corroded (streaks, leaderboards, public counts, app-initiated rituals) replaced one of them with pressure.

The retention engine in every surviving tracker is the same: **an accumulating personal artifact plus a small number of people who can see it.** Not the feed. Discogs collections, Letterboxd diaries, Strava maps, Pinterest boards. Products that lacked one (Foursquare check-ins, BeReal photos) decayed within months of their peak.

Letsee's existing bet, owning the moment *before* watching with another person in the room, is confirmed by the evidence. Netflix's own research puts the decision window at 60 to 90 seconds; Nielsen has the average at 10 to 12 minutes and one session in five abandoned. Every standalone "decide together" swipe app has died, because a decision with no diary behind it leaves nothing to come back to. Tonight is built on the diary. That is the right shape.

But the diary underneath it has one structural gap that all three previous plans built on top of: **a viewing is not a dated event.** `watched_items` carries one row per title per user, and a rewatch is an integer. The behavioural literature, Letterboxd's most-loved feature, and Letterboxd's most-requested missing features (on this day, calendar view, cuts and versions) all point at the same object: **a dated entry, with who you watched it with.** "Watched with" is also the single largest unsolved gap in the market. Trakt's official answer to couples is "use separate accounts".

So the plan is, in one line: **make the viewing a dated, shared event; make a save carry a why, a when and a who; own TV while it is an open goal; send only the notifications the user caused; and turn what the diary knows into cards people paste into their group chats.** Twelve bets, three phases, sequenced so the first phase is the foundation the rest need.

---

## 2. The moment we are in

Three things happened in the last fourteen months that change what a small movie-and-TV journal can be.

**TV Time shut down on 15 July 2026 and deleted its data.** Twenty-five million registered users, still getting 29,000 downloads a month, gone because "there was not enough demand for a paid app" and the parent company pivoted to enterprise AI. Its premium tier had covered about a tenth of its costs. Its users did not love the tracker. They loved the ritual: mark the episode watched, then read the reactions that only unlocked once you had. Every competitor shipped a TV Time importer within days. Serializd, Simkl and Refract all buckled under the load.

**Letterboxd still has no TV, and is for sale.** TV support was promised in September 2023, "later this year" in January 2024, and re-confirmed in July 2026 as coming "in its own silo". As of this month it has not shipped. Meanwhile Tiny is shopping its majority stake at a reported 250 million dollars, with Netflix, Sony and Paramount in early talks, and a community group is crowdfunding a counter-bid. Users on r/Letterboxd write about "enshittification", paywall creep (activity filters moved to Pro in March 2025), weekly outages, and a studio owner. Letterboxd is at 30 million members and growing 43 percent a year. It is also, for the first time, something people are worried about.

**Trakt doubled its price and lost the room.** VIP went from 30 to 60 dollars a year in 2025, legacy subscribers were re-priced despite a promise, the free tier was capped, and the V3 redesign removed the progress page and daily stats. Trustpilot sits at 1.5 out of 5. Trakt remains the plumbing of the category, but nobody opens it because they enjoy it.

The audience that wants a warm, movies-and-TV journal with real friends in it has never been larger or less served. It has also never been more sensitive to three things: whether its data is portable, whether the price will change under it, and whether the people who run the place answer.

---

## 3. Why people keep a record

The seven reasons, the evidence behind each, and an honest reading of where letsee stands today. Evidence tags: **[PR]** peer-reviewed, **[IND]** company or industry data, **[LF]** long-form journalism or community threads.

### 3.1 To remember who they were

A dated log is externalised autobiographical memory. Its job is self-continuity, being the same person across time, not accounting (Conway & Pleydell-Pearce 2000; Bluck & Alea 2011) [PR]. In a 30-day field trial, resurfacing a positive logged memory while in a bad mood improved momentary mood with an effect size around 1.15, one of the largest in this whole review; resurfacing negative memories while happy made mood worse (Konrad et al. 2016) [PR]. Facebook's On This Day drew 90 million people a day. The most frequent thing Letterboxd users say they love, in every source type, is "I use it so I know what I felt at the time"; the most common regret of people who quit is "can't remember what I've watched anymore" [LF].

**Implication.** The date is the product. A rating without a date is a database row; a date with a note and a name is a memory cue. Resurface entries, but filter by valence: high ratings, rewatches, and entries with a companion by default.

**Letsee today.** The unit of the diary is a status, `watched`, on `user_media_status`, keyed on user and title. `watched_items` mirrors it with one `watched_at` per title and a UNIQUE key on (user, item, type). A second viewing increments `watch_count`. There is no calendar, no "on this day", and no way to say you saw it at the cinema in 2019 and again on the couch last night. The Year in Review exists and is the one place the date currently pays off.

### 3.2 To say who they are

Taste classifies the classifier (Bourdieu). Of fourteen shared traits, music taste is the strongest predictor of liking a stranger, ahead of religion, ethics and politics (Launay & Dunbar 2015) [PR]. Friends' neural responses to the same video clips are measurably similar (Parkinson et al. 2018) [PR]. Letterboxd's four-poster grid is described in the press as a "personality test" and a first-date question, and Letterboxd's head of social calls it "who you are as a Letterboxd member" [LF]. The cost is performance: Spotify Wrapped research documents people changing what they listen to so the summary looks right [PR].

**Implication.** Give every profile a small, high-signal, editable identity surface, and keep it separate from the honest log. A top-4, not a top-40.

**Letsee today.** Taste in Four is shipped, with an insight sentence. This is right. Letterboxd's single most-upvoted 2025 wish was to extend the slot to favourite people (27 points). There is no slot for a comfort watch or a hill to die on.

### 3.3 To finish something

Collecting works by turning a diffuse hobby into concrete, attainable goals with visible progress (McIntosh & Schmeichel 2004; Carey 2008) [PR]. The widely repeated Zeigarnik effect, that unfinished things nag at memory, does not replicate; a 2025 meta-analysis of 59 studies finds no memory advantage and, under achievement pressure, a disadvantage. What does replicate is Ovsiankina: already-started things get resumed about two thirds of the time (Ghibellini & Meier 2025) [PR].

**Implication.** Completion needs a bounded set. "Everything on my watchlist" is not a set; "all seven Kubrick films from 1968 on" or "Season 2" is. Show progress on bounded sets. Do not turn the watchlist into a performance target.

**Letsee today.** Continue watching is the one Ovsiankina surface, and it is at the top of home, which is right. Custom lists exist but show no progress. Person pages, collection strips and franchise data exist and none say "you have seen 3 of these 7".

### 3.4 To feel it again

Savouring has three tenses: anticipation, the moment, and reminiscence, and they are separate skills (Bryant & Veroff 2007; Smith & Bryant 2021) [PR]. Anticipating an experience heightens enjoyment during and after it. Pleasant experiences get procrastinated just like chores, and shorter deadlines get them done (Shu & Gneezy 2010) [PR]. Rewatching is not laziness: comfort and emotion regulation are its top motives, and rewatching a fixed text is how people measure their own change (Russell & Levy 2012; Shackleford et al. 2025) [PR].

**Implication.** Treat the watchlist as anticipation, not a to-do list: capture *why* at save time and show it on return. Make rewatching a first-class entry with its own prompt. Offer a comfort shelf when someone is tired.

**Letsee today.** A save is one tap with no context. There is no rewatch entry, only a count. There is no comfort flag. The take prompts ("What did it remind you of?", "How did it leave you feeling?") are exactly the savouring prompts the literature supports, and they are the best-designed thing in the composer.

### 3.5 To decide faster

Netflix's own research: a member loses interest after 60 to 90 seconds and 10 to 20 titles (Gomez-Uribe & Hunt 2015) [PR/IND]. Nielsen: 7.4 minutes to choose in 2019, 10.5 in 2023, around 12 in 2024, with roughly one session in five abandoned with nothing watched [IND]. In a 2025 structural model of Netflix subscribers, the strongest driver of deferral was not the number of options but *affective ambivalence*, conflicted feelings about what to pick; deferral then drove stress; having people to ask reduced it (Kim, Choi & Bao 2025) [PR]. Deloitte 2025: 53 percent of people say they get better recommendations from social media than from the streamers [IND].

**Implication.** The most valuable thing a journal does on a Tuesday night is produce a shortlist of three from people the user trusts, inside Netflix's own 90-second window. Shrink the choice; never expand it.

**Letsee today.** Tonight is exactly this: one answer, a reason that is evidence, a "next" button, gated by what the room can actually stream and the time it has. It is the best-supported feature in the product. What it lacks is the input the evidence says matters most: saves with a *when* and a *who*, so that "Friday, with Priya" is already on the shortlist before the engine runs.

### 3.6 To be together

Shared media use predicts relationship quality, and most strongly for couples who lack shared friends; reminding people they lack shared friends *increases* their motivation to share media with a partner (Gomillion et al. 2017) [PR]. Kudos on Strava causally increase how much and how often people run, and people converge toward the behaviour of the friends they give kudos to (Franken et al. 2023) [PR]. Second-screening *during* a show reduces immersion (Bellur et al. 2019) [PR]. The social unit that is growing in 2024 to 2026 is the group chat and the invite list, not the follower graph: 41 percent of social interactions and over 70 percent of Gen Z's "meaningful" ones now happen in private channels [IND]. TV Time's founder, on what 25 million people miss: "reading the community reactions after each episode became a ritual."

**Implication.** "Watched with" is a core field, not metadata. Social happens *before* (choosing) and *after* (reacting), not during. The tracker should produce the artifact the group chat consumes rather than try to host the chat. Reactions on a log entry, yes; ranking friends, no.

**Letsee today.** Tonight sessions know their participants, and then the resulting log forgets them. The take prompt "Who did you watch it with?" is free text nobody can link to. There is no comparison card. Clubs exist and are the right shape for a show-of-the-week ritual. Likes exist and counts are hidden on your own writing, which is the correct reading of the Strava evidence.

### 3.7 To own something they made

Labour produces ownership, but only for completed things; half-built things produce no attachment (Norton, Mochon & Ariely 2012) [PR]. Owners overvalue what they have curated and experience its loss as grief (Kahneman et al. 1990; Belk 1988) [PR]. Lapsed trackers are usually temporary, and 97 percent of people who felt guilt about lapsing were willing to return; they preferred visualisations that showcase successful periods rather than gaps (Epstein et al. 2016) [PR].

**Implication.** Lists and notes are user-built artifacts: nameable, orderable, exportable. Never delete or hide their work. Coming back should feel like reopening a drawer, not starting over. Never show "you haven't logged in 47 days".

**Letsee today.** Export exists. Letterboxd import exists. Nothing is designed for the return: a lapsed user lands on the same home as everyone else. Nothing shames, which is good; nothing welcomes either.

---

## 4. What Letterboxd's users love, miss, and leave over

From roughly forty r/Letterboxd threads read at comment level, app-store reviews, Trustpilot, the Letterboxd help centre and journal, and 2024 to 2026 journalism. Full report with thread IDs in `docs/research/02_letterboxd_love_and_pain.md`.

### What they love, in order of how often it came up

1. **The diary as memory.** "I like to log what I watch in a diary, and making lists" is the top comment on "why do you use Letterboxd". This is reason 3.1 in the wild.
2. **Watchlist and lists as anticipation and play.** Lists rose 88 percent in 2025.
3. **Friends' taste as a trust signal.** "If your most trustworthy friend gave it 2 stars, you know to steer clear."
4. **Funny, human reviews.** Polarising, but the post-film debrief in the car is a real ritual.
5. **Not IMDb.** Clean, honest, no review bombing.
6. **Stats and the Year in Review.** The number one reason people pay.
7. **Four Favourites as identity.**
8. **A social network that does not feel like social media.** No algorithmic feed, no doom scroll.
9. **Discovery of older and international film.**
10. **The streaming filter and "arrived on your service" alerts.** The other reason people pay.

### What they miss, in order

1. **TV.** By a wide margin: 25-plus threads, every alternatives article, every app-store review. But a vocal faction wants it *in a silo with a toggle*, and the community's own compromise is "a separate tab I can hide".
2. **Search and filtering.** Typos, year ranges, no search inside your own lists, no way to hide concert films.
3. **Stability, ads and outages.** Full-screen ads while typing a review; two multi-hour outages in 2025 and 2026.
4. **Review culture.** Jokes drown analysis; grade inflation; "if a movie isn't a 5 it's a 1". The ask is a filter, not a ban.
5. **Lists.** No collaborative lists (still unsupported June 2026), no folders, sort does not persist.
6. **Thin social.** No threaded replies, no @mentions, no DMs, no close-friends feed, no taste compatibility.
7. **Privacy.** No private accounts, no private diary. Lurkers who have "given my handle to too many people I know" stop posting.
8. **Diary gaps.** Drafts, DNF, cuts and versions, theatrical versus home, calendar view, **On This Day** (13 points), tagging without logging.
9. **Paywall creep.** Custom posters, activity filters, stats.
10. **Recommendations that ignore taste**, and no way to follow a director for release alerts.
11. **Notifications** that are coarse and unreliable.
12. **Where to watch** only for "featured services" on the free tier.
13. **A note on why I added it to my watchlist** (14 points): "I often forget why I added them."

### Why they leave

"Turning my hobbies into chores." "I can't enjoy movies anymore because of Letterboxd." "The app is being increasingly treated as a résumé." A friend "couldn't enjoy Poor Things because he was mentally drafting his Letterboxd review." The fixes people describe are the same every time: drop ratings, go private, follow fewer people. TV-first people never start at all. And, new in 2026, people are leaving over trust: a studio owner, weekly outages, phishing emails, support that does not answer.

**What this says to letsee.** The things people love are the diary, their friends' taste, the year in review and the identity slot. Letsee has all four in some form. The things people miss are TV, "watched with", collaborative lists, privacy by default, watchlist notes, On This Day and a calendar. Letsee has TV and collaborative lists and privacy-by-default already, and is missing the rest. The things people leave over are performance and pressure, and letsee's existing principles (no counts on your writing, no streaks, prompts not blank boxes, private by default) are the correct defence. Keep them.

---

## 5. The gaps nobody has solved

Ranked across the whole landscape, with the evidence. Full matrix in `docs/research/03_competitor_landscape.md`.

| # | Gap | Who is closest | Evidence |
|---|---|---|---|
| 1 | **Household progress and "watched with."** Every tracker records *what*; none record *who*. | Nobody. Trakt: "it will track a rewatch but not who; use separate devices." | Trakt forum, Moviebase's couples guide ("30 minutes of arguing", the watchlist "a battlefield") |
| 2 | **Movies and TV and a real community in one product.** | Letterboxd (film only), Serializd (TV only), Trakt (anti-social by design). TV Time had it and is gone. | "What I really want is for Letterboxd to do a TV version." |
| 3 | **Spoiler-safe, progress-gated episode discussion.** | TV Time did it; Bingers is trying to rebuild it. | Founder: "the ritual." 25,000-signature petition. |
| 4 | **Reliable, free automatic capture.** | Trakt's scrobbler is VIP-only, daily and "misses a LOT." | MacRumors, Trakt forums |
| 5 | **Deciding together as a mode, not an app.** | Swipe apps have no retention. Bingie died with 2.1 stars. | App Store, Vice on Cinesift |
| 6 | **Friend recommendations that don't get lost.** | WatchMates ("never forget what someone told you to watch"), Beli's friend score. | Trakt's "friends who watched this" request, open for years |
| 7 | **First-class statuses: paused, dropped, caught-up, rewatching.** | AniList, Backloggd, StoryGraph. Trakt only added "drop" in 2025. | Trakt forum |
| 8 | **Portability and trust.** | TV Time deleted 25M histories. Trakt and Simkl charge for export. | "Look for apps that provide easy watchlist export." |
| 9 | **Privacy-by-default social.** | StoryGraph (no comments on reviews), Beli (friends-only), Plex (forced choice at signup). | Letterboxd help centre: private accounts "in the works" |
| 10 | **Non-hostile monetisation.** | Letterboxd ($20/$40, free tier intact), Callsheet ($9/yr), Backloggd (Patreon). | Trakt's 89 percent one-star reviews |
| 11 | **"When does it come back?" where you look.** | Apple removes caught-up shows from Up Next, which everyone hates. | Ex-TV Time users: "I relied on it to show me premieres in my watch-next." |
| 12 | **Stats that read like a diary, not a dashboard.** | Backloggd's journal calendar, Serializd's rewatch-doubling. Trakt V3 deleted daily stats and the progress page. | Trakt roadmap is "restore my stats" |

Letsee already covers 2, 5, 7 and 9 in whole or in part, and is one migration away from 1. Nobody covers 1, 3, 6 and 11 together. That combination is the product.

---

## 6. Mechanics that retain, mechanics that corrode

The mechanics with the strongest evidence, and the gentler form that keeps the benefit. Full treatment in `docs/research/01_why_people_keep_a_record.md` §3 and `04_how_niche_networks_retain.md` §8–9.

| Mechanic | Evidence it works | Evidence it corrodes | The form that keeps the benefit |
|---|---|---|---|
| **Streaks** | Duolingo: 7-day streakers 3.6× more likely to finish (correlational); streak freeze keeps streaks 4.5× longer [IND] | Lost streak → abandoned account; users beg for an off switch (Mogavi 2022) [PR]; satisfaction falls after day 90 [IND]; Beli: "prioritising streaks over genuine dining" [LF] | A **calendar heatmap** that shows presence without a breakable chain; never notify about a gap |
| **Annual count targets** | Goodreads challenge: joiners read significantly more [PR-preprint] | Consistent testimony of gaming the unit, rushing, relief on marking "read" [LF] | Opt-in goals in **ungameable units** (with someone, outside your usual), shown as pace not deficit |
| **Leaderboards** | Strava kudos causally raise activity [PR] | "Everything becomes a competition"; people delete slow runs and hide when injured [PR]; MySpace Top 8 "psychological warfare" [LF] | **Kudos without ranking**; comparison framed as similarity ("you and Sam both loved…"), never rank |
| **Badges** | Completion drive is real [PR] | Untappd badges normalise volume; five years on, ethics unresolved [PR] | **Bounded sets the user chooses**, with quiet completion notes |
| **Public-by-default logging** | Identity display motivates [PR] | Evaluation apprehension suppresses disclosure; performative logging pollutes the record [PR] | **Private diary, curated public shelf**, per-entry audience |
| **Year in review** | Reminiscence on positive memories lifts mood, d≈1.15 [PR]; Wrapped is the strongest sharing event in consumer software [IND] | "Wrapped anxiety", performative listening [PR] | Lead with **people and moments**, counts last; filter On This Day to positive entries |
| **Variable-reward feeds** | Engagement | Attention-capture dark patterns literature; Letterboxd's growth is credited to *not* having one [PR/LF] | **Chronological, friends-only, finite** ("you're caught up") |
| **App-initiated daily rituals** | BeReal hit 73.5M MAU | 9 percent daily-open two months after peak; "a chore, not a reward" [IND/LF] | Only **user-initiated** logging; the app's job is the moment after watching |
| **Passive capture** | Strava, Last.fm, Airbuds (30 percent DAU/MAU) [IND] | For video it is lossy and VIP-only (Trakt) | **Import history files** (Netflix, Trakt, TV Time); two-tap manual logging |

The rule of thumb across all of it: **a mechanic corrodes when losing it costs the user an identity asset.** Record presence without creating something losable and you keep most of the benefit.

Letsee's written principles (`A_PLACE_TO_TALK.md` §2, `SURPASSING_LETTERBOXD.md` §12) already sit on the right side of every row. Nothing here argues for reversing them.

---

## 7. Data we can build on

What TMDB and adjacent sources actually provide, reduced to the parts that unlock something in this plan. Full endpoint inventory, quality caveats and cost tables in `docs/research/05_tmdb_and_adjacent_data.md`.

### The rules that bind

- **Rate limit** is a soft ceiling around 40 to 50 requests a second per key, with 429s. No daily cap. The image CDN has no limit.
- **Attribution**: the notice "This product uses the TMDB API but is not endorsed or certified by TMDB", plus logo rules. Showing watch providers **also requires crediting JustWatch**.
- **Commercial use**: ads or a paid app are fine with attribution; a subscription product sits in a grey zone and wants a short email to TMDB before launch. Budget it.
- **Cache cap** of six months on stored data.
- **Watch provider data** is JustWatch's, refreshed roughly daily, with **no dates, no prices, no deep links, no expiry, and no changes feed**. Anything time-based about availability has to be built by diffing snapshots, or bought.

### What each bet needs

| Need | Source | Cost | Caveat |
|---|---|---|---|
| Availability on the user's services, per region | `/{movie,tv}/{id}/watch/providers`; `/watch/providers/{movie,tv}?watch_region=` | Free | Already used by Tonight. India coverage is good for major services, with lag |
| **"Arrived on your service"** for watchlist titles | Daily provider snapshot per watchlist title, diffed | Free; one call per title per day | Require two consecutive readings before announcing; no "added on" date exists |
| **"Leaving soon"** | Streaming Availability API `/changes?change_type=expiring` with `expiresOn`, joined on TMDB id | Free tier 1,000 req/month; 49 dollars/month for 25,000 | Only source with expiry dates; commercial use allowed on every tier |
| New episode, season return, "waiting" state | `/tv/{id}` → `next_episode_to_air`, `status`, `in_production`; `/tv/changes` (14-day window) for tracked shows | Free | Dates only, no air times; Netflix midnight-UTC drops read one day early. TVmaze (CC BY-SA) has `airstamp` if times ever matter |
| Runtime fits tonight | `with_runtime.gte/lte`; sum per-episode `runtime` for TV | Free | `episode_run_time` is often empty; use per-episode runtime |
| Bounded sets | `belongs_to_collection` → `/collection/{id}/parts`; `/person/{id}/combined_credits`; `with_people` | Free | Collections are movie-only; TV franchises need curation (`franchises.ts` exists) |
| Import from Trakt, Simkl, TV Time, IMDb | `/find/{id}?external_source=imdb_id|tvdb_id` | Free | Trakt and Simkl exports carry TMDB ids; TV Time exports are keyed on TVDB; Letterboxd carries neither, hence the existing name-and-year resolver |
| Import Netflix history | Netflix `ViewingActivity.csv` (Title, Start Time, Duration, Supplemental Video Type…) | Free | Titles only; regex `Show: Season N: Episode` then `/search/tv` and episode-name match; expect 85 to 90 percent auto-match |
| Spoiler-safe episode pages | Show only `air_date`, number, runtime for unwatched | Free | Episode overviews and stills on TMDB frequently spoil; `aggregate_credits` episode counts leak who leaves a show |
| On this day | Cached `release_date` and the user's own diary | Free | Use `release_dates` type 3 in the user's region for "released in India on this day" |
| Content warnings | `release_dates.certification`, `content_ratings`; Does The Dog Die for triggers | Free | Descriptors are almost always empty; Common Sense is licensed-only |
| Trailers | `/videos` keys, embedded via the YouTube iframe | Free, no quota | Never call YouTube `search.list` per title: it is capped at 100 calls a day since June 2026 |
| Custom posters and textless backdrops | `/images?include_image_language=hi,en,null` | Free | A Patron-tier feature on Letterboxd; free here |
| Awards, based-on, sequel chains | Wikidata SPARQL via `external_ids.wikidata_id` | Free, CC0 | Five parallel queries per IP; good for Hollywood, weak for regional TV |

Two things not to build on: the **IMDb datasets** (non-commercial only) and **Rotten Tomatoes or Metacritic** scraping (forbidden; show scores via OMDb's `Ratings[]` or link out).

---

## 8. Letsee against the evidence

An honest audit of what is shipped against sections 3 to 7. Three columns: what to keep because the evidence supports it, what to reconsider, and what is missing.

### Keep, because the evidence says so

| What | Why it holds |
|---|---|
| **Tonight** as the front door, one answer with an evidence-reason | §3.5. Swipe apps died; a decision on top of a diary is the surviving shape |
| **Private by default; "Keep private" and "Post it" as two named acts** | §6, public-by-default row |
| **Prompts as placeholders, rating after the text, no counts on your own writing** | Evaluation-apprehension literature; NN/G "edit, don't create"; StoryGraph |
| **Chronological, friends-first feed with voices before verbs** | §6, feed row; Letterboxd's growth credited to not having an algorithmic feed |
| **The reason is evidence, never a percentage** | Launay & Dunbar: show the overlap, because the overlap starts the conversation |
| **No streaks, leaderboards, achievements, waves** | §6 |
| **Notifications are a person addressing a person** | Correct core. Too narrow at the edges, see below |
| **Restraint on home** | Every carousel is a tax on the one surface that decides |
| **Export**, and Letterboxd import | Trust is now the competitive axis (§2) |
| **Clubs** as a week-long shared pick | The show-of-the-week ritual is what TV Time's users miss; the shape exists |
| **Taste in Four** | §3.2 |
| **`watching`, `on_hold`, `dropped`** as first-class statuses | Gap 7 |

### Reconsider

| What | The evidence | Suggested change |
|---|---|---|
| **Notifications cut to four kinds** (092) | The doctrine that survives across Letterboxd, Strava, Goodreads and Duolingo is not "person-to-person only"; it is **"only what the user caused."** A watchlist title arriving on your service is the number one reason people pay Letterboxd. A new episode of a show you are mid-way through is Serializd's number one complaint. A reply to your take is a person addressing you, and 092 itself says it is four lines to restore. | Restore `comment_reply`. Add `watchlist_available` and `new_episode` as a **once-daily digest computed per user from their own list**, not a per-follower fan-out. The fan-out cost 092 removed does not apply: a user's own watchlist is bounded by the user. |
| **"No hours figure"** in stats | Trakt users mourned daily watch-time stats loudly when V3 removed them; Letterboxd's Year in Review leads with hours. Runtime is known per title and per episode. | Show hours in the Year in Review and monthly recap only, labelled "about", never on the profile header. Minor. |
| **"No auto-scrobbling"** | Correct for live scrobbling (lossy, VIP-only, breaks). But passive capture is the strongest retention lever where it exists. | Keep the non-goal for live scrobbling. **Import history files instead**: Netflix, Trakt, Simkl, TV Time, IMDb. Same benefit, no integration to maintain. |
| **Presence is deferred until there is something behind it** | Agreed for green dots. But ambient awareness (Thompson 2008) needs no realtime: "Sam watched Columbo last night" in a quiet feed is the retention glue of small networks and is true at three users. | Watchlist adds and rewatches are honest ambient signals. Let them into the feed as small rows below voices, never above. |
| **The feed only shows takes and watches** | Same. | As above. |
| **DMs** | StoryGraph and Beli refuse them to avoid moderation load; Letterboxd's users beg for them. Letsee has them, rate-limited and sized. | Keep. Watch the moderation load. Blocking and reporting exist. |

### Missing, ranked by evidence and by gap

| What | Evidence | Market gap |
|---|---|---|
| **A viewing as a dated event; rewatches as entries** | §3.1, §3.4 | Letterboxd's most-loved feature and its most-missed additions (calendar, On This Day, cuts) |
| **Watched with** | §3.6 | Gap 1, unsolved by anyone |
| **A save with a why, a when and a who** | Gollwitzer & Sheeran, d=0.65; Shu & Gneezy | Letterboxd wish, 14 points; gap 6 |
| **The "I told you so" loop** | Berger 2014; Franken 2023 | Gap 6 |
| **A "waiting" state with a return date; new-episode where you look** | Ovsiankina | Gap 11 |
| **Progress-gated episode threads** | TV Time's ritual | Gap 3 |
| **Monthly recap and On This Day** | Konrad 2016; Airbuds' weekly recap | Letterboxd wish, 13 points |
| **The comparison card** | Wordle grid; group chat as the social layer | Nobody |
| **Calendar heatmap** | §6 streaks row | Letterboxd wish; Backloggd |
| **Progress on bounded sets** | §3.3 | Trakt roadmap |
| **More identity slots** (people, comfort watch) | §3.2 | Letterboxd wish, 27 points |
| **Trakt, Simkl, TV Time, Netflix, IMDb importers** | StoryGraph: import was "critical onboarding" | Every migration wave was won by whoever could ingest the diary |
| **"New on your services" and "leaving soon"** | Shu & Gneezy deadlines; Deloitte churn | Letterboxd's top paid feature; JustWatch's 60M MAU |
| **A designed return for lapsed users** | Epstein 2016 | Nobody |

---

## 9. The plan

Twelve bets in three phases. Each has the evidence behind it, what it is concretely, where it lands in the code, a cost (S: days, M: a week or two, L: more), and how we would know. Order inside a phase is priority order. Phase 1 is the foundation the rest need.

### Phase 1: the diary knows who was in the room

#### Bet 1. A viewing is a dated event

**Why.** §3.1 and §3.4. The date is the product; rewatches are memory, not a counter. The UNIQUE key on `watched_items` (user, item, type) is the one structural decision all three previous plans built on top of, and it prevents every feature in this phase.

**What.** A `viewings` table: one row per time someone watched something. `user_id, item_id, item_type, watched_on (date), rewatch (bool), where ('home' | 'cinema' | 'other'), provider_id (nullable), note_take (fk, nullable), created_at`. "Mark watched" stays a one-tap fact with no date (Letterboxd's distinction between marking and logging is the right one). "Log it" creates a viewing. `user_media_status.watch_count` becomes a projection of `count(viewings)`. The take composer gains a "when" that defaults to today and a "rewatch" flag that changes the prompt to Russell & Levy's question: "What did you notice this time that you didn't before?"

**Where.** New migration, in the additive-first, dual-write pattern `065` used for takes: backfill one viewing per `watched_items` row from `watched_at`; keep the legacy columns alive as a projection until the readers move. `TitleTalk`, `StatusControl`, the profile grid, Year in Review, import and export all read `watched_at`; they move one at a time.

**Cost.** M to L. The migration is a day; moving the readers is the rest.

**How we'd know.** Rewatch viewings logged. Import produces multiple viewings for Letterboxd rewatch rows (their `diary.csv` carries a `Rewatch` column that the current importer must be flattening).

#### Bet 2. Watched with

**Why.** §3.6. The highest-evidence social field and the largest unsolved gap in the market.

**What.** `viewing_companions`: `viewing_id, user_id (nullable), name (text, for people not on letsee)`. Three entry points: the Tonight decision writes the session's participants automatically (the diary becomes a byproduct of the decision, which `SURPASSING_LETTERBOXD.md` §2 promised); the composer prompt "Who did you watch it with?" becomes a people picker with free text; and **co-logging**: when you name someone who is on letsee, they get a one-tap "I was there too" that creates their own viewing, linked, with their own optional rating and take. Profile: "people you watch with most". Year in Review: "most watched with". Tonight's engine gets a real signal: what this pair has already seen together.

**Where.** New table; `TonightRoom` decide path; `TitleTalk` composer; `ProfileHeroNew` or a new strip; `yearInReview.ts`.

**Cost.** M.

**How we'd know.** Share of viewings with at least one companion. Co-logs accepted. This is the number to watch above all others in Phase 1.

#### Bet 3. A save has a why, a when, and a who

**Why.** Implementation intentions raise follow-through by d=0.65 (Gollwitzer & Sheeran 2006); pleasant experiences get procrastinated without a deadline (Shu & Gneezy 2010); the recommender's payoff is recognition (Berger 2014). Letterboxd wish, 14 points: "I often forget why I added them."

**What.** When adding to the watchlist, three optional fields that take two seconds: **why** (one line, or a person: "Priya said"), **for** (tonight / this weekend / someday / a date), **with** (a person). A save with a person becomes a `title_recommendation` from them to you if they are on letsee, and lands in a "from Priya" lane on your watchlist. When you log it, Priya is told, once, in the digest: "Abhijeet watched Columbo. You recommended it." That closes the loop (the "I told you so" mechanic). Tonight draws from time-boxed saves first. Sharing a movie card in a DM becomes a recommendation automatically. The watchlist view sorts by "for" before "date added", because sorting by date added surfaces the oldest, most guilt-laden items first.

**Where.** `user_media_status` rows with `status='watchlist'` gain `save_note`, `save_for`, `save_with_user_id`; a new `title_recommendations` table (`from_user, to_user, item, note, created_at, watched_viewing_id`); `sendCard.tsx`; the watchlist page; `tonight.ts` candidate ordering.

**Cost.** M.

**How we'd know.** Watchlist-to-watched within 30 days, split by whether the save had a "for". Recommendations closed.

#### Bet 4. TV, while it is an open goal

**Why.** §2 and §5 gaps 2, 3 and 11. TV Time is gone, Letterboxd has not shipped, and letsee already has episode tracking, season and episode takes, Continue watching, and paused and dropped statuses.

**What.** Four things, smallest first. **(a) A "waiting" state**: a show whose next episode has not aired is never removed from Continue watching; it moves to a "waiting" row with "back {air_date}" from `next_episode_to_air`, or "ended" from `status`. **(b) Progress-gated episode threads**: on an episode page, the thread of takes is hidden behind "mark watched", and for unwatched episodes the still, the overview and the guest stars are hidden too, because TMDB's episode overviews spoil. This is TV Time's ritual, and `watched_episodes` already holds the gate. **(c) Importers** for Trakt (JSON with TMDB ids), Simkl, TV Time's legacy export (TVDB ids via `/find`), IMDb ratings, and Netflix's `ViewingActivity.csv`, on the existing `import_jobs` pipeline. **(d) A landing page** for people who lost TV Time, that says what happens to their data here.

**Where.** `NextEpisode.tsx`, `ContinueWatchingProgress.tsx`, the episode page and `TitleTalk` at `scope="episode"`, `importApply.ts` and `titleResolver.ts`, a new route under `/app/import`.

**Cost.** S for (a) and (b), M for (c), S for (d).

**How we'd know.** Share of logs that are TV. Imports completed by source.

### Phase 2: what the diary can now say

#### Bet 5. Notifications the user caused, once a day

**Why.** §8 reconsider table. The doctrine across every survivor: only what the user caused; once per day per category; interaction subscribes, silence unsubscribes; never a nag.

**What.** A daily cron, `refresh-watchlist`, in the same shape as `refresh-taste`: for each user, diff provider availability for their watchlist against yesterday's snapshot on the services they hold (`user_providers`), and check `next_episode_to_air` for shows they are watching. Write at most one notification per category per day: **"3 things on your watchlist arrived on Netflix"**, **"Severance is back Friday"**, and the restored **`comment_reply`**. Add **`recommendation_watched`** from Bet 3. An opt-in weekly email whose top section is "what you two could watch this week", computed from the intersection of two watchlists and both people's services. After thirty days of ignored notifications, stop and say so.

**Where.** `notifications` type CHECK, a new cron route behind `cronAuth.ts`, `vercel.json` schedule, a snapshot table keyed on (item, region, provider). The provider diff is the same job "leaving soon" and "new on your services" (Bet 9) need.

**Cost.** S to M.

**How we'd know.** Open rate on each type; unsubscribe rate. Any type whose open rate falls below the follow-request type gets cut.

#### Bet 6. Recaps that lead with people: monthly wrap, and On This Day

**Why.** Konrad 2016 (d≈1.15 on momentary mood, for positive memories); Wrapped as the strongest sharing event in consumer software; Airbuds' pitch is "Wrapped, but every week"; Letterboxd wish, 13 points.

**What.** **On This Day** on home: "a year ago you and Priya watched Past Lives", filtered to positive entries (rating 7 or above, rewatches, or a companion), opt-in as a daily notification. **A monthly card** on the first of the month, built with the existing `shareImage` and `year_reviews` code: most watched with, best night, one rewatch, the count last. The Year in Review re-ordered the same way: people and moments first, hours "about", the count last.

**Where.** `yearInReview.ts`, `shareImage.ts`, a home section that renders nothing when there is nothing (the pattern `PopularReviews` already uses).

**Cost.** S to M. Needs Bet 1's dates.

**How we'd know.** Cards downloaded or shared, monthly.

#### Bet 7. The comparison card, and the shared list as the invite

**Why.** §3.6: the tracker should produce the artifact the group chat consumes. The Wordle grid: spoiler-free, legible without the app, about the person's experience. Partiful: the invite is a link to the thing, not "join my network".

**What.** When two people who watch together both have a viewing of the same title, a card: "We watched Dune. Abhijeet 8, Priya 6." Share sheet, poster, no spoilers. And the invite becomes **"here's our list"**: a collaborative list gets a link that works for someone without an account, shows the list, and offers one-tap "add mine" on sign-up. `user_list_collaborators` exists; the public link is the missing half.

**Where.** `shareImage.ts`, `ShareModal.tsx`, the list page, `user_lists` visibility.

**Cost.** S.

**How we'd know.** Cards shared. Sign-ups arriving through a list link.

#### Bet 8. The calendar, and progress on bounded sets

**Why.** §6: a heatmap keeps the presence benefit of a streak without a chain to break. §3.3: completion motivates on bounded sets; Trakt's roadmap is "restore my progress page".

**What.** A GitHub-style **diary calendar** on the profile from `viewings`, with no consecutive-day count anywhere and no notification about gaps. On person pages, collection strips and any list: **"seen 3 of 7"**, with a quiet completion note, never a badge.

**Where.** `StatsSection.tsx` or a new profile section; `PersonWork.tsx`, `FranchiseStrip.tsx`, `ListDetail.tsx`.

**Cost.** S.

#### Bet 9. New on your services, and leaving soon

**Why.** Shu & Gneezy: a deadline gets a pleasant thing done. Deloitte: 39 percent of people cancel a service within six months, so the saved title is often not where they think. Letterboxd's top paid feature; JustWatch's entire 60-million-user business.

**What.** A directed shelf, not a carousel: **"New on your services this week"** from the same provider snapshot diff as Bet 5, restricted to titles with a vote count floor. **"Leaving soon"** on the watchlist and in Tonight's reasons ("leaves Netflix on the 30th"), from the Streaming Availability API's `expiring` changes on the free tier until volume needs the 49-dollar one. JustWatch credited wherever providers show.

**Where.** `Availability.tsx`, the watchlist page, `tonight.ts` reason builder, the snapshot table from Bet 5.

**Cost.** M.

#### Bet 10. More identity, and a designed return

**Why.** §3.2: small, distinctive, editable slots start conversations. Letterboxd's top wish: favourite people, 27 points. §3.7: lapsed users return when welcomed with what they logged, not what they missed.

**What.** Next to Taste in Four: **four people** (from `/person`), **a comfort watch**, and **a hill to die on** (one title, one line). Custom poster choice from TMDB's `images` for the four favourites, which Letterboxd charges 40 dollars a year for. For anyone whose last viewing is more than 30 days old, home opens with **"the last three things you loved"** and one thing a friend watched, and a single "what did you watch recently?" with autocomplete. No mention of the gap.

**Where.** `user_favorite_display`, `TasteInFourStrip.tsx`, `EditTasteInFour.tsx`, `HomeGreeting.tsx`.

**Cost.** S.

### Phase 3: make it sustainable

#### Bet 11. Portability as a promise, and the empty room

**Why.** §2 and gap 8. TV Time deleted 25 million histories; Trakt and Simkl sell export; Letterboxd's users are watching a sale. StoryGraph called its Goodreads importer "critical onboarding". Untappd designed three feeds so a brand-new user never saw an empty room.

**What.** A **"your data"** page: export to JSON and to Letterboxd's import CSV format (so people can leave, which is why they will stay), the importers from Bet 4, and a plain statement of who runs this and what happens to the data. For anyone with fewer than three follows, home shows **"what people wrote"** (exists) and **a regional "what people here are watching this week"**, computed from `user_media_status` in the same region with a k-anonymity floor, in place of the following feed until the feed has something in it.

**Where.** `/api/account/export`, a settings page, `FollowingFeed.tsx` empty state.

**Cost.** S to M.

#### Bet 12. Pay for what people already pay for

**Why.** §4 and `docs/research/04` §6. People pay for stats about themselves, decorating their profile, sync convenience, and supporting a small team they like. They punish paywalling what was free and re-pricing without new value. Realistic conversion is 0.4 to 4 percent, so the infrastructure has to fit inside 1 percent paying; TV Time could not do that and died with 25 million users. Letsee has already been taken off the air once by its own hosting bill.

**What.** Later, not now, and pre-sold StoryGraph-style before it exists: **a supporter tier at about 20 dollars a year** for the all-time stats page, custom backdrops, a supporter mark, and the weekly email. Never behind it: the diary, the friend graph, export, privacy, availability alerts. And the engineering discipline that makes 1 percent enough: the episode write path stays the cheapest write in the system, no per-follower fan-out anywhere (092 already did this), recaps precomputed by cron, TMDB cached within the six-month cap.

**Cost.** M, later.

### Sequencing

```
Phase 1  (foundation)   Bet 1 viewings ──► Bet 2 watched with ──► Bet 3 saves with why/when/who
                        Bet 4 TV (a)(b) can ship immediately; (c) importers after Bet 1
Phase 2  (payoff)       Bet 5 digest ──► Bet 9 new/leaving (same snapshot job)
                        Bet 6 recaps and Bet 8 calendar need Bet 1
                        Bet 7 cards need Bet 2; Bet 10 any time
Phase 3  (sustain)      Bet 11 with Bet 4(c); Bet 12 after there is someone to ask
```

Bet 4(a), 4(b), 7 and 10 are each a few days and touch nothing structural. They can ship in any gap.

---

## 10. Not building, and why

Written down so they stop coming back, with the evidence this time.

- **Streaks, leaderboards, achievements.** Duolingo's own data: satisfaction drops after day 90; a broken streak churns harder than no streak. Beli: "prioritising streaks over genuine dining". Strava: people delete slow runs. The calendar keeps the benefit.
- **An algorithmic or variable-reward feed.** Letterboxd's growth is credited to not having one. The feed stays chronological, friends-first, finite.
- **App-initiated rituals.** BeReal. The app makes the moment after watching frictionless; it does not create the moment.
- **Live scrobbling.** Lossy, VIP-only on Trakt, breaks when a streamer changes a token. Import history files instead.
- **A percentage on taste.** Show the overlap. The overlap is the conversation.
- **Public comment threads from strangers on your writing, without a moderation budget.** Goodreads. Replies stay, friends-first, hide-not-delete; comment counts stay hidden on your own writing.
- **Reassurance copy.** "No wrong answers" reminds people there are.
- **Paywalling export, privacy, or anything that was free.** Trakt's 89 percent one-star reviews; Strava's 2020 backlash.
- **Short-form video, reels, a second product.**
- **Hours on the profile header.** In recaps only, labelled "about".
- **Matching Letterboxd feature for feature.** Search basics, folders and translation are worth fixing where cheap; they are not the product.

---

## 11. Getting the first hundred people

None of this is code, and all of it is cheaper than any bet above. From `docs/research/04` §2 and §10.

1. **Decide the atomic network.** Andrew Chen's is "smaller and more specific than you think": Zoom is two people, Slack is three. For letsee it is **one household or one friend group**, two to six people, with a shared list and one Tonight a week. Not "film fans".
2. **Interview twenty to thirty people who already keep a log somewhere**: Letterboxd, a Notes file, a shared Google Sheet with a partner, a WhatsApp group where the poll happens. StoryGraph's founder spent three months on this before writing code and cold-DM'd people who posted about Goodreads. Cold-DM people who post Letterboxd screenshots and "what should we watch" polls.
3. **The invite is a link to the shared list**, sent by text, Partiful-style. Not "join my network". Bet 7 builds it.
4. **A landing page for people who lost TV Time**, with the importer. Every migration wave in this category was won by whoever could ingest the history. It is 2026-09-11; the wave is eight weeks old.
5. **Seed one tribe, invite-only**: one film Discord, one college film society, one city's repertory cinema audience. Letterboxd used web designers from one conference and had 17,000 people writing before the public saw it.
6. **A weekly email to the first hundred that reads like a stand-up**: what shipped, what you asked for, what is next. StoryGraph did this to a hundred people for a year. It is also the moderation, support and trust story in one.
7. **Pre-sell the supporter tier** before building it. StoryGraph took 1,400 pre-orders for a product that did not exist.
8. **The identity format as marketing, later**: "four for right now" with local filmmakers and film-society presidents; every clip is an advertisement for having a profile.

---

## 12. Measures that do not corrode

`SURPASSING_LETTERBOXD.md` §13 chose sessions with two or more participants, decide rate, picks per decision, and logs originating from a session, and deliberately refused DAU, time in app and titles logged. That holds. Duolingo's growth model found current-user retention had five times the leverage of any other number. These are added:

| Signal | Why |
|---|---|
| **Logged a viewing in the last 30 days** (current-user retention) | The one number with the most leverage |
| **Share of viewings with a companion** | Whether Bet 2 is real |
| **Co-logs accepted** | Whether "I was there too" is used |
| **Watchlist to watched within 30 days**, split by saves with a "for" | Whether Bet 3 closes the loop |
| **Recommendations closed** | Whether the gift gets recognised |
| **Opened a shared list this week** | The atomic network's heartbeat |
| **Cards shared** (comparison, monthly) | Whether the diary reaches the group chat |
| **Imports completed, by source** | Switching cost removed |
| **Notification open rate by type, and unsubscribes** | Any type below `follow_request` gets cut |
| **Returned after a 30-day gap** | Whether the return is designed |

Still not tracked: total titles, DAU, time in app, followers. They rise when carousels are added, which is the failure this whole series exists to avoid.

---

## 13. Sources

The five research reports, each with full citations, are in `docs/research/`:

1. `01_why_people_keep_a_record.md`: behavioural science, with peer-reviewed, industry and long-form evidence tagged and a list of claims that did not survive checking (Zeigarnik, shared-attention amplification, Fogg as validated science, Goodreads "shorter books", Netflix "My List" abandonment rates).
2. `02_letterboxd_love_and_pain.md`: forty r/Letterboxd threads at comment level, app-store and Trustpilot reviews, the help centre and journal, and 2024 to 2026 journalism, with thread IDs.
3. `03_competitor_landscape.md`: 35 products, a feature matrix, and the ranked gaps.
4. `04_how_niche_networks_retain.md`: 23 case studies from Letterboxd to BeReal, the cold-start playbook, the notification doctrine, and monetisation numbers.
5. `05_tmdb_and_adjacent_data.md`: every TMDB endpoint family with fields, quality caveats, and a cost table for OMDb, Wikidata, TVmaze, TheTVDB, Trakt, Simkl, Streaming Availability, Watchmode, Kinocheck, YouTube, Does The Dog Die and the import formats for Letterboxd, Trakt, TV Time, Netflix, Prime and IMDb.

Two limits of the research to hold in mind. Reddit blocks crawlers, so thread content came through archives and search excerpts, and scores there run lower than live. TMDB's own developer site was unreachable during the pass, so the endpoint inventory was rebuilt from a mirror of TMDB's OpenAPI file and forum threads; the report marks every claim it could not read first-hand.

---

## 14. What shipped (2026-09-11)

Everything below passes `tsc`, `eslint`, the 117-test suite and `next build`, and was then put through a `/code-review high` pass whose ten findings were fixed (see the review's report in the session). Nothing was verified against a live database or a signed-in browser session, because neither was reachable from the machine that built it; the migrations were verified on a local PostgreSQL built from the baseline.

| Bet | Shipped | Where |
|---|---|---|
| **1** A viewing is a dated event | `viewings` table, backfill, projection triggers, `watched_this_year` from viewings; `/api/viewings`; every "watched" writer (status route, quick-add, finishing a series, favouriting, a dateless import) creates the first viewing through one SQL call; moving a title back to the watchlist keeps the diary; the composer gains a log panel (date, where, who) and a rewatch prompt | `migrations/095`, `src/utils/mediaStatus.ts`, `src/utils/viewings.ts`, `src/lib/db/viewings.ts`, `src/app/api/viewings/route.ts`, `src/app/api/user-media-status/route.ts`, `src/components/takes/LogViewing.tsx`, `TitleTalk.tsx` |
| **2** Watched with | Companions on a viewing (users or names); Tonight's room pre-fills them; `co_log_invite` notification with "I was there too" (`accept_co_log`); "People you watch with" on the profile; year and month recaps lead with them | `migrations/096`, `LogViewing.tsx`, `notification/page.tsx`, `WatchCompanions.tsx`, `yearInReview.ts` |
| **3** A save has a why, a when and a who | Save context beneath the status pills on a title page; `title_recommendations` (a recipient may only name someone they are connected to) closed by a viewing with one notification back; a shared card becomes a recommendation; the watchlist is three lanes (lined up, from people, someday) with the save's reason on each card | `migrations/097`, `SaveContext.tsx`, `PersonPicker.tsx`, `threePrefrencebtn.tsx`, `app/watchlist/page.tsx` |
| **4** TV | (a) waiting state in Continue watching; (b) episode overview, stills, guest stars and thread hidden until watched, season-page overviews likewise, "Show anyway" escape; (c) importers for Trakt, Simkl, TV Time, IMDb, Netflix and Letterboxd's `diary.csv`, with `/find` for external ids, a series-aware name search and Netflix episode-name resolution; (d) a landing page at `/tv-time` | `continue-watching/route.ts`, `EpisodeSpoilerGate.tsx`, `EpisodeListWithWatched.tsx`, `importSources.ts`, `titleResolver.ts`, `importApply.ts`, the import routes, `ImportFlow.tsx`, `migrations/101`, `app/tv-time/page.tsx` |
| **5** Notifications the user caused | Nine kinds; `comment_reply` restored; `watchlist_available` and `new_episode` written once a day per user by `refresh-watchlist` from their own list; actor-less rendering on the bell page | `migrations/098`, `app/api/cron/refresh-watchlist/route.ts`, `vercel.json`, `notification/page.tsx` |
| **6** Recaps | On This Day on home, filtered to positive memories; a monthly card at `/app/profile/[id]/month/[yyyy-mm]` with a doorway on home in the first week; Year in Review re-ordered (people, comfort watch, rewatches; counts last) | `OnThisDay.tsx`, `monthInReview.ts`, `MonthInReviewCard.tsx`, `YearInReviewCard.tsx` |
| **7** Cards | "We watched X. you 8, priya 6" as a sendable line and a downloadable image; a list's share link and collaborators on the list page | `WeWatched.tsx`, `ListPeople.tsx` |
| **8** Calendar and sets | A 52-week diary calendar on the profile, no streak anywhere; "Seen 3 of 46" on a person's work and on any list | `DiaryCalendar.tsx`, `SeenOf.tsx`, `PersonWork.tsx`, `ListDetail.tsx` |
| **9** New on your services, leaving soon | Daily catalog snapshots per held service; a "new this week" shelf on home; "leaves X on the 30th" on the watchlist when a dated source is configured | `refresh-watchlist`, `NewOnYourServices.tsx`, `migrations/099`, `app/watchlist/page.tsx` |
| **10** Identity and return | Four people, a comfort watch, a hill to die on; a chosen poster for the four favourites; a welcome-back greeting after 30 days that shows the last three things loved and never the gap | `migrations/100`, `IdentitySlots.tsx`, `EditTasteInFour.tsx`, `/api/title-images`, `HomeGreeting.tsx` |
| **11** Portability and the empty room | `/app/data` with export as JSON and as a Letterboxd-readable CSV, the importers, and a plain statement; "Your data" in every menu; `regional_watching` behind a floor of three in the feed's empty state | `app/data/page.tsx`, `api/account/export/letterboxd`, `migrations/102`, `RegionalWatching.tsx` |
| **12** A supporter tier | Not built, by design | — |

**Not built, and why:** the weekly email (no email provider in the stack); Tonight's "leaves on the 30th" reason (the expiry data only exists with a paid key, and the watchlist already shows it).
