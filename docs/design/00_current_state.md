# Where the design stands today

**Audited:** 3 October 2026, against `main` @ `7c8e03a`.
**Method:** a scripted count of every styling decision in `src/`, a read of the shell and the five key page families, and a signed-out walkthrough of the running app at 375 × 812 (iPhone-sized). Signed-in observations come from the 28 September audit, which walked production signed in; that document was deleted on 3 October with the other pre-redesign design docs and is in git history.

This file records facts. What to do about them is in `PHILOSOPHY.md`, `SYSTEM.md`, `PAGES.md` and `EXECUTION.md`.

---

## 1. The look, in one paragraph

A neutral zinc near-black (`#09090b` page, `#18181b` cards, `#27272a` borders) with Tailwind's emerald `#22c55e` as the only brand colour and IMDb's yellow `#f5c518` for ratings. Geist Sans for everything, including display: the theme defines `--font-display` as the same face as `--font-sans`. Cards are translucent grey boxes with a hairline border and 10-pixel uppercase grey labels. That is the most common "AI dark app" look there is — near-black plus one acid-green accent — and nothing in it comes from film, from a dark room, or from people.

## 2. Measured drift

Counted across 239 `.tsx` files on 3 October 2026.

| Decision | Uses | Distinct values | Files |
|---|---:|---:|---:|
| Surface background classes (`bg-surface-*`) | 751 | 37 | 171 |
| Surface text classes | 1,242 | 10 | 172 |
| Surface border classes | 476 | 21 | 134 |
| Brand colour classes | 647 | 40 | 116 |
| Raw Tailwind hues (amber, purple, blue, pink, rose…) | 452 | **133** | 83 |
| `white/…` and `black/…` overlays | 585 | 30 | 148 |
| Hex literals in components | 79 | 43 | 11 |
| `rgb()`/`rgba()` literals | 129 | 72 | 15 |
| Arbitrary pixel text sizes (`text-[10px]`…) | 143 | 6 | 64 |
| Radius classes | 895 | 8 | 173 |
| Content widths (`max-w-*`) | 142 | **29** | 82 |
| Shadows | 104 | 6 | 43 |
| `backdrop-blur` | 32 | 4 | 18 |
| `uppercase` labels | 92 | 1 | 63 |
| Hover lift or scale | 31 | 4 | 24 |
| `animate-*` | 118 | 17 | 68 |

Roughly **3,100 colour decisions are made inline**, in 170-odd files, with no semantic layer between "this is a card" and "this is `bg-surface-900/60`". Changing the theme today means editing every one of them. That is the single biggest fact for the execution plan.

**Icons come from 13 libraries**: `lucide-react` (99 imports) plus twelve `react-icons` sets (Font Awesome 5 and 6, Feather, Ant, Material, Heroicons, Remix, Phosphor, Ionicons 4 and 5, Flat Color, Circum, Lucide-via-react-icons). Stroke weights, corner styles and optical sizes all differ, which is a large part of why the interface reads as assembled rather than designed.

**Motion tokens include** `float`, `glow-pulse`, `scale-pulse` and `spin-slow` — ambient movement that communicates nothing.

**The component layer is mostly fiction.** `globals.css` defines about 70 component classes (`glass`, `card-elevated`, `input-field`, `section-head`, `chip-surface`, `glow-brand`…). Almost none are used: `btn-primary` appears 33 times in 25 files, `glass-card` 11, `nav-icon-btn` and `pill-glass` 9 each, and more than 40 of the rest have zero uses. Pages restyle the same things inline instead. The React components that *are* shared, and therefore the cheapest places to land a new design, are:

| Component | JSX instances |
|---|---:|
| `LoadingSpinner` | 40 |
| `Avatar` | 29 |
| `Section` | 20 |
| `MediaCard` | 15 |
| `StatTile` / `Stat` | 19 |
| `SendMessageModal` | 9 |
| `DeferredSection` | 8 |

Forty spinners is itself a finding: most loading states are a spinning icon rather than the shape of what is coming.

## 3. The shell

- **Header, desktop:** logo, a search field, then icon buttons for People and Clubs, a green "Tonight" pill, Quick add, notifications, messages, and an avatar menu that holds Watchlist, Browse, Lists, Import, Data and more. Eight-plus targets, most of them identical icon squares.
- **Header, phone:** logo, search, and a burger. **There is no bottom navigation.** Everything except search is one tap deeper than it should be on the device people use at 11pm on a couch.
- **Footer:** a GitHub link and the TMDB credit. A product footer on every app page.
- **Toasts** hard-code `#22c55e` and `#ef4444`.

## 4. Page by page

Heights are measured on the running app at 375 px wide, signed out. One "screen" is 812 px.

### Film page (`/app/movie/[id]`, Inception)
**12.2 screens tall.** Order: back link → a 280-px poster centred over the backdrop → the film's logo art as the title → metadata → tagline → overview → Track / Favorite / Trailer / Share (Share wraps alone onto a second row) → a reference card (genres, runtime, languages, countries, studio, box office, external links, eleven keyword chips) → *Who's here* → *Where to watch* (every rent and buy shop as its own row) → *Your entry* → release timeline → cast → crew (including assistant directors) → five video shelves → TMDB reviews → twelve related films.

What a person came to do — log it, rate it, see what friends thought — is split between screen 1 (Track) and screen 5 (Your entry). People appear on screen 4, after keywords. The film's own art is shown three times before the first sentence about it.

### Series page (`/app/tv/[id]`, Breaking Bad)
**12.3 screens.** Same hero. *Your progress* comes right after the hero, which is right. *Your entry* is ninth of ten sections, after cast, crew and media.

### Episode page (`…/season/1/episode/1`)
**4.0 screens.** Breadcrumb, an episode badge, date and rating chips, the title, then **three identical dashed "Hidden until you've watched it" boxes** stacked one after another (overview, thread, stills), with a floating "Next" button between them. The spoiler gate is the right idea presented three times. Dates are US-formatted (`1/20/2008`) regardless of locale. The console logs a duplicate React key (`66633`) and four 401s from signed-in endpoints called while signed out.

### Profile (`/app/profile/[id]`)
**8.1 screens** for a public profile. A banner-less header, the default grey silhouette avatar, `@username`, then Following/Followers buttons and **four stat tiles (498 movies, 82 shows, 578 this year, 8,000 episodes) as the identity**. A horizontally scrolling section tab bar. Then a generated sentence ("ray loves Drama and Comedy…"), genre chips, favourites. The signed-in audit counted fourteen sections, including privacy and completeness controls for the owner, inside one page. The people this person watches with are below the fold, below the counts.

### Home (`/app/page.tsx`)
A full-width trending carousel hero first, for everyone. Then a greeting, then a two-column layout: a 340-px sidebar (airing soon, people you may know) and a main column of Continue watching → On this day → a "What are we watching tonight?" banner → *What people are saying* → popular reviews → new on your services → trending → browse by genre. The signed-out version shows the same carousel, a "Join the community" card, skeleton rows, and a grid of trending cards. The thing the product is about — specific people — enters as the fifth block.

### Discover people (`/app/profile`)
Sorted by "Recently active / Most logged / Most favorites / Biggest watchlist". Each card shows **watched / favorites / watchlist counts** under a coloured initial bubble. People are ranked by database volume.

### Cards
`MediaCard` is the one poster card: a translucent grey box, hairline border, a hover lift of 4 px with a shadow, a 5 % image zoom, and up to three badges in 10-px uppercase on blurred black chips over the poster.

## 5. What is worth keeping

These are earned and survive the redesign as behaviour, not as styling:

- **Spoiler gates** on episode pages — the idea is right, the presentation repeats.
- **Your progress first** on a series page.
- **Watchlist lanes** — Lined up, From people, Someday — already organise saves around people and occasion.
- **Who's here** on a title page, and its honest small numbers ("Only 2 people here have seen this").
- **Taste in 4, identity slots, people you watch with, the diary calendar, month and year recaps** — the profile's raw material is strong; its order is wrong.
- **The logo art as the title** — a genuinely nice touch, once, not three times.
- **Cost discipline** — no prefetch storms, deferred sections, server-rendered browse, nothing crawlable. The redesign must not spend any of it.

## 6. The diagnosis

1. **The palette is the generic one.** Near-black zinc plus a single green is the default dark-app look, and it carries no warmth and no sense of other people.
2. **Every page is a reference document.** Film and series pages are twelve phone screens long, and they lead with catalogue facts. The decision the person came to make is scattered.
3. **People arrive late everywhere.** Friends' takes are below keywords; companions are below stat tiles; the following feed is the fifth block on home; discover ranks people by row counts.
4. **There is no system.** 3,100 inline colours, 133 one-off hues, 29 widths, 13 icon families. Any redesign that does not first install a semantic layer will be repainted by hand, page by page, and drift again.
5. **The phone is second-class.** No bottom navigation, a centred 280-px poster above the fold, buttons that wrap into orphans, and a burger hiding everything but search.
