# The system

Every token, rule and component the redesign uses. `PHILOSOPHY.md` says why; this file says exactly what. Where a value came from research, the note is cited as `research/0N`.

**Status:** specification, 3 October 2026, second pass. The first pass (a wine-velvet base, a peach accent and nine pastel person colours) was rejected by the owner as brownish and playful. This pass is monochrome and confident: the interface is graphite and white, and colour comes only from films and faces. Nothing here is implemented yet; `EXECUTION.md` is the order of work.

---

## 0. How the layers work

```
primitives  →  semantic tokens  →  components  →  page templates  →  routes
oklch values    bg, text, line,     one file       seven families    37 routes
                film, state         each, in        (§10)             (PAGES.md)
                                    src/components/ds/
```

- **Source of truth:** `src/design/tokens.json` in the W3C design-token format (stable since October 2025, research/05 §8). A small build step writes `src/design/tokens.css`, which `globals.css` imports into Tailwind's `@theme`.
- **Only semantic names reach components.** The theme clears Tailwind's default palette (`--color-*: initial`) and exposes only the names in §1. A component cannot write `bg-zinc-900` or `text-emerald-400`, because those classes no longer exist. Utilities read as `bg-bg-raised`, `text-text-2`, `border-line`. This is what stops drift (research/05 §8).
- **Contrast is tested, not hoped for.** Every text/background pair the tokens allow is declared in the token file and checked by a unit test (`tests/invariants/token-contrast.test.ts`).

---

### 0.1 The names in code

`src/design/tokens.css` is the source. Utilities read as follows; the ink steps keep their old numbers until phase 6 folds them.

| Role | Classes |
|---|---|
| Surfaces | `bg-page`, `bg-raised`, `bg-raised-2`, `bg-overlay`, `bg-hover`, `bg-active`, `bg-muted` |
| Lines | `border-line`, `border-line-strong`, `border-line-input`, `border-line-bold` |
| Text | `text-ink-0` (titles, names), `text-ink-300` (body), `text-ink-400` (secondary, people's words), `text-ink-500` (metadata), `text-ink-600` (quiet labels), `text-ink-700` (disabled) |
| The primary action | `bg-action` with `text-on-action`; `hover:bg-action-hover`; `btn-primary` |
| Emphasis | `text-accent` (white), `ring-focus` |
| Danger | `text-danger`, `bg-danger-fill` |

## 1. Colour

> **Fourth pass — paper and screen (3 Oct 2026, owner review).** The blue-black and marquee-gold pass did not hold together ("dark bluish and yellow doesn't go"); the owner asked for real contrast and suggested a white theme. Now: the app is **light** — warm paper `#f6f5f1`, white cards, near-black ink `#141414` — with one owned colour, a **bright green** (`#1ccf68`, black text on it) for the primary action, chips that are on, progress and presence; green text is a darker `#0a7a3c` so it reads on paper. **Films are shown on dark bands** — a title's hero, Home's hero, a profile's banner, a memory — which carry `data-theme="dark"` and switch every token inside them to the dark palette (neutral charcoal `#0f1011`, no blue). **Dark** is also a whole-app choice (account menu → Appearance), saved on the device and applied before first paint. Both palettes pass every contrast pair (`token-contrast.test.ts`, 29 pairs each). The paragraph below describes the third pass and is kept for its reasoning about imagery, width and type, which still stand.

> **Third pass (3 Oct 2026, owner review).** The owner found the graphite-and-white system cold: "not very good looking", narrow, nothing that makes people want to spend time or come back. The values below §1.1–1.3 are superseded by `src/design/tokens.css`: a deep **blue-black** base (`#0b0c12`, a cinema with the lights down), **paper-white** text (`#f6f4ef`), and one owned colour, **marquee gold** (`#ffc44d`) for the primary action, focus, stars, eyebrows and people's moments (the ring around a face, an unread dot). Films still supply every other hue, now far more of it: Home opens on a full-bleed **hero** lit by the film's own poster blurred across the width, profiles open on a **banner** lit by the person's first favourite, and posters on shelves are 144–176 px instead of 96–112. **Width:** Home, People, Up next, Search and profiles use `max-w-app` with a right-hand rail on desktop (people to watch with, the next step); `max-w-read` is for reading — forms, reviews, a search field, episode and season pages. **Type:** headings at weight 500, page titles 3–3.75 rem, section titles 1.5–1.875 rem. **Life before you have people:** Home shows *On letsee lately* (everyone's recent logs, with faces), *Popular on letsee*, *New on your services* and *Trending now*, so it is never a single screen of instructions. None of this is a per-person colour, a pastel or a brown base — the first pass's rejections still stand.


**The rule:** the interface is graphite and white. Colour belongs to the films (posters, backdrops, the film's light) and to people's faces. That is how the products people call mature and beautiful work — Apple TV, A24, Criterion, Mubi keep their chrome neutral and let the pictures carry colour (research/01 §2). Confidence comes from contrast, type and space, not from an accent.

### 1.1 Surfaces — graphite

A true neutral with the faintest cool bias (hue 265, chroma ≤ 0.006), so posters keep their own colour and nothing reads brown, green or purple. Elevation is lightness plus a hairline.

| Token | OKLCH | Hex | Use |
|---|---|---|---|
| `bg-sunken` | 0.120 0.003 265 | `#050607` | bars, the dark behind a hero |
| `bg` | 0.155 0.004 265 | `#0b0c0e` | the page |
| `bg-raised` | 0.195 0.005 265 | `#141517` | cards, rows, stubs |
| `bg-overlay` | 0.235 0.006 265 | `#1d1e21` | sheets, menus, popovers, toasts |
| `bg-hover` | 0.275 0.006 265 | `#26282b` | hover, pressed, selected, monograms |
| `line` | 0.285 0.005 265 | `#292a2d` | dividers |
| `line-strong` | 0.380 0.006 265 | `#414246` | outlines, the stub's perforation |
| `line-input` | 0.520 0.006 265 | `#67696c` | input and checkbox edges (3.6 : 1, meets 1.4.11) |

### 1.2 Text — white

| Token | OKLCH | Hex | On `bg` | Use |
|---|---|---|---|---|
| `text-1` | 0.970 0.002 265 | `#f4f5f6` | 17.9 : 1 | titles, body, names, the primary button's fill |
| `text-2` | 0.800 0.004 265 | `#bcbec0` | 10.5 : 1 | secondary copy, people's words |
| `text-3` | 0.680 0.005 265 | `#97989b` | 6.8 : 1 | metadata, dates |
| `text-off` | 0.480 0.005 265 | `#5c5e60` | 3.0 : 1 | disabled controls only |

Today's most common secondary grey, `#71717a` on `#09090b`, is 4.12 : 1 and fails AA for small text (research/05 §6). `text-3` replaces it.

### 1.3 Actions — white on graphite

There is no accent colour. The primary action in each place is a **white button with graphite text** (17.9 : 1): the most confident thing on a dark screen, and the convention of Apple TV and Mubi. Secondary actions are white outlines; quiet actions are `bg-overlay` fills. One white button per region; everything else steps down.

### 1.4 People — faces, not colours

People are shown by their **photo**, or a monogram: their initials in `text-1` on a `bg-hover` circle with a hairline ring. No per-person colour. The first pass gave every person a pastel hue; on a long-lived screen it read as a toy. Faces carry identity better than any colour, and social presence research says the face is the strongest cue there is (research/03 §1.1).

- Onboarding and Settings ask for a photo plainly, once, with a reason: *"Your people will see this next to everything you share."*
- **You versus them** in a comparison is position and label (the friend first, then *You*), never colour. Charts draw you as a solid white line and the other person as a dashed one.
- **Two people together** is two faces overlapping by a third with a 2 px `bg` gap between them (`Pair`). The mark is the same idea: two white circles, the overlap filled.

### 1.5 The film's light

The one place hue is allowed to fill space. A title page is lit by its poster, the way a screen colours the wall behind it.

- **Precomputed, never at request time.** Migration `104_a_title_has_a_light.sql` adds `title_metadata.poster_hue smallint` and `poster_chroma real`, computed once per title from the w92 poster by the title-metadata backfill (the most saturated bright region, weighted by saturation). Sample: *Past Lives* 48, *Severance* 237, *The Holdovers* 30, *Aftersun* 180.
- **Bounded:** wash `oklch(0.27 min(c, 0.05) h)`, glow `oklch(0.55 min(c, 0.10) h / 0.20)`, fading to `bg` by about 480 px (research/01 R6).
- **Where:** a title page's hero, the evening *Tonight* card on Home (lit by tonight's film), a memory card about a film, a room's shared-viewing stub when opened. At most one film-lit region per screen; grids of posters are never tinted one by one.
- **Never:** text, buttons, borders, ratings, focus.
- **Fallback:** chroma under 0.03 (black-and-white posters) → no glow, no invented hue.

### 1.5a States

| Token | Value | Use |
|---|---|---|
| `danger` | `#f66d67` (6.8 : 1) | destructive actions and failed saves: a neutral button with danger text and an icon |
| success, warning, info | — | `text-1` with an icon; the words do the work |
| unread, new | a 6 px `text-1` dot | rooms with something new; never a red badge, never a number |
| `focus` | `text-1`, 2 px, plus a 2 px `bg` gap | every focusable element; the gap keeps it visible over posters |

### 1.6 Ratings

Stars are white: filled for the rating, hairline for the rest. Next to anyone's rating sits their face, so "Priya ★5 · You ★4½" needs no colour. In a comparison the gap is shown by order, never red against green. Aggregates say whose they are: *Your people ★4.2 · Everyone ★3.8*. Stars are glyphs with a text equivalent ("Rated 4.5 out of 5"); the input is a radio group (research/05 §6).

### 1.7 Images and scrims

- Text over a backdrop or still always sits on a scrim token (`bg` at 85 % or a gradient to it); never trust the image to be dark.
- Posters get a 1 px inner ring at 6 % white so dark art does not melt into the room (research/02 R5).

### 1.8 Charts

Recaps and stats draw you as solid white and anyone else as dashed `text-2`; a film's own data may use its light. Grid lines are `line`; labels `text-3`. Every chart has a text equivalent.

---

## 2. Type

### 2.1 Faces

| Role | Face | Why | Load |
|---|---|---|---|
| **Voice** — titles of films and series, page titles, people's names in headers, and in italic, anything a person wrote | **Newsreader** (opsz 6–72) | The closest free cousin of the Tiempos serif Letterboxd and Mubi use; one file covers 20 px heads to 56 px heroes (research/02 §1) | `next/font/google`, `axes: ['opsz']`, preloaded, 132 KB; italic as a second instance with `preload: false`, 65 KB |
| **Interface** — everything you operate, and every number | **Geist** | Neutral, compact, serious, tabular figures, already shipped (research/02 R1). What made the app generic was Geist doing *every* job, including titles; with the serif carrying the voice it becomes the quiet layer it should be. The first pass tried Figtree; its rounder forms added to the playful feel | already loaded, 29 KB |
| **Stamp** — dates on stubs, episode codes, runtimes | **Geist Mono** | Already shipped; a ticket printer's voice for the one signature object | already loaded, `preload: false` |

Preloaded total ≈ 161 KB latin, cached after the first visit.

### 2.2 Scale

Rem at a 16 px root. Only the two display sizes are fluid; their `clamp()` has a rem-dominant formula so 200 % zoom still works (research/02 §3).

| Token | Face | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display-xl` | voice | `clamp(2.25rem, 1.85rem + 1.8vw, 3.5rem)` / 1.05 | 500 | −0.02em | title hero, recap headline |
| `display` | voice | `clamp(1.75rem, 1.55rem + 0.9vw, 2.5rem)` / 1.1 | 500 | −0.015em | page title, a person's name |
| `title-lg` | voice | 1.375rem / 1.75rem | 500 | −0.01em | section heads with a person in them ("You and Priya") |
| `title` | interface | 1.125rem / 1.5rem | 600 | −0.01em | sheet titles, row titles |
| `title-sm` | interface | 0.9375rem / 1.25rem | 600 | −0.005em | poster captions, two-line clamp |
| `words` | voice italic | 1.125rem / 1.75rem | 400 | 0 | people's words, recap quotes |
| `body` | interface | 1rem / 1.5rem | 400 | 0 | paragraphs, inputs (never smaller) |
| `body-sm` | interface | 0.875rem / 1.25rem | 400 | 0 | secondary lines |
| `meta` | interface, tabular | 0.8125rem / 1.125rem | 450 | +0.005em | dates, runtime, "with Priya" |
| `label` | interface, tabular | 0.75rem / 1rem | 500 | +0.01em | counts, badges; the floor |
| `stamp` | stamp | 0.75rem / 1rem | 500 | +0.06em, uppercase | the stub only |

Rules: nothing under 12 px; no weight under 400; at most one uppercase style, and it is the stamp. When the voice and the interface share a line, the voice gets `font-size-adjust: ex-height 0.53` so the x-heights match.

---

## 3. Space and layout

- **Steps** (multiples of Tailwind's 4 px): 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64. Nothing else without a reason in review.
- **Semantic spacing:** `--stack-tight` 4 (title → meta), `--stack` 12 (blocks inside a card), `--stack-loose` 24 (groups), `--section` 32 phone / 48 tablet / 64 desktop.
- **Gutter:** `max(16px, env(safe-area-inset-left))` on phones, 24 px from `md`, 32 px from `lg`.
- **Widths — three, not twenty-nine:**

| Token | Max width | Used by |
|---|---|---|
| `w-read` | 40rem | reviews, notes, recaps, settings, auth |
| `w-app` | 76rem | every other page |
| `w-sheet` | 32rem | sheets and dialogs on wide screens |

- **Rows:** 44 px compact (episodes), 56 px standard (people, settings), 72 px media (a 48 × 72 poster thumb). Every touch target is at least 44 px tall.
- **Poster grid:** `repeat(auto-fill, minmax(var(--poster-min), 1fr))` in a container query; `--poster-min` 104 / 124 / 140 px gives 3 / 4 / 5 / 6 / 7 columns from phone to desktop (research/02 R7).
- **Shelves:** at most 12 items then a "See all" into a grid; native scroll with snap; arrows only on hover-capable pointers; no dots, no auto-advance.

---

## 4. Shape, depth, glass

| Token | Radius | Use |
|---|---|---|
| `r-xs` | 2 px | thumbnails ≤ 48 px wide |
| `r-media` | 6 px | posters, stills, backdrops |
| `r-control` | 10 px | inputs, segmented controls |
| `r-card` | 14 px | cards, rows, stubs |
| `r-sheet` | 20 px | sheets and dialogs |
| `full` | — | avatars, chips, buttons, the tab bar's Log |

- **Depth:** level 0 `bg`; level 1 `bg-raised` + 1 px `line`; level 2 `bg-overlay` + 1 px `line-strong` + a 1 px top highlight at 5 % white + one soft shadow. No other shadows.
- **Glass:** only the top bar and the tab bar, `blur(12px)` over an 85 %-opaque fill. Never in scrolling content (research/02 R5).
- **Texture:** none. No grain, no noise, no gradients on surfaces. Light comes from films and people only.

---

## 5. Motion

```
--dur-1  100ms  press, toggle, check
--dur-2  150ms  colour changes, fades, exits
--dur-3  200ms  menus, toasts, a spoiler opening, a friend's take arriving
--dur-4  300ms  sheet and dialog enter (exit at --dur-3)
--dur-morph 400ms  poster → title page, only on links that prefetch
--ease-standard  cubic-bezier(0.2, 0, 0, 1)
--ease-enter     cubic-bezier(0.05, 0.7, 0.1, 1)
--ease-exit      cubic-bezier(0.3, 0, 0.8, 0.15)
```

- **Animates:** press feedback, sheets, toasts, optimistic swaps, the poster morph, a spoiler opening, other people's content arriving (opacity and a 4 px rise, once).
- **Never animates:** tab and filter switches, list reordering, anything scroll-linked, anything infinite. `float`, `glow-pulse`, `scale-pulse`, `pulse-soft` and `spin-slow` are deleted.
- **Reduced motion:** one override in `globals.css` resolves every `--animate-*` to `none` and caps crossfades at 150 ms (research/05 verified this reaches every instance in this repo's Tailwind build).
- No animation library.

---

## 6. Icons

- **One family: Lucide** (`lucide-react`, already the most used, 99 imports). The twelve `react-icons` sets are removed.
- Stroke 1.75, sizes 16 / 20 / 24, `currentColor`.
- Navigation icons always carry a visible label. Icon-only buttons carry an `aria-label` and a tooltip on hover-capable pointers.

---

## 7. Imagery

- TMDB sizes by slot: grid and shelf posters **w342**, two-up and hero posters **w500**, backdrops **w780** on phones and **w1280** from `lg`, headshots **w185**, stub and row thumbnails **w154**. Never `original` in a list.
- Plain `<img>` with `loading="lazy"`, `decoding="async"` and explicit dimensions or `aspect-ratio`. The page's largest image above the fold is not lazy. No Vercel image optimisation for TMDB art (it bills per image, research/02 R7).
- Alt text: a poster inside a card that already names the title gets `alt=""`; a standalone hero poster gets `alt="Poster: Past Lives"`.
- Placeholders: `bg-raised` in the image's exact aspect ratio, static. Never a grey shimmer.

---

## 8. Components

All in `src/components/ds/`, one file each. "Replaces" names what gets deleted in the same change.

### Shell
| Component | Anatomy and rules | Replaces |
|---|---|---|
| `TabBar` | Phones only. Five labelled tabs: Home, Search, Up next, People, You. People carries a white dot when a room has something new, never a number. You shows your face. Never hides, except inside the log sheet and inside a room, where the composer takes its place and Back returns to People. Pads for the home indicator and the iOS 26 Safari toolbar. | `BurgerMenu`, mobile header icons |
| `TopBar` | Phones: page title in the voice (the mark on Home) and one action on the right — **Log** on Home and Up next. Hides on scroll down on Detail and Collection pages. | `navbar.tsx` mobile layout |
| `DesktopBar` | Mark · Home · Search · Up next · People · You as text, the search field, **Log it** (white), your face. Opaque, sticky. | `navbar.tsx`, `dropDownMenu.tsx`, `NotificationBell`, `MessageButton` |
| `PageHeader` | Title in the voice, an optional one-line purpose, one action. | about 20 local header patterns |

The footer leaves app pages; the TMDB credit moves to You → Settings → About.

### Actions
| Component | Anatomy and rules |
|---|---|
| `Button` | `primary` (white fill, graphite label — one per region), `secondary` (white outline), `quiet` (`bg-overlay` fill), `danger` (neutral with danger text and an icon). Heights 34 / 42 / 48, fully rounded. Labels name the result. |
| `IconButton` | 44 px target, `aria-label`, tooltip on hover pointers. |
| `ActionBar` | On a title: **Log it**, Save, **Pass to…**, more. Becomes a sticky bar above the tab bar once scrolled past on phones. |
| `Toast` | `bg-overlay`, one polite live region, ≥ 5 s, pauses on hover and focus, **Undo** on every reversible action. |

### People
| Component | Anatomy and rules |
|---|---|
| `Face` | Photo, or initials in `text-1` on `bg-hover` with a 1 px `line-strong` ring. Sizes 20 / 24 / 32 / 44 / 88. Never a grey silhouette. |
| `Pair` | Two faces overlapping by a third with a 2 px `bg` gap. Stubs, shared viewings, invites, room headers. |
| `PeopleRow` | Home: up to eight faces in a scroller, each with a first name and one authored line ("finished Severance"). Opens the room. |
| `TakeRow` | Face · first name · their words in the voice's italic · one meta line ("watched with you · 14 Mar") · their stars. Friends only; strangers use `ReviewRow`. |
| `BetweenYou` | In a room and on a profile you share: films together (a strip), open passes both ways, someday together, two overlap moments and one split as a question. No percentage. |
| `RoomRow` | People tab: face or `Pair` for groups, name, the last thing that happened, time, a white dot when unread. |

### Viewings and passes
| Component | Anatomy and rules |
|---|---|
| `Stub` | The signature object. Left: poster thumb, title in the voice, one meta line, the person's words in italic. A dashed `line-strong` perforation with two notches. Right tear-off: the date in the stamp, the `Pair` or the place, and **Admit 2** when two were there. Sizes `full` and `compact`. **The perforation and the stamp appear nowhere else in the product.** |
| `StubList` | Stubs grouped by day or by film, ending with "That's everyone this week." |
| `PassCard` | The giver's face and first name, their words in italic, the film (poster, title, where it streams for you), and its state — *open · watched ★4½ · thanked*. Actions for the receiver: **Save**, **Not for me**. |
| `RoomEvent` | A line in a room's timeline for anything that isn't a message: a shared viewing (a compact stub), a pass, an overlap moment, a show one of you finished. Authored by one of you; **Hide** for yourself. |

### Home cards
| Component | Anatomy and rules |
|---|---|
| `TonightCard` | Evening only. The film's backdrop with its light, one line of why ("Kabir passed you this · on Netflix · 1h 52m"), **Watch** and **Decide with…** (three rooms as faces). |
| `LastNightCard` | Mornings after an open intent. "Did you watch *Past Lives*?" **Yes, with Priya** · **Yes, alone** · **No**. One tap logs with yesterday's date. |
| `WaitingRow` | Something a person did to you that needs you, with its one action inline. At most three on Home. |
| `MemoryCard` | "A year ago today you and Priya watched *Past Lives*." Film-lit. **Hide** and **Show Priya less**. |

### Titles
| Component | Anatomy and rules | Replaces |
|---|---|---|
| `TitleCard` | Poster (w342, `r-media`, 1 px inner ring) · title in `title-sm` · one meta line. At most two marks on the art: your state top-right (a white check or bookmark on a graphite disc) and the faces of your people who've seen it bottom-left. No rating chips, genre chips or hover lift. | `MediaCard`, `TrackedPosterCard`, ad-hoc cards |

**Built (Oct 2026):** `src/components/ds/TitleCard.tsx` (the card), `src/components/ds/TitleActions.tsx` (the action bar). The logging rules both follow are in `src/lib/logging/titleState.ts`: logging is the only way to mark watched; Log it → Log again; Save only before watching; a series in progress stays in progress; Undo restores exactly. Where logging appears: the action bar on every title (primary), a check on rows and posters in queues (Up next, lists, search results), and nowhere on discovery cards (browse, related, filmographies), which carry only your state mark. A series you've started leads with its next episode instead (`src/lib/logging/episodes.ts`). Also built: `ds/EpisodeRow`, `ds/Progress` (season dots with your people's faces), the one-per-page `SpoilerGate` (`components/tv/EpisodeSpoilerGate`, with **I've watched it**), and `components/tv/useEpisodeMarks` — the only way episodes are marked from a list.
| `TitleHero` | Backdrop at 55 % with a fade and the film's light, a 92 px poster (≤ 16rem on desktop), the title (logo art if it exists, else the voice), one meta line. One poster image, not three. | `TitleHero`, `TitleIdentity` |
| `WhereToWatch` | One line, your services first, "N more to rent" opens the full list in place. | `Availability` |
| `Fold` | A section closed by default with its count in the header ("Cast & crew · 64"). Opens in place; nothing hides behind tabs (research/05 §2). | horizontal tabs, `DeferredSection` placeholders |
| `EpisodeRow` | 44 px row, one check target, code in the stamp, title, air date, faces of your people who've watched it. "Mark all up to here" separately, with Undo. | `EpisodeListWithWatched` rows |
| `Progress` | Season dots: yours filled white; a friend's position as their small face above the dot they've reached. | progress bars |
| `Shelf` / `Grid` | §3 rules. | carousels |

### Input and gates
| Component | Anatomy and rules |
|---|---|
| `LogSheet` | Opens from **Add details** after a one-tap log. No submit button; every field saves as it changes. When (Tonight · Last night · Pick a day) → Who was there (your people first; alone is the default, not a field) → Rating → Your words → Spoilers → Seen by (**Just me · Us · Shelf**, default *Us* when someone is named). Close, Back and swipe all close it. |
| `PassSheet` | Pick one or more of your people → optional words → **Pass**. |
| `Sheet` / `Dialog` | Sheet on touch, anchored popover on desktop. Confirmation dialogs only for irreversible actions, labelled with the consequence. |
| `RatingInput` | Radio group of five stars with halves, arrow keys, clearable. |
| `SpoilerGate` | One per page. Names what it holds and why ("You're on episode 3. This is episode 4."), lists what is folded, **I've watched it** (white) and **Show anyway**. A disclosure button with `aria-expanded`; hidden content is removed from the accessibility tree, not blurred. |
| `SearchField` | 16 px text; recent searches before typing; scopes Titles · People · Lists. |

### States
| Component | Rules |
|---|---|
| `Skeleton` | The exact shape of what is coming, on `bg-raised`, static. Replaces most of the 40 `LoadingSpinner`s. |
| `EmptyState` | Says what to do first and offers it. Never "you have no friends". |
| `ErrorState` | What happened and the one thing to try. |

## 9. Voice and copy rules (for components)

- Buttons say the result: *Log it*, *Save for later*, *I was there too*, *Tell Priya*, *Undo*. The toast uses the same verb: "Logged".
- People by first name; "you and Priya", not "you and 1 other".
- Dates relative within a week ("Friday"), absolute after ("14 Mar"), with the year only when it differs. Locale-aware, never `M/D/YYYY` by default.
- Counts only where the number is the point, and never as a profile's headline.

---

## 10. Page templates

Every route belongs to exactly one family, and renders that family's template from `src/components/templates/` (research/05 recommendation a). A route may not draw its own outer layout.

| Family | Shape (top → bottom) | Routes |
|---|---|---|
| **Focus** | No shell. One column at `w-read`. One headline, one primary action, one secondary link. | the front door, the invited door (`/p/[token]`), auth (4), `tv-time`, welcome |
| **Stream** | What is for you now → people → items by day → a clear end → one next step. Load more, never infinite. | Home |
| **Detail** | Crumb (season, episode) → hero → `ActionBar` → your people → the one thing this page is for → `Fold`s with counts → related. | film, series, season, episode, person, review, list, profile |
| **Room** | Header (faces, one line, actions) → *Between you* (pinned, collapsible) → the timeline of messages and events → composer pinned. Two panes with the room list from 1024 px. New items announced politely. | one-to-one rooms, group rooms (clubs), Tonight sessions inside them |
| **Collection** | Header with count and one action → scoped filters → grid or list of the canonical card → "Showing 40 of 212 · Load more" → empty state. Back restores scroll. | Up next, People (room list), lists, browse, search, cast pages |
| **Recap** | Period switcher → the people first → the headline in words → the calendar → films → share, after a preview. Charts have text equivalents. | month, year, diary, stats |
| **Task** | Title and one-line purpose → steps or one form → progress for anything over 10 s → an outcome screen with the next action. | Log's search-first mode, import, settings (and your data inside it) |
