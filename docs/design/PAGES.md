# Every page

The plan for each of the 37 routes, the four new ones, and the shell around them. `RETHINK.md` decides what each feature is; `SYSTEM.md` gives the parts; this file says, page by page, what is on the screen and in what order. `EXECUTION.md` says when.

**How each entry reads.**
- **Job** — the one decision the page exists for. The first screen serves it.
- **Today** — measured or read on 3 October 2026 (`00_current_state.md`).
- **New order** — blocks top to bottom, using components from `SYSTEM.md` §8.
- **People** — exactly where someone else appears. Every page has an answer.
- **Folded or moved** — what leaves the first screen, and where it goes.
- **Done when** — checks on top of the definition of done in `EXECUTION.md` §5.

Phone heights are at 375 × 812 with every fold closed; a "screen" is 812 px.

---

## 0. The shell

**Tabs: Home · Search · Up next · People · You.** Labelled, on every page; a tab bar on phones, text links in the desktop bar. **Log it** is an action, not a place: on every title and episode, and in the top bar of Home and Up next (`RETHINK.md` §2).

| Element | Today | New |
|---|---|---|
| Phone top bar | logo, search, burger | page title in the voice (the mark on Home); one action on the right — **Log** on Home and Up next, "more" on detail pages. Hides on scroll down on Detail and Collection pages |
| Phone tab bar | none | `TabBar`. People carries a white dot when a room has something new; You shows your face |
| Desktop bar | logo, search, People, Clubs, Tonight pill, Quick add, bell, messages, avatar menu | mark · Home · Search · Up next · People · You · search field · **Log it** · your face |
| Avatar menu, burger | hold Watchlist, Browse, Lists, Import, Data, Clubs, profile | gone; everything has a destination below |
| Footer | GitHub link, TMDB credit | removed from app pages; credit to Settings → About |
| Toasts | hard-coded green and red | `Toast`, one live region, **Undo** on everything reversible |
| Bell, unread counts | numbers | none; a white dot on People |

| Today's place | New home |
|---|---|
| Watchlist, continue watching, airing soon, TV calendar | Up next |
| Messages, notifications, co-log invites | People (rooms, and Requests at the top) |
| Tonight | **Decide tonight** in any room; Home's evening card |
| Clubs | group rooms in People |
| Quick add | Log it, search-first mode |
| Discover people, people you may know | Search → People |
| Browse, trending, genres, new on your services | Search |
| Lists | You → Lists; shared lists also in their room; Search → Lists |
| Import, your data, profile setup | You → Settings |

**Global states.** Not-found and error pages keep the shell and offer Home, Search and Back. Signed-out visitors to a title or profile see the page with actions replaced by one **Sign in** line; nothing personal is fetched (today's episode page fires four 401s). The theme colour, manifest and share images use `bg` and white; a title's share image uses its film light.

---

## 1. Home — `/app`

`RETHINK.md` §3 is the logic; this is the screen.

- **Job:** what is for me right now, and what are my people up to.
- **Today:** a trending carousel first, for everyone; greeting; a sidebar; continue watching → on this day → a Tonight banner → following feed → strangers' reviews → new on services → trending → genres.
- **New order (established):**
  1. Top bar: the mark, **Log**.
  2. **The first card, by time of day:** `TonightCard` in the evening; `LastNightCard` the morning after an open intent; otherwise the first *Waiting on you* item.
  3. **Waiting on you** — up to three `WaitingRow`s ("Priya says you watched *Dune* together · I was there"; a pass; a Tonight invite).
  4. **Your people** — `PeopleRow`, up to eight faces ranked by closeness, each with one authored line.
  5. **This week** — `StubList` grouped by film; ends "That's everyone this week."
  6. **A memory**, when there is one — `MemoryCard`.
  7. **One next step** — pass something on, invite someone, or bring your history.
- **New order (first week, fewer than three people):** *Your first people* (invite link, find by username, names you've watched with who aren't here yet) → *Bring your history* (if the diary is empty) → what you're watching → *Logged this week by people in your region*, labelled as strangers.
- **Folded or moved:** carousel removed; trending, genres, strangers' reviews, new on your services → Search; airing soon → Up next; people you may know → Search.
- **Done when:** the feed ends; no carousel, no count, no trending; a person or something addressed to you is on the first screen whenever one exists; the evening and morning cards appear only at their hours and only with something real behind them.

---

## 2. People — `/app/people`, rooms, and requests

### `/app/people` — the room list (new; replaces `/app/notification` and `/app/messages`)
- **Job:** who reached me, and where do I talk to them.
- **New order:** **Requests** (only when any: follow requests, "I was there too" from people without a room yet) → `RoomRow`s, newest activity first, unread as a white dot → **Start a room** → search within your people.
- **Done when:** no counts anywhere; every row leads with a face.

### `/app/people/[username]` — a room with one person (new)
- **Job:** everything between the two of you, and talking about it.
- **New order:** header (their face, name, *12 films together since March 2025*; **Message** · **Pass a film** · **Decide tonight** · **Log one together**) → `BetweenYou`, pinned and collapsible (films together, open passes both ways, someday together, two overlap moments and one split) → the timeline of messages and `RoomEvent`s → the composer, pinned.
- **Rules:** every event authored by one of you; **Hide** for yourself; nothing is visible to anyone else; blocking removes the room for both.
- **Done when:** a shared viewing, a pass, an overlap moment and a message all render in one timeline; hidden events stay hidden after reload.

### `/app/people/g/[slug]` — a group room (was `/app/clubs/[slug]`)
- **New order:** header (faces, name) → **the pick**, when the group keeps one (film-lit, a date, who has watched it, discussion locked until you've logged it) → **Decide tonight** with everyone → the timeline → members, owner tools in a menu.

### Redirects
`/app/messages` and `/app/messages/[id]` → the room; `/app/notification` → `/app/people`; `/app/clubs` → `/app/people` (groups filter); `/app/clubs/[slug]` → its group room; `/app/tonight` → Home's evening card, or the room the session belongs to.

---

## 3. Up next — `/app/up-next` (was `/app/watchlist`)

- **Job:** choose what to watch next.
- **Today:** lanes (Lined up, From people, Someday) — the right idea — reached through the avatar menu.
- **New order:**
  1. Top bar: "Up next", **Log**.
  2. **Tonight** — what's lined up for tonight, **Decide with…** (your top rooms), **Ask your people** ("Something short and funny?").
  3. **Next episodes** — each show you follow, its next episode with a one-tap check, and your people's faces where they've watched it. "New on Friday" for shows waiting on an episode.
  4. **From people** — `PassCard`s with the giver's face and words; logging one offers **Say thanks**.
  5. **Lined up** — your saves with a when.
  6. **Someday** — the rest, in a grid with search, Film / TV, your services, runtime, leaving soon.
- **Done when:** anything can be marked watched from its row, optimistically, with Undo; closing a pass tells the giver once.

---

## 4. Search — `/app/search` (merges `/app/search/[query]`, `/app/browse`, `/app/profile`, `/app/person`)

- **Job:** find a title, a person or a list; browse when you don't know what you want.
- **Today:** two separate search implementations (490 and 743 lines), a browse page, a discover-people page sorted by row counts, an empty person index.
- **New:** one route, the query in the URL. **Before typing:** recent searches · *New on your services* · *Popular with your people* · trending · browse by genre and mood. **While typing:** scopes **Titles · People · Lists**; title rows show your people's faces and an inline **Log**; people rows lead with what you share ("You both loved *Aftersun*"), never counts. **Browse:** filters in a bar (desktop) or a sheet with an applied-count badge (phone), all in the URL. Natural-language search is a mode of the same field.
- **Redirects:** `/app/search/[query]` → `?q=`; `/app/browse` → `?browse=1…`; `/app/profile` → `?scope=people`; `/app/person` → `?scope=people`.
- **Done when:** one implementation; keyboard navigation through results; 16 px input; no sort by volume exists.

---

## 5. Titles

### `/app/movie/[id]` — a film
- **Job:** log it, or decide whether to watch it, with your people's view.
- **Today:** 12.2 screens; a reference card before people; your entry on screen 5; the poster three times.
- **New order:**
  1. `TitleHero` lit by the film's light: backdrop, a 92 px poster, the title (logo art if it exists), year · runtime · director.
  2. **Your status**, if any: "Seen twice · last 14 Mar with Priya", or "Kabir passed you this · 3 Sep".
  3. `ActionBar`: **Log it** · Save · **Pass to…** · Trailer · more. Sticky once scrolled past.
  4. **Your people on this** — up to three `TakeRow`s ranked by closeness, then *Your people ★4.2 · Everyone ★3.8*. Absent when none of your people has touched it.
  5. `WhereToWatch`, one line.
  6. Overview, three lines.
  7. Jump links: People · Cast · Reviews · Lists · Similar · Details.
  8. Cast, a row of ten (a dot on people you've seen in something); "All 64".
  9. Reviews: your people first, then the community.
  10. Lists containing it, your people's first.
  11. More like this, with faces on posters your people have seen.
  12. `Fold`s: Details (runtime, languages, studios, box office, keywords, release dates, links) · Trailers and clips · From TMDB.
- **Done when:** hero, action bar and the first friend on screen one; ≤ 4 screens; one poster image above the fold.

### `/app/movie/[id]/cast`, `/app/tv/[id]/cast` — credits
- **New:** title strip → search in credits → department chips with counts → rows (headshot, name, role, a dot if you've seen them elsewhere; episode counts on TV). Paginated. Quiet by design; no people layer needed.

### `/app/tv/[id]` — a series
- **Job:** continue it.
- **New order:** `TitleHero` → your status ("Watching with Priya · you're on S3E4") → **next episode card** (still, code, title, runtime, **Watched E04**), season `Progress` with your people's faces above the episode they've reached ("Priya is 2 ahead; her notes open as you catch up") → `ActionBar` → your people's takes, labelled by episode and locked past your progress → `WhereToWatch` → seasons (your progress, who finished) → cast, reviews, lists, similar → `Fold`: details.
- **States:** not started → "Start with S1E1"; finished → "You finished it on 2 Aug · rate the last season".
- **Done when:** the next episode and its check on screen one; ≤ 4 screens.

### `/app/tv/[id]/season/[seasonNumber]` — a season
- **New:** crumb → season chips → "6 of 10 · Priya finished" → `EpisodeRow`s (code, title, date, your check, faces) → unwatched episodes show no still and no overview → checking E5 with E1–4 open offers "Mark E1–4 too?" with Undo → season talk as a `Fold`.
- **Done when:** each row is one 44 px target; no overview text in the DOM for unwatched episodes.

### `/app/tv/[id]/season/[seasonNumber]/episode/[episodeId]` — an episode
- **Not yet watched:** crumb → `S02 · E04 · 52 MIN · 7 FEB 2025` → title → **one** `SpoilerGate` naming what it holds → "Who's watched it": faces and first names only → previous / next pinned above the tab bar.
- **Watched:** the gate becomes **the moment** — your stars, a one-tap feeling, *watched with* pre-filled from the show's companions, a line for your words → your people's reactions, each labelled with how far its writer had watched → overview, stills, guest stars → the community thread.
- **Done when:** one gate; hidden content removed from the accessibility tree; dates locale-formatted; zero console errors signed out.

### `/app/person/[id]` — an actor or director
- **New:** compact hero → **"You've seen 14 of their films"** with those posters first → their work as a collection (search, Film / TV, role, decade, seen / unseen) → "Priya has seen 22 · you both loved *Aftersun*" when it applies → biography and portraits as `Fold`s. No per-card buttons.

---

## 6. People's pages

### `/app/profile/[id]` — a profile
- **Job:** visitor — who is this person to me; owner — my record.
- **Today:** 8.1 screens; four stat tiles as identity; grey silhouette; fourteen sections for the owner; "A true cinephile".
- **New order, visitor:**
  1. Hero: their **face** (88 px), name in the voice, @handle, one line of their own, their bio in italic.
  2. **Follow**, **Open your room** (or **Pass them a film** if you have none).
  3. `BetweenYou` when you share anything; otherwise their four.
  4. Their four, then four people, a comfort watch, *the one they'd defend*.
  5. Watching now — each show with its companion.
  6. Recent diary as stubs, respecting *Just me · Us · Shelf*.
  7. *Watches with* — only people who agreed.
  8. This year — one card linking to month and year.
  9. Sub-pages: Diary · Films · TV · Lists · Reviews (separate URLs).
  10. One quiet line: "418 films · 61 series · since 2025".
- **Owner:** the same with **Edit profile**; *Up next* as the first sub-page; no settings on the page.
- **Folded or moved:** visibility toggles, completeness meter, image editing → Settings; generated taste sentences and "A true cinephile" → removed; stat tiles → the count line and Stats.
- **Done when:** a visitor sees the face and what you share on screen one; no count above the fold; ≤ 4 screens.

### `/app/review/[id]` — a written take
- **New:** title strip with the writer's stars → the writer's face, name, "watched with Priya on 14 Mar" → the words in the voice at `w-read`, gated if marked → reactions as names ("Priya, Dev — same") → **Reply** (opens your room with them, quoting the line).

### `/app/lists` — lists
- **New:** two scopes, **Yours** (create; collaborators as faces) and **From your people**, then popular. Cards are four-poster mosaics with the owner's face. Shared lists also appear in the room they belong to.

### `/app/lists/[listId]` — a list
- **New:** a four-poster mosaic, title, owner and collaborators as faces, "You've seen 12 of 40" → Save, Share, Add → search and sort → rows with each entry's note and whoever added it.

### `/app/profile/[id]/month/[month]`, `/app/profile/[id]/year/[year]` — recaps
- **New:** period switcher → **the people first** ("Your September: 9 films, 4 with Priya") → the headline in words → the calendar → stubs → favourites → share. Before a recap names anyone, the owner sees a preview with **Edit before you share** and can remove a person or a film.

---

## 7. Tasks

### Log it (replaces `/app/quick-add`)
- One tap on a title logs it today. From the top bar, Log opens a search-first sheet: in-progress and lined-up titles before typing, then results with one-tap log; a bulk mode for catching up and onboarding. `LogSheet` for details.

### `/app/import` — bring your history
- A stepper: source → upload → check matches → import → "412 films, 38 series, 9 left to match". Progress for anything over ten seconds.

### `/app/profile/setup` → `/app/settings` (and `/app/data` inside it)
- Sections, each saving as it changes: **Profile** (photo, name, bio) · **Taste** (your four, identity slots) · **Privacy** (who sees your diary, *Show less* per person, blocked people) · **Services and region** · **Notifications** · **Your data** (export JSON or Letterboxd CSV, import, delete account — the one typed confirmation in the product) · **About** (TMDB credit).

---

## 8. Doors — signed out

### `/` — the front door
- **New:** the mark → **"Keep the films you watch, and the people you watch them with."** in the voice → one example stub → three plain lines (log in one tap with who was there; pass a film and hear when it's watched; decide tonight together) → **Start with someone** · Sign in → "Bring your history from Letterboxd, Trakt, TV Time, IMDb or Netflix". Signed-in visitors go to Home. Not indexed.

### `/p/[token]` — the invited door (new)
- One page per shared thing — a pass, a stub, a room invite, a Tonight session, a list — showing who sent it and what it is, with one action that signs the visitor up *into* that thing (`RETHINK.md` §3b). Noindex, cached, one read. Tokens expire after 30 days; a pass link works once per recipient.

### `/login`, `/signup`, `/forgot-password`, `/update-password`
- One column at `w-read`, the mark, one form, errors on their fields, password visibility, a pending state, autocomplete attributes, a clear sent state. When arriving from an invited door, the page says whose invitation it is.

### `/app/welcome` — the first five minutes
- Three skippable steps with a progress line: **Bring your history** (optional) → **Ten films you've seen** → **Your first person** (invite by link, find by username, or the person who invited you, already there). Lands on Home's first-week state, or inside the room you were invited to.

### `/tv-time` — importer landing for TV Time refugees
- The Focus template with the import as the one action.

---

## 9. New pages must be added here

Every `page.tsx` added after 3 October 2026 goes into this file and the route manifest (`EXECUTION.md` §2) in the same change. The manifest test fails otherwise.
