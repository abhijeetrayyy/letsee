# A Place to Talk

> **Status:** Steps 1, 2 and 4 shipped. Steps 3 and 5 planned.
> **Written:** 2026-08-17, after `9dbf7f4`.
> **Third in the series**, after `SURPASSING_LETTERBOXD.md` (W1–W7) and `EXPRESSION_AND_DISCOVERY.md` (D1–D5).

---

## 1. The diagnosis, in two numbers

Measured against the live database on 2026-08-17:

| | count |
|---|---|
| logged state changes (`user_media_status`) | **601** |
| pieces of writing (`takes` with a body) | **2** |
| public writing | **1** |
| comments / reactions / notifications | 1 / 1 / 0 |
| users | 3 |

**A 300:1 ratio of logging to talking.** The activity feed was not badly styled; it was faithfully reporting that ratio. Every row read `ray · Watched · Plus Minus` — a coloured badge above a poster — because a state change was all there was to show.

> **The feed showed verbs, not voices.**
> You cannot join a room where nobody is talking. You can only watch a log scroll past.

That reframes the problem. The job is not to display conversation more attractively. It is to **cause the first conversations to exist**, and then to make sure they are not buried under logging.

---

## 2. The principle

`EXPRESSION_AND_DISCOVERY.md:34` sets the test every surface here must pass:

> *"A surface earns its place if a user can arrive at it wanting something specific. If the only honest description of it is 'things you might like', it is a carousel wearing a new hat."*

W2 deleted nine carousels, a leaderboard, achievements and waves. **This document does not reverse that**, and the distinction matters:

- What was cut was **undirected** — shelves, scores, streaks, and a contentless poke.
- What is added here is **directed** — a person said something, and you can answer them.

A row carrying a sentence, a named author and a reply control is a specific thing to want. A row carrying a past-tense badge is not. The one social thing W2 cut was *waves*, and its stated reason was that a poke is contentless — which is an argument **for** utterances, not against them.

**The line that stays uncrossed: rank nothing about people, count nothing about people.** No streaks, no volume, no "top reviewer", no position, no percentage. `SURPASSING_LETTERBOXD.md:245` already settled it — *"the reason is evidence, never a percentage."*

---

## 3. Fear of judgment — the mechanism, not the reassurance

The owner's sharpest instruction, and it is correct: **you cannot remove fear of judgment by telling people not to judge.** "Don't worry, nobody's judging" requires the reader to hold *judged* in mind in order to be reassured of its absence, and a posted reassurance is itself evidence that the problem exists — a sign reading "this neighbourhood is safe" makes you check the locks.

So nothing below is copy that reassures. Every item is a structural choice.

**Never ship reassurance copy.** No "no wrong answers", no "don't be shy", no "everyone's welcome". If a sentence's job is to lower anxiety by mentioning it, delete the sentence and fix the structure instead.

| Mechanism | Why it works | Status |
|---|---|---|
| **A prompt, not a blank box.** "What stayed with you?" rather than an empty textarea. | A blank box asks for *generation* against an unstated standard; a question asks for *completion* against a fact only you have. Nobody can be wrong about what stayed with them. | **Shipped** |
| **Prompts about memory and feeling, not craft.** "Who did you watch it with?", "What did it remind you of?" — never "Rate the direction". | Craft prompts invoke expertise, and expertise invites comparison. Autobiography has no expert. | **Shipped** |
| **Two named actions, not a toggle.** "Keep private" and "Post it" side by side, so publishing is never something you do by forgetting to flip something. | A toggle needs a label describing an audience, and an audience label above a blank box is what makes it feel watched. | **Shipped** |
| **No reaction count on your own writing.** | A visible number attached to something you wrote converts writing into a score you are being marked on. This is the single highest-leverage omission. | **Shipped** |
| **Voices before verbs, always.** | The first thing a newcomer sees must be a person talking, so that talking is what this place evidently does. Ordering is the argument. | **Shipped** |
| **Ordinary writing on top, not "best" writing.** | Ranking reviews by reactions means the first thing you read is the most polished thing anyone has written, and your own draft dies against it. | **Shipped** |
| **Say what the box is for, next to it.** "Your take" vs "Discussion — talk about it with everyone else". | Hesitation is often not fear but *not knowing which box*. Labelling the purpose costs nothing. | **Shipped** |

**On rating before writing.** Asking for a score first anchors the writing to justification — you end up defending the number instead of saying what happened to you. The score should be optional and, where possible, come *after*. The owner said he is "not pushing on it", and that is the right instinct: the number is the least valuable thing on the card.

---

## 4. What shipped (step 1)

**`src/app/api/feed/following/route.ts`** — rewritten.

- Reads **`takes`** as well as `user_activity`. The feed had never touched the table D1 created; new writing could not reach it at all.
- Two row kinds: `take` (somebody said something) and `watch` (somebody watched things).
- **Voices sort above verbs**, then chronologically within each kind. At 601:2, strict reverse-chronological ordering buries every sentence permanently.
- **Collapses the duplicate.** One row per author per title; `watched` and `started_watching` for the same show merge. Root cause: migration `051` deletes only the `watched` row before inserting, while `040` inserts `started_watching` and nothing ever removes it — two triggers on two tables, neither aware of the other.
- **Bundles** an author's watches inside a 6-hour window into one line with up to 4 titles and "and N more".
- **Caps 3 rows per author per page**, so one person's evening cannot be the whole feed — which at three users is not hypothetical.
- Composite cursor (`created_at|id`) on `user_activity`; the old bare-timestamp cursor with a strict `<` dropped rows sharing a timestamp, and migration `045` backfilled many at identical timestamps.
- Drops `favored`, which the CHECK has allowed since `025` and which no code has ever written.
- Reports `isSignedIn`.

**`src/components/feed/FeedRow.tsx`** — new, replaces `ActivityCard.tsx`.

The old card rendered a coloured verb badge as the headline and put whatever the person wrote beneath it in `text-xs text-surface-400 italic line-clamp-2` — smaller, dimmer and greyer than the film's title. **The page shouted the verb and whispered the voice.** Inverted: the sentence is now the largest, brightest element; the poster demotes to a context strip; the verb survives only as a preposition — "ray · on WeCrashed". A watch is not a card at all, just a quiet line.

**Copy.** The section is "What people are saying", not "Activity Feed". A signed-out visitor is told "From across LetSee" rather than the previous "Your activity, and others watching now" — which was said to people who have no activity.

**Two live bugs fixed on the way:**
- **Club comments never worked.** `comments/route.ts:60` allow-listed `["movie","tv","review","episode","club_pick"]` while the clubs page mounts `itemType="club"`. Every attempt to post in a club returned 400.
- **"Discussion" was printed twice** on both detail pages — a `Section title="Discussion"` wrapping a component with its own `<h3>Discussion</h3>` — and the TV page additionally wrapped `YourTake` in a competing "Your Activity — Rate and review" heading. Two boxes under four headings is exactly the "where do I write?" confusion.

### Evidence

Before, from the live page:

```
ray  Watched          Today  Plus Minus
ray  Watched          Today  Dhindora
ray  Started Watching Today  Dhindora     ← same show, twice
ray  Watched          Today  Taaza Khabar
```

After:

```
What people are saying
From across LetSee

RA  ray · on WeCrashed · 3 Feb
    masti amul ki
    [poster] WeCrashed  ★ 5              ↩ Reply

RA  ray watched Plus Minus, Dhindora, Taaza Khabar, TVF Tripling and 24 more · today
RA  ray watched Super Deluxe, Pushpa: The Rise, Chaaver, Love Hostel and 28 more · today
```

Verified: first row is a `take`; no author+title pair appears twice; "Discussion" appears once per detail page; `POST /api/comments` with `itemType: "club"` reaches auth (401) rather than being rejected (400).

---

## 5. The bug that blocked step 2 — fixed

`takes_identity_key` is `UNIQUE (user_id, item_id, item_type, scope, season_number, episode_number, **is_public**)`, and `saveTake` upserts on that key.

**So flipping a take from private to public inserts a second row rather than moving the first.** There is no unpublish path, and one user in the live database already has two rows for one title — one public, one private. That silently recreates the "two texts" problem D1 was built to eliminate.

**Fixed in `saveTake`, not in the schema.** The two-row shape is intentional for the *backfill*, where a private diary entry and a public review genuinely were two different pieces of writing, so the constraint stays as it is. Instead the save now looks before it writes:

- **Exactly one existing take** → the composer is editing that one, so a visibility change **moves** it (delete, then insert at the new visibility). No duplicate, and unpublishing works.
- **Two existing takes** → the legacy split from the backfill. Each stays separately addressable and neither is destroyed.

Not yet verified end to end: the toggle path needs a signed-in account, which this session does not have. The read side is verified — the feed shows only `is_public` rows.

---

## 6. What's next, in order

### Step 2 — shipped

`src/components/takes/TitleTalk.tsx` replaces `YourTake` **and** the `Discussion` section on both detail pages. One composer, one thread. The prompt is the placeholder and there is no heading above the box telling you what kind of writing belongs in it — that question is the one that stops people. Rating sits *after* the text and is optional. Two named buttons, "Keep private" and "Post it", rather than a toggle plus Save. Below, everyone's public takes and replies are one chronological thread.

Season and episode scopes still use `YourTake`; unifying those is the same change one level down.

### Step 4 — shipped

`/api/reviews/popular` no longer ranks by reaction count. It rotates by **coverage**: one piece of writing per title, one per author, newest first, with no counts rendered. The heading is "What people wrote", not "Worth reading this week" — both the heart icon and the word "worth" framed the row as a selection of the best, which is the comparison that stops someone posting their own three sentences.

### Step 2 (original plan) — one place to write. Prompt-as-placeholder instead of a blank box; private by default with publication as a separate, reversible act; merge the take and the discussion box so there is one obvious place to type. **Unblocked** — see §5.

The shape it should take, so the next session does not re-derive it: **one composer, one thread.** Today a detail page has *your* box and *everyone's* box, and the reader has to decide which their thought belongs in before they have finished having it. Instead: a single "Talk about it" section with your composer at the top and one thread below it, where a public take is simply the first thing you said and comments are replies to it. The private/public choice stops being a choice between two boxes and becomes one control on one box — which is what D1 set out to do and stopped one step short of.

**Step 3 — replies that reach someone.** A take should be answerable in the feed, and the answer should notify its author. The like→notification path was already found severed once (W7); the same check applies here.

**Step 4 — ordinary writing, not best writing.** `PopularReviews` currently ranks by reaction count. Rotate by coverage instead, so the home page shows *a* voice rather than *the winning* voice.

**Step 5 — presence, honestly.** See below.

---

## 7. What would be a lie today

The owner asked for pop-ups and notifications about who is watching what, and "people like you have watched this". Both are right in principle. Neither is honest at three users.

- **There is no realtime anywhere.** Zero `supabase_realtime` publications in any migration; zero `.on('presence')` or `.track()` in `src/`. A green "watching now" dot would be a decoration, not a fact.
- **"People like you" needs people.** `related_by_audience` (migration `066`) is applied and correct, and returns nothing, because the busiest title has 2 watchers against a k-anonymity floor of 5. That floor exists for a real reason: `title_audience` **names** watchers on the same page, so a small co-watch count plus a named audience identifies individuals.
- **A "someone is watching something" toast carries no utterance.** It is the same object as the wave W2 deleted, in a new shape. If a notification's job is re-engagement rather than delivering something a person said, it does not ship.

**The honest version of presence is asynchronous**: *someone answered you*, *someone wrote about a film you watched*. Those are true at three users and become better at three thousand. Build those; leave the green dots until there is something behind them.

---

## 8. The open question

Everything here assumes the answer to "why would anyone write the first one?" is *a good prompt and a low-stakes default*. That is a hypothesis, and at three users it cannot be tested. The measurement that would settle it is the ratio in §1: **601:2 today.** If step 2 ships and that ratio does not move, the problem is not the interface, and this document should be rewritten rather than extended.
