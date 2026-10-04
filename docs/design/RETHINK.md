# People first, cinema between them

Every feature in letsee, taken apart and put back together around one idea: **the product is about people, and films are what passes between them.** Written 3 October 2026, second pass, after the owner rejected the first colour direction as brownish and playful and asked for a deeper rethink of the logic, not just the look.

This file decides *what* the product is and *how each part behaves*. `PAGES.md` turns it into screens, `SYSTEM.md` into parts, `EXECUTION.md` into an order of work.

---

## 1. The shift

**Today** the title is the centre of the product. Statuses, ratings, takes and lists hang off a title; people appear as followers, a feed, and a "Who's here" box on screen four of a film page. The app is a catalogue with social features attached.

**From now on** the person is the centre. Each relationship you have is a place. A film is the thing two people watched together, passed to each other, argued about, or plan to see. The catalogue is still all there — it is how you find the thing — but nothing on a screen starts with it when a person could start it instead.

### The objects

| Object | What it is | Today | Change |
|---|---|---|---|
| **You** | your record: viewings, words, your four, your queue | the profile | unchanged in substance; settings leave it |
| **Person** | someone on letsee, as much as they chose to show | profile page | faces before counts |
| **Your people** | the small set you actually have something with: watched together, passed films, talked, follow each other. Ranked by closeness, not follower count | does not exist; "following" stands in | **new** (§5) |
| **Room** | the shared place between you and one person, or a small group. Conversation plus everything that passed between you | split across Messages, Tonight, Clubs, notifications, co-log invites | **new** — one object replaces five features (§4) |
| **Viewing** | a dated event: what, when, where, who was there | `viewings` + companions (095–096) | shown as a stub everywhere |
| **Pass** | a film one person gives another, with words, followed until it is watched, closed with a thank-you | `title_recommendations` (097), mostly invisible | **elevated** to a first-class act (§6) |
| **Plan** | something you intend to watch: when, with whom | watchlist + save context | lives in Up next and in rooms |
| **Take** | your words about a title, season or episode, with who can see them | `takes` with public / private | adds **Us** (§7) |
| **List** | a collection, alone or shared | lists + collaborators | shared lists live in rooms |
| **Title, episode** | the film or show itself | the centre of everything | the thing between people |

---

## 2. Navigation

**Home · Search · Up next · People · You**, labelled, on every page. **Log it** is an action: on every title and episode, and in the top bar of Home and Up next.

| Tab | Holds | Replaces |
|---|---|---|
| **Home** | what is for you now, your people, what they watched this week, a memory. Changes with the time of day (§3) | the feed, greeting, sidebar, hero carousel |
| **Search** | titles, people, lists; browsing, trending, new on your services, natural-language search | Search, Browse, Discover people, genre explorer, trending |
| **Up next** | your queue: next episodes, passes from people, plans, someday | Watchlist, continue watching, airing soon, TV calendar |
| **People** | your rooms, newest first; requests at the top | Messages, Notifications, Clubs, Tonight entry, co-log invites |
| **You** | your profile, diary, lists, stats, recaps; Settings inside | profile, profile setup, data, import |

The previous draft had an Inbox tab. **People replaces it**: a room list *is* an inbox, organised by who rather than by event type, which is the whole point.

---

## 3. Home, in every state

Home is the page that decides whether someone comes back. It has four states, chosen in this order.

### 3a. Signed out, arrived cold — the front door (`/`)
- **Job:** in one screen, make a stranger understand that this is for them *and someone else*, and get them to start with that person.
- **Shape:** the mark · one line in the voice: **"Keep the films you watch, and the people you watch them with."** · one example stub (*Past Lives* · Fri 14 Mar · with Priya) · three plain lines: *Log in one tap and say who was there. Pass a film to a friend and find out when they watch it. Decide tonight's film together.* · **Start with someone** (sign up, then invite one person) · Sign in · "Bring your history from Letterboxd, Trakt, TV Time, IMDb or Netflix".
- **Not here:** trending posters, counts of users, testimonials, a feature grid.
- Signed-in visitors to `/` go straight to Home.

### 3b. Signed out, arrived through someone — the invited door (`/p/[token]`)
This is how a people product actually grows, so it gets its own page per thing that can be shared. Each is noindex, cached, and costs one read.

| Shared thing | What the visitor sees | The one action |
|---|---|---|
| A pass | "**Priya passed you *Past Lives***" — her face, her words, the film, where it streams | **Save it from Priya** → sign up; the pass is waiting in Up next, still from Priya |
| A stub | "Priya watched *Past Lives* with you on 14 Mar" | **I was there** → sign up; the viewing lands in your diary, linked to hers |
| A room invite | "Priya wants to decide films with you" | **Join Priya** → sign up into the room |
| A Tonight room | who's in, the shortlist, the vote so far | **Vote** → sign up and vote in one go |
| A list | the list with its owner | **Save the list** |

After sign-up the person lands **inside the thing they were invited to**, not on an empty home. Their first person is already there.

### 3c. Signed in, first week — your first people
For anyone with fewer than three people (§5):
1. **Your first people**: invite by link (copies a room invite), find people you know by username, and "Names you've watched with" — people you named on a viewing who aren't on letsee yet, each with **Invite**.
2. **Bring your history** if your diary is empty.
3. What you're watching, if anything.
4. **Logged this week by people in India** (or your region), clearly labelled as strangers, counts only — never dressed up as friends.

### 3d. Signed in — Home, by time of day
The top of Home answers the question a person has at that hour. Clock is the device's; nothing is computed on the server for it.

| When | The first card | Why |
|---|---|---|
| **Evening** (17:00–23:59) | **Tonight**: one suggestion — the next episode you're on, or a pass now available on your services — lit by the film's own light, with **Watch** (logs on return) and **Decide with…** (your top three rooms) | 9 pm is when people open a film app. Decide, don't browse |
| **The morning after** (05:00–12:00), only if last evening left an open intent — a Tonight decision, a next episode, a title you opened | **Last night**: "Did you watch *Past Lives*?" **Yes, with Priya** · **Yes, alone** · **No**. One tap logs it with yesterday's date | Logs are most often lost the morning after. This catches them while the memory is fresh |
| **Any other time** | the first item of *Waiting on you* | — |

Then, always, in this order, each only when it has something:
1. **Waiting on you** — things a person did to you that need you: "Priya says you watched *Dune* together", a pass, a Tonight invite, a reply. Each with its action. At most three; the rest are in People.
2. **Your people** — a row of up to eight faces, ranked by closeness, each with one authored line: *finished Severance last night* · *passed you 2 films* · *watching The Bear*. Tap opens the room. Only things people logged themselves — no "online", no "last seen".
3. **This week** — your people's stubs, grouped when several watched the same film ("Priya and Kabir +1 watched *Challengers*"). It **ends**: "That's everyone this week."
4. **A memory** — on days that have one: "A year ago today you and Priya watched *Past Lives*." Each memory has **Hide** and **Show Priya less**.
5. **One next step** — invite someone, or pass something on, or bring your history.

**Never on Home:** trending, genres, strangers' popular reviews, algorithmic recommendations, counts, a carousel, a "welcome back after 37 days" line.

---

## 4. Rooms

**Every person you watch with has a room.** So does every small group. A room is the conversation with them *and* everything that passed between you, in one timeline. It replaces Messages, Tonight's entry point, Clubs, co-log invites and most notifications.

### A room with one person (`/app/people/[username]`)
- **Header:** their face and name; one line — *12 films together since March 2025*; actions **Message** · **Pass a film** · **Decide tonight** (a Tonight session with just the two of you) · **Log one together**.
- **Between you** (pinned, collapsible):
  - *Together* — a strip of the films you watched together, newest first.
  - *Open passes* — what each of you passed the other that is still unwatched, both directions.
  - *Someday together* — titles you've both saved, plus anything either of you marked "watch with Priya". **New.**
  - *Where you meet* — two or three overlap moments ("You both gave *Aftersun* a 5") and one split as a question ("You split on *Dune*. Ask her"). Never a percentage at the top.
- **The timeline** — messages and events, interleaved by time:
  - a message (text, or a title card that can be saved or logged from the bubble);
  - *You watched Past Lives together · Fri 14 Mar* — the stub;
  - *Priya passed you Perfect Days — "on a slow Sunday"* — the pass, with its state (open / watched / thanked);
  - *Priya finished Severance S2* — only if you both follow that show, and only after you've caught up (spoiler rule);
  - *You both rated Aftersun ★5* — once, when the second rating lands.
- **Rules:** every event was authored by one of you; either of you can hide an event from your own view; blocking removes the room for both; nothing in a room is visible to anyone else.

### A group room (`/app/people/g/[slug]`)
Clubs become group rooms. Same timeline, plus:
- **The pick**, when the group keeps one: a film, a date, who has watched it, the discussion locked until you've logged it.
- **Decide tonight** with the whole group (the existing Tonight flow, now living here).
- Members, and owner tools in a menu.

### The People tab (`/app/people`)
- **Requests** at the top, only when there are any: follow requests, "I was there too" invites from people you have no room with yet.
- **Rooms**, most recent first: face(s), name, the last thing that happened ("Passed you *Perfect Days*"), unread as a white dot.
- **Start a room**: pick a person or several.
- Search within your people.

### Data (no new storage for one-to-one rooms)
A one-to-one room is **derived**: the union of `messages` between the two, viewings where both are present, `title_recommendations` between them, and rating overlaps, read through one RPC (`room_timeline(other uuid, before timestamptz)`) when the room is opened. Group rooms reuse `clubs` / `club_members` / `club_picks`, and `watch_sessions` gains a nullable `club_id`. Hidden events need one small table. All of this is in `EXECUTION.md` §1.

---

## 5. Your people

A short list, computed, that every people-first surface uses.

- **Who is in it:** anyone you've watched with, passed a film to or from, messaged in the last 180 days, or follow mutually.
- **Order — closeness:** co-viewings × 3 + passes in either direction × 2 + a message in the last 180 days × 1 + mutual follow × 1, each halving every sixty days since the last time it happened. Computed in the browser from what the People tab already reads (`src/lib/people/closeness.ts`): no job, no cron, no schema change.
- **Where it is used:** the Home row, the order of rooms, "Your people on this" on title pages, Log's *Who was there* suggestions, Decide-with suggestions.
- **Never shown:** the score itself, or anyone's rank.

---

## 6. The pass

Recommending is the most people-first act in the product and today it barely exists on screen (a save field, a card in a message).

- **Give:** on any title, **Pass to…** → pick one or more of your people → optional words → sent. It appears in their Up next (*From people*) and in your room as an event.
- **Receive:** their face, their words, when, and where it streams for you. **Save**, **Not for me** (quietly declined; the giver is never told), or simply watch it.
- **Close:** when the receiver logs it, the giver is told once, in the room: *Priya watched Perfect Days — ★4½ — "you were right about the ending."* The receiver is offered **Say thanks** with their rating and a line pre-filled. **New**: the thank-you.
- **Never:** reminders to the receiver ("Kabir is waiting"), a count of open passes on a profile, a public tally of who passes most.

---

## 7. Who can see your words

Takes today are public or private. People-first needs a middle: **Just me · Us · Shelf**.

- **Just me** — your diary.
- **Us** — the people who were there (the viewing's companions) and the room it belongs to. Default when you named someone.
- **Shelf** — your profile, for anyone allowed to see it.

One word under the log sheet, tappable. Needs one migration (`takes.visibility`).

---

## 8. Every feature, dissected

**K** keep · **R** rethink · **M** merge into something else · **X** remove · **N** new. "Today" is what the code does now.

### Logging and the diary
| Feature | Today | Verdict | From now on |
|---|---|---|---|
| Mark as watched | a status pill; creates a dated viewing since 095 | **R** | **Log it** is one tap: logs today, toast with Undo and *Add details*. The status follows from the log |
| Statuses | watchlist, watching, watched, on hold, dropped | **R** | shown as four words: *Want to watch · Watching · Watched · Stopped* (on hold and dropped become *Stopped*, with "maybe later" as an option). Data unchanged |
| Viewings, rewatches, place | 095 | **K** | shown as stubs |
| Who was there, "I was there too" | 096, co-log invite notification | **K** | invite arrives in the room; the shared viewing becomes a room event |
| Quick add (bulk) | its own page | **M** | Log's search-first mode; bulk ticking stays for onboarding |
| Diary calendar | profile | **K** | You → Diary |
| Rewatch prompt | composer | **K** | — |
| Episode tracking, bulk, complete series | several routes | **K** | the episode *moment* after logging (rating, a feeling, who was with you) |
| Continue watching, airing soon, TV calendar | home, sidebar, profile | **M** | Up next → *Next episodes* and *This week* |
| The morning-after log | — | **N** | §3d |

### Words and ratings
| Feature | Today | Verdict | From now on |
|---|---|---|---|
| Ratings (½ to 5 stars, stored 1–10) | everywhere | **K** | in comparisons, each score sits next to its person's face |
| Takes (title, season, episode) | one place to write since 065 | **R** | adds *Us* visibility (§7) |
| Comments and season threads | on titles and episodes | **R** | friends' takes first; episode threads locked by your progress, labelled with the episode |
| Reactions | likes and reactions | **R** | names, never counts ("Priya, Dev — same"), with Reply beside |
| Popular reviews from strangers | home | **M** | title pages, after your people; Search |
| TMDB reviews | title pages | **K** | folded at the bottom, labelled "From TMDB" |

### Plans and passes
| Feature | Today | Verdict | From now on |
|---|---|---|---|
| Watchlist with why, when, who | lanes on `/app/watchlist` | **R** | Up next: *Tonight · Next episodes · From people · Lined up · Someday* |
| Recommendations between people | `title_recommendations`, closed by a viewing | **R** | the **pass** (§6), with the thank-you |
| Title card in a message | becomes a recommendation | **M** | sending a card in a room *is* a pass |
| Someday together | — | **N** | in each room (§4) |
| Availability alerts, leaving soon | daily job | **K** | one line on the Up next item; one notification a day at most, about your own list |
| Algorithmic recommendations | `/api/recommendations`, collaborative | **R** | *More like this* on title pages and Search only; never on Home |
| Ask your people | — | **N** | from Up next or a room: "Something short and funny for tonight?" — your people answer with a pass. Replaces "recommended for you" as the way to find a film when you don't know what you want |

### People
| Feature | Today | Verdict | From now on |
|---|---|---|---|
| Follow, follow requests, private profiles | yes | **K** | following is how you see someone's shelf; *your people* (§5) is who you share a room with |
| Your people | — | **N** | §5 |
| Discover people, sorted by most logged / biggest watchlist | `/app/profile` | **X** the sorts; **M** the page | Search → People, ranked by what you share |
| People you may know | home sidebar | **M** | Search → People; "Names you've watched with" on first-week Home |
| Taste compatibility | precomputed (093); a percentage on profiles | **R** | ranks people-you-might-know and finds overlap moments; never a headline number |
| Watch companions on a profile | "People you watch with" | **K** | *Watches with*, only people who agreed to be shown |
| Blocks and reports | yes | **K** | adds **Show less** per person (memories, Home row) |
| Waves (`user_waves`) | a table, no surface found | **X** | drop the table after checking it is unused |
| Achievements | tables | **X** | gamification; against the doctrine |

### Talking and deciding
| Feature | Today | Verdict | From now on |
|---|---|---|---|
| Messages | one-to-one threads | **M** | the conversation inside a room |
| Notifications (nine kinds) | bell page | **M** | person-caused ones become room events; the rest (follow requests) are *Requests* in People. No bell |
| Tonight rooms | its own page | **M** | **Decide tonight** in any room; the flow itself stays |
| Clubs | its own section | **M** | group rooms with an optional pick |
| Lists and collaborators | yes | **K** | shared lists appear in the room they belong to |

### Remembering
| Feature | Today | Verdict | From now on |
|---|---|---|---|
| On this day | home | **K** | hideable; *Show Priya less* |
| Month and year recaps | pages and share cards | **R** | people first; a preview with *Edit before you share* before anyone is named |
| "We watched" comparison card | title pages | **M** | lives in the room, on the shared viewing |
| Welcome-back greeting | after 30 days | **R** | no line about the gap; the room events since you left are simply there |
| Stats | profile section | **K** | You → Stats; words first |
| Generated taste sentence, "A true cinephile" | profile | **X** | — |

### Finding films
| Feature | Today | Verdict | From now on |
|---|---|---|---|
| Trending, genre explorer, browse, natural-language search | home and search | **M** | all in Search |
| New on your services, regional watching | home | **M** | Search; regional only on first-week Home, labelled |
| Where to watch | a long list | **R** | one line, your services first; the rest folded |
| Related, franchise | title pages | **K** | a dot on posters your people have seen |
| Two search implementations | `/search`, `/search/[query]` | **M** | one, with the query in the URL |

### Your account
| Feature | Today | Verdict | From now on |
|---|---|---|---|
| Import from six sources | `/app/import` | **K** | offered at sign-up and on empty diaries |
| Export, delete, reactivate | `/app/data` | **K** | You → Settings → Your data |
| Profile setup, privacy toggles, services, region | one 756-line page | **M** | Settings: Profile · Privacy · Services · Notifications · Your data · About |
| Onboarding (`/app/welcome`) | long | **R** | three steps, invite-first: *Bring your history* (optional) → *Ten films* → *Your first person* |
| TV Time landing | yes | **K** | — |
| PWA | yes | **K** | no install nagging |

**Count:** 54 features: 19 kept, 13 rethought, 15 merged into something else, 4 removed and 4 new (the discover-people row is counted twice: its sorts are removed and the page is merged). Across this file there are six new concepts — rooms, your people, the pass with its thank-you, someday together, ask your people and the morning-after log — and two new rules, *Us* visibility and the invited door.

---

## 9. How we'll know it works

Measure people, not minutes.

| Measure | Why |
|---|---|
| Share of viewings logged with someone named | the core people act |
| Passes sent per weekly active person; share closed within 30 days; share thanked | the gift loop |
| Rooms with an event in the last 7 days, per person | relationships alive in the product |
| 30-day retention by number of people (0, 1, 2–4, 5+) | the bet that people bring people back |
| Morning-after cards answered | whether the timing helps |
| **Counter-measures:** notifications per person per week (capped at 7); time in app is not a goal | so none of the above is bought with nagging |
