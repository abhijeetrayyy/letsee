# 02 — Type, space and motion

> Research note for the letsee redesign. Question: what typography, spacing, layout grid and motion system makes a film-and-people product feel crafted, editorial and warm — while staying fast and accessible on a phone?
>
> Status: complete, 2026-10-03. Companion to note 01 (colour); colour values are deliberately left to that note.
>
> Convention: **[E]** = evidence (sourced fact, or a measurement made for this note, method stated). **[O]** = opinion / design judgement.
>
> Current state of the codebase (read, not changed): `src/app/layout.tsx` loads Geist + Geist Mono via `next/font/google`; `src/app/globals.css` uses Geist for sans *and* display, and defines decorative infinite animations (`float` 6s, `glow-pulse` 3s, `pulse-soft`, `scale-pulse`) alongside `--ease-out-expo`.

## 1. Type for film culture

### 1.1 What film-adjacent products actually set

| Product | Type | Notes |
|---|---|---|
| Letterboxd | **Graphik** (Commercial Type) for app + web UI, **Tiempos** (Klim) serif on web; moved from Freight Sans ~2013 | [E] Fonts In Use, incl. a comment from Letterboxd co-founder Matthew Buchanan [1] |
| MUBI | **LL Riforma** (NORM / Lineto 2018) as a custom "MUBI LL Riforma", identity by Spin [2][3]. The live site also loads **Tiempos Text + Tiempos Headline** and a compressed display face ("KCompress") | [E] Fonts In Use [2]; [E] `font-family` declarations in mubi.com HTML, fetched 2026-10-03 [4] |
| A24 | **NB International** + **NB International Mono**; wordmark custom-drawn by Grand Army (~2016) | [E] [5] |
| Criterion Channel | Logotype in **JL Pirelli** (Futura/Deco-like), **Acme Gothic** for titles | [E] Fonts In Use [6] |
| Sight and Sound (Pentagram, 2021) | **Plaak** condensed/semi-condensed (205TF) headlines, Matthew Carter's **Big Caslon** body, masthead from 1970s **Eurostile** logo; "clapperboard" grids | [E] Creative Review [7] |
| Netflix | **Netflix Sans** (Dalton Maag, 2018) replaced Gotham; motives were licensing cost + ownability; caps drawn "cinematic", lowercase "compact and efficient" | [E] GDUSA, Entrepreneur [8][9] |
| Apple TV | **SF Pro** system font with "dynamic optical sizes" that interpolate Text→Display by point size | [E] Apple HIG Typography [10] |

**[E] Pattern:** the two closest analogues to letsee (Letterboxd, MUBI) both pair a quiet neo-grotesk for UI with Klim's Tiempos, a contemporary serif, for editorial voice [1][4]. The prestige brands (A24, Criterion, Sight and Sound) are more extreme — condensed/geometric display faces, mono accents — but they are marketing surfaces, not daily-use apps.

**[O]** The lesson is the *division of labour*, not the specific faces: a serif (or characterful display) carries **titles of films and the words people write**; a neutral grotesk carries **the interface, numbers and metadata**. Letterboxd's look is "generic grotesk + one serif voice", and that restraint is what reads as film-literate.

### 1.2 Candidate free fonts — measured

Method **[E]**: axis ranges from the Google Fonts metadata API [11]; file sizes are the **latin-subset woff2** served by `fonts.googleapis.com/css2` to a Chrome UA (the same files `next/font/google` downloads and self-hosts at build time [12]); x-height = OS/2 `sxHeight / unitsPerEm` of the default instance; features read from GSUB/GPOS of the served files. Measured 2026-10-03.

| Font (role) | Axes on Google Fonts | x-height / em | latin woff2, wght only | + opsz (etc.) | italic file (latin) | `tnum` in served file | GF popularity rank |
|---|---|---|---|---|---|---|---|
| **Inter** (UI) | opsz 14–32, wght 100–900 | **0.546** | 48 KB | 73 KB | separate | yes | **5** |
| **Geist** (UI, current) | wght 100–900 | 0.530 | **29 KB** | — | yes (separate file) | yes | 76 |
| Figtree (UI) | wght 300–900 | 0.500 | **20 KB** | — | separate | yes | 34 |
| Onest (UI) | wght 100–900 | 0.527 | 34 KB | — | none | yes | 67 |
| Instrument Sans (UI) | wdth 75–100, wght 400–700 | 0.510 | 30 KB | 57 KB (wdth) | separate | yes | 85 |
| Hanken Grotesk (UI) | wght 100–900 | 0.493 | 35 KB | — | separate | **no** | 97 |
| DM Sans (UI) | opsz 9–40, wght 100–1000 | 0.504 | 37 KB | 63 KB | separate | **no** | 18 |
| Manrope / Plus Jakarta | wght 200–800 | 0.540 / 0.536 | 25 / 27 KB | — | none / separate | yes | 13 / 32 |
| **Newsreader** (serif) | opsz 6–72, wght 200–800 | 0.426 | 58 KB | **132 KB** | 65 KB | yes | 86 |
| **Fraunces** (serif) | opsz 9–144, wght 100–900, SOFT, WONK | 0.482 | 37 KB | 67 KB (+SOFT 121 KB) | 46 KB | no | 66 |
| Literata (serif) | opsz 7–72, wght 200–900 | 0.507 | 53 KB | 110 KB | 54 KB | yes | 88 |
| Source Serif 4 (serif) | opsz 8–60, wght 200–900 | 0.475 | 51 KB | 122 KB | separate | yes | 49 |
| **Instrument Serif** (display) | none — Regular + Italic only | 0.510 | 15 KB | — | 16 KB | no | 55 |

Findings **[E]**:
- **letsee currently ships the `create-next-app` template's fonts verbatim** — `Geist` + `Geist_Mono` with `variable: "--font-geist-sans"` is exactly the scaffold in vercel/next.js [13]. That is a literal source of "generic".
- `next/font/google` **includes only the `wght` axis by default** "to keep the file size down"; extra axes such as `opsz` must be requested with `axes: [...]` [12]. Without it, Fraunces/Newsreader/Literata headlines render with their **default text cut** (opsz 14–16 [11]) at every size — sturdier, lower-contrast, less "display".
- Opsz costs real bytes: Newsreader 58 → 132 KB, Fraunces 37 → 67 KB, Inter 48 → 73 KB. Narrowing the requested weight range (e.g. `400..600`) did **not** shrink files for Newsreader/Fraunces/Inter (measured) — the API serves full-range files.
- The Google-served builds **strip most OpenType extras**: served Inter has `tnum`, `frac`, `calt` but no `ss0x`/`cv0x`/`case`/`zero`; DM Sans and Hanken Grotesk lack `tnum` entirely (measured in GSUB/GPOS). Anything that needs aligned ratings/dates must pick a UI face with `tnum` in the served file, or self-host the upstream build via `next/font/local`.
- `font-optical-sizing: auto` is the default and is Baseline since 2020, so once `opsz` is shipped it tracks `font-size` automatically [14].
- `font-size-adjust` (two-value syntax, e.g. `ex-height 0.53`) is Baseline 2024 [15] — usable to make a low-x-height serif (Newsreader 0.426) sit at the same optical size as the UI sans (Geist 0.530) when mixed in one line.

How they read on dark at small sizes — **[O]**, from a specimen rendered at 390 px width on `#121110` (12/13/15 px UI lines; 15/20/32 px serif):
- **Geist** and **Hanken** are the most compact (more words per 390 px line); Inter and Onest are widest. Inter's tall x-height makes 12 px metadata the most legible; Hanken looked thinnest at 12 px muted grey. Figtree is the friendliest without being childish and is the smallest file.
- **Newsreader** has the most "film-magazine" voice (closest free cousin of the Tiempos that Letterboxd and MUBI use) but its low x-height makes 15 px body look small next to a sans — needs +1–2 px or `font-size-adjust`.
- **Fraunces** reads warm and a little 1970s (soft, Cooper-ish) — charming for headlines, heavy as body on dark.
- **Literata / Source Serif 4** are the sturdiest on dark at 15 px (low contrast, open counters) but read "book", not "cinema".
- **Instrument Serif** is the most cinematic at ≥24 px (condensed, poster-like; long titles fit 2-up cards) but is cramped below ~18 px and has no bold — display-only.

### 1.3 Shortlist of pairings

| # | Serif / display | UI sans | Preloaded cost (latin) | Character | Risk |
|---|---|---|---|---|---|
| A | Newsreader (opsz) | Geist | 132 + 29 = **161 KB** (+65 KB italic on demand) | Editorial, literate — the Letterboxd/MUBI recipe | heaviest; serif needs size compensation |
| B | Instrument Serif | Geist or Inter | 15 + 29–48 = **44–63 KB** (+16 KB italic) | Poster/cinematic, cheapest | display-only; very widely used on 2024–26 landing pages (GF rank 55) |
| C | Fraunces (opsz) | Figtree | 67 + 20 = **87 KB** (+46 KB italic) | Warmest, softest | can tip into quirky/retro |
| D | Literata (opsz) | Inter (opsz) | 110 + 73 = **183 KB** | Bookish, most robust on dark | reads "reader app" more than film |
| E | Source Serif 4 (opsz) | Inter | 122 + 48 = **170 KB** | Neutral, trustworthy | least distinctive |

## 2. Type on dark

**[E]**
- **Irradiation:** light text on black looks thicker than dark text on white at the same weight; the correction is a slightly lighter weight (and, optionally, slightly more tracking) on dark. Adam Argyle demonstrates doing this with the `GRAD` axis so the perceived weight changes without reflow [16]. None of the shortlisted Google fonts expose `GRAD` (Roboto Flex does [11]), so on letsee the lever is `wght` (e.g. body 400 → 380 with a variable font) — accept that changing `wght` changes advance widths.
- **Thin weights fail:** Apple: "In general, avoid light font weights" — prefer Regular/Medium/Semibold/Bold; Ultralight/Thin/Light "can be difficult to see, especially when text is small" [10]. iOS minimum text size is **11 pt**, default 17 pt [10].
- **Not pure white:** Material's dark theme sets high-emphasis text at 87% white, medium 60%, disabled 38%, because pure white on dark "vibrates"/bleeds [17] (colour itself is covered in note 01).
- **Tracking by size:** Apple ships tracking that tightens through body sizes and loosens again above ~24 pt (SF: +6/1000 em at 11 pt, 0 at 12, −26 at 17, −23 at 20, +12 at 34) [10]. Inter's published "dynamic metrics" formula is `tracking = −0.0223 + 0.185·e^(−0.1745·size)` em — computed: 11 px +0.005, 13 px −0.003, 16 px −0.011, 20 px −0.017, 24 px −0.020, 32 px −0.022 em [18]. Rule of thumb: small text ≥ 0, display text −0.01 to −0.025 em.
- **Leading:** Apple's iOS styles run ~1.29 at body (17/22) and ~1.2 at Large Title (34/41); captions ~1.18–1.33 [10]. Apple also warns: for "three or more lines of text, avoid tight leading" [10].
- **Tabular numbers:** `font-variant-numeric: tabular-nums` (OpenType `tnum`) gives equal-width digits; Baseline since 2020 [19]. Vercel's guidelines prescribe it for numbers that are compared [20]. Ratings (4.5 vs 3.0), dates, episode codes (S02E07), runtimes and counts in letsee are all compared in columns or lists.

**[O]**
- On dark, step **down** one weight notch for body (400 → ~380 if variable) and **up** one for 11–12 px metadata (400 → 450–500) — small grey text is where dark UIs lose legibility, not body.
- Serif display on dark is *helped* by irradiation (hairlines thicken visually), so a high-contrast display serif (Newsreader opsz 72, Instrument Serif) is safer on dark than on white.
- Use **italic serif for people's words** (notes, "why I saved this", recap quotes) — it marks voice without colour or icons, and is the most "editorial" move available.
- Never uppercase + wide-tracked tiny labels as the main way to express hierarchy (it's the current generic dashboard idiom); use one small-caps-style label level at most.

## 3. A type scale

**[E]**
- **How many sizes do products use?** Apple iOS: 11 text styles across 10 distinct sizes at default (34, 28, 22, 20, 17, 16, 15, 13, 12, 11) [10]. Material 3: 15 styles (display/headline/title/body/label × L/M/S), e.g. Display L 57/64, Headline L 32/40, Title L 22/28, Body L 16/24 [21]. Vercel Geist: 29 tokens but built from ~11 distinct px sizes (72…12) split by role: heading / label / copy / button [22]. Linear's redesign added **Inter Display** for headings while keeping Inter for body [23].
- **Fluid type with `clamp()` and zoom:** viewport-unit type can neutralise browser zoom — "if a user cannot get the text to 200%… you may also be looking at a WCAG 1.4.4 Resize text (AA) problem" (Roselli) [24]. Utopia's method interpolates a scale between a min viewport (e.g. 320 px @ 18 px, ratio 1.2) and max (1240 px @ 20 px, ratio 1.25) [25].
- **Line length:** 50–75 characters, absolute max 80 (WCAG 1.4.8) [26].
- Tailwind 4 defaults: `text-xs` 12/16, `sm` 14/20, `base` 16/24, `lg` 18/28, `xl` 20/28, `2xl` 24/32; tracking `tight` −0.025em; leading `snug` 1.375 [27].

**[O]**
- A dense-but-calm social app needs **~10 styles in 4 roles**: display (2), title (3), body (3, incl. a serif quote style), meta/label (2). More than that and hierarchy blurs; fewer and dense screens (episode lists, friend ratings) go flat.
- Use **fixed rem steps for UI** (body, meta, labels, titles in cards) — they must not move with the viewport. Use **clamp() only for the two display sizes**, with rem bounds and a small vw coefficient (≤ ~2vw, e.g. `clamp(1.75rem, 1.55rem + 0.9vw, 2.5rem)`), then test at 200% browser zoom. Roselli's stricter position is to avoid vw in font sizes altogether [24]; confining it to two display tokens limits the exposure.
- Ratio: ~1.2 (minor third) on phone for title steps; display jumps by ~1.33. Strict modular scales produce awkward 13.33 px values; round to whole px and keep line-heights on a 2 px grid (4 px wherever possible).
- Phone minimums: 16 px for reading text and **inputs** (smaller input font makes iOS Safari zoom the page on focus — common practice, see Vercel's guidelines' mobile input rules [20]), 12 px as the floor for metadata and badges (Apple's absolute iOS minimum is 11 pt [10]; on dark, keep 1 px of headroom).

## 4. Spacing and layout

**[E] Systems**
- **8-pt grid + 4-pt baseline:** constraint speeds decisions ("removing 7 of every 8 spacing options"); pair the 8-pt UI grid with a 4-pt baseline for type [28].
- **Tailwind 4** derives every spacing utility from one variable: `--spacing: 0.25rem` (4 px), `p-4 = calc(var(--spacing) * 4)` [27][29] — so a 4-pt system is native; the design work is choosing *which* multiples are allowed.
- **Apple** stresses alignment and grouping: "People assume that aligned items are related… indented items as subordinate" [30]. **Linear's** redesign spent its effort on aligning labels/icons/buttons in sidebar and tabs — "something that you'll feel after a few minutes of using the app" — and moved to a 3-variable LCH theme (base, accent, contrast) [23].
- **Touch targets:** WCAG 2.5.8 (AA) ≥ 24×24 CSS px or spacing equivalent [31]; Vercel: ≥ 44 px on mobile, expand hit area when the visual is < 24 px, `touch-action: manipulation` [20].
- **Safe areas:** `viewport-fit=cover` + `env(safe-area-inset-*)`, combined as `max(16px, env(safe-area-inset-left))` [32]. Vercel lists safe-area handling as a rule [20].
- **Container queries in Tailwind 4:** `@container` on the parent, then `@sm:` (24 rem), `@md:` (28 rem), `@lg:` (32 rem)…, `@max-*`, named containers `@container/name`, `cqw` units [33]. Viewport breakpoints: `sm` 40 rem, `md` 48, `lg` 64, `xl` 80, `2xl` 96 [33].
- **Reading width:** 50–75 characters [26].

**[E] Shelves vs grids**
- NN/g: people "often immediately scroll past" hero carousels; ≤ 5 frames; partially visible ("bleeding") next items are a better cue than dots, which are "particularly poor… on mobile"; avoid auto-advance [34].
- NN/g on horizontal scrolling: users accept it on touch but stay reluctant on desktop; even arrows "frequently remain unnoticed"; acceptable for **secondary** content and for **filmstrips stacked vertically** so people browse categories down and items across — never as the only path to content [35].
- Baymard: 46% of sites with carousels have usability issues; avoid auto-rotation on mobile; static sections "perform equally well" [36].

**[E] Images and cost**
- TMDB sizes: posters `w92 w154 w185 w342 w500 w780 original`; backdrops `w300 w780 w1280`; profiles `w45 w185 h632`; stills `w92 w185 w300` [37].
- Vercel Image Optimization bills transformations, cache reads and cache writes (Hobby: 5K transformations/month; beyond limits new images fail with 402) [38]. letsee mostly uses raw `<img>` with TMDB URLs (56 `<img>` vs 2 `next/image` imports, counted in `src/`) — keep it that way.

**Poster grid math [E: computed]** — 2:3 posters, side gutter g, gap, columns → poster px → TMDB size needed at device DPR:

| Viewport | g / gap | Cols | Poster (px) | Needed @DPR | TMDB |
|---|---|---|---|---|---|
| 360 | 16 / 8 | 3 | 104×156 | 312 @3x | **w342** |
| 390 | 16 / 8 | 3 | 114×171 | 342 @3x | **w342** |
| 430 | 16 / 8 | 3 | 127×191 | 382 @3x | w342 (w500 if crisp matters) |
| 390 | 16 / 12 | 2 (feature) | 173×260 | 519 @3x | **w500** |
| 768 | 24 / 16 | 5 | 131×197 | 262 @2x | w342 |
| 1024 | 32 / 16 | 6 | 147×220 | 293 @2x | w342 |
| 1280 | 32 / 20 | 7 | 157×235 | 313 @2x | w342 |
| 1440 (1216 max) | 32 / 20 | 8 | 134×202 | 269 @2x | w342 |

**[O]** One URL size (**w342**) covers essentially every grid cell from phones to desktop, which maximises TMDB/browser cache reuse; w185 is visibly soft on 3× phones; reserve w500 for 2-up feature cards and the detail hero poster. A horizontal shelf on a 390 px phone with ~108 px posters + 8 px gap shows **~3.3 items** — the cut-off item *is* the affordance [34].

**[O] Layout**
- **Shelves** for discovery rows that are *secondary* and *people-labelled* ("Maya watched", "Saved because of Ravi"), ≤ ~12 items with a "See all" to a grid. **Grids** for anything the user owns or must scan completely (my diary, watchlist, a friend's ratings). Never horizontal-only access to a person's data.
- **Bento** tiles suit one place only: the recap / "your month with friends" page, where tiles of different weight (a hero still, a count, a quote) are the content. Elsewhere bento adds gaps that cost scroll on phones.
- **Density modes** aren't needed as a setting; build density into components (list row 56 px for people/episodes, compact row 44 px for dense episode lists).
- Use container queries for cards that appear in shelves, grids and sidebars (a "viewing card" decides its layout from its container, not the page).

## 5. Radius, borders, depth

**[E]**
- Material 3 shape scale: 0, 4, 8, 12, 16, 20, 28, 32, 48 dp, full [39]. Tailwind 4 radii: `xs` 2, `sm` 4, `md` 6, `lg` 8, `xl` 12, `2xl` 16, `3xl` 24, `4xl` 32 px [27].
- Painting cost: `transform` and `opacity` are compositor-only; `box-shadow`, `filter` and blur trigger paint; `will-change` only on elements "about to change", removed afterwards [40].
- `prefers-reduced-transparency` maps to iOS/macOS "Reduce Transparency" and Windows "Transparency effects", but is **experimental / not Baseline** [41]. Apple's own guidance for its Liquid Glass era is to use a scroll-edge effect rather than solid/semi-opaque backgrounds under controls [30].
- Grain: the common recipe is SVG `feTurbulence` noise layered under gradients, contrast-boosted and blended; Blink and WebKit implement `mix-blend-mode` "slightly differently" [42].
- Low-end phones are far slower than the iPhones designers test on: a Samsung Galaxy A24 is ~4.25× slower single-core than the leading iPhone; Russell's P75 test devices are a Galaxy A51 / Nokia G100 [43].

**[O]**
- **Radius should follow the photograph, not the button.** Posters are physical objects; 4–6 px reads as "printed card", 12+ px reads as "app icon". Use small radii on media, larger on sheets; nest concentrically (inner radius = outer − padding).
- **Hairlines on dark:** 1 px borders at ~8–10% white (or a warm-tinted equivalent) separate surfaces better than shadows, which barely show on dark. Use a 1 px **inner top highlight** (`inset 0 1px 0 rgb(255 255 255 / 0.04–0.06)`) on raised surfaces instead of drop shadows; keep real shadows for overlays (sheets, menus) only.
- **Blur/glass:** only on the sticky top bar and bottom tab bar, small area, static, ≤ 12–16 px radius, with an opaque fallback; never on cards in scrolling lists and never animated (each frame re-blurs the content under it — paint cost on exactly the devices above).
- **Grain:** if used as an analog-film cue, ship it as a tiny pre-rendered tiling PNG/WebP (≈ 2–5 KB) at 3–5% opacity on the page background or hero scrim — not live `feTurbulence`, not `mix-blend-mode` over scrolling content, not animated.

## 6. Motion

**[E] Durations & easing**
- NN/g: most UI animations 100–500 ms; simple feedback ~100 ms; modal-scale changes 200–300 ms; entering slightly longer than exiting (e.g. 300 ms in, 200–250 out); at 500 ms they "feel like a real drag" [44].
- Material 3 tokens: durations short1–4 = 50/100/150/200 ms, medium1–4 = 250–400 ms, long1–4 = 450–600 ms, extra-long 700–1000 ms; "duration should increase as the area/traversal… increases". Easing: standard `cubic-bezier(0.2, 0, 0, 1)`, standard-decelerate `(0, 0, 0, 1)`, standard-accelerate `(0.3, 0, 1, 1)`, emphasized-decelerate `(0.05, 0.7, 0.1, 1)`, emphasized-accelerate `(0.3, 0, 0.8, 0.15)`; springs e.g. fast-spatial damping 0.9/stiffness 1400 [45].
- Apple HIG: "Add motion purposefully"; "generally avoid adding motion to UI interactions that occur frequently"; "Let people cancel motion"; don't make motion the only carrier of information; and, in its visionOS section, avoid sustained oscillation (~0.2 Hz is especially uncomfortable) [46].
- Emil Kowalski: UI animations "should generally stay under 300ms"; never animate keyboard-initiated/high-frequency actions [47].
- Vercel: honour `prefers-reduced-motion`; prefer CSS; animate `transform`/`opacity`; animations must be interruptible; never `transition: all` [20].
- WCAG 2.3.3 (AAA): motion triggered by interaction can be disabled; opacity/colour/blur changes that don't alter position/size are *not* "motion" [48].

**[E] View Transitions in Next.js / React**
- React `<ViewTransition>` is a **canary** API; it activates only inside Transitions, `<Suspense>` reveals or `useDeferredValue`; named pairs (`name=`) morph a shared element; React does **not** auto-respect reduced motion [49].
- Next.js App Router ships React canary, so `<ViewTransition>` works there (current docs: "no configuration"; the installed Next 16.1.6 exposes `experimental.viewTransition` in its config types) [50]. Uses Chromium 125+ features; "Without browser support… the transitions do not animate" [50]. Support: Chrome/Edge 111+, Safari 18+, Firefox 144+ ≈ 92% global [51].
- Crucial caveat: "The morph plays when the destination content renders in the same commit as the navigation… prefetched (cached) pages. If the destination suspends into a fallback first, no pair forms" [50]. letsee's recent commit removed eager prefetch for cost — so a poster→detail morph needs either hover/viewport prefetch on that link or a Suspense-reveal fallback design.
- Next's reference recipe: exit 150 ms, enter 210 ms delayed by the exit, move 400 ms; 60 px directional offset; `::view-transition { pointer-events: none }`; header anchored with its own `view-transition-name`; reduced-motion sets all `::view-transition-*` durations to 0 [50].

**[E] Presence**
- Apple's SharePlay guidance for watching together: when one person's action changes things for everyone, "use in-app cues to show who" did it; make joining frictionless; make leaving/rejoining easy [52].

**[O]**
- letsee motion should be **almost entirely state-change motion**: press feedback, sheet open/close, optimistic "logged" confirmation, poster→detail morph, spoiler-gate reveal. No ambient motion. The existing `float`, `glow-pulse`, `scale-pulse` infinite animations run against Apple's "add motion purposefully" and frequent-interaction guidance (and its visionOS oscillation warning by analogy) — remove them.
- **Presence of people** should be expressed by *arrival*, not *activity*: a friend's avatar fades/settles (150–200 ms opacity + 4 px translate) into a "watched with" stack when the data arrives; a 1-time soft highlight on a newly arrived friend rating; never typing-dots, bouncing badges, confetti, streak flames or pulsing "live" rings — those are gamification cues and imply surveillance.
- Spoiler gates: reveal with a short blur→sharp + opacity (≤ 200 ms), not a slide; it's a "same place, more content" change.
- Low-end Android: one shared-element morph per navigation, only `transform`/`opacity`, no animated filters on large areas (the Next recipe's mid-flight `blur(3px)` is fine on a poster-sized group, not full-screen).

## 7. Loading, empty and error states

**[E]**
- NN/g: < 1 s needs no indicator; 2–10 s use skeletons for full pages and spinners for single modules; > 10 s use a progress bar; avoid "frame-only" skeletons [53]. Response-time limits: 0.1 s feels instant, 1 s keeps flow, 10 s keeps attention [54].
- Counter-evidence: Viget's test (n = 136) found the skeleton screen *worse* — 2.82 s perceived wait vs 2.41 s spinner and 2.29 s blank; 59% vs 74% agreed it "loaded quickly" — and concluded skeletons "aren't a silver bullet" [55]. Evidence is mixed; skeleton fidelity matters.
- Vercel: delay showing loaders ~150–300 ms and keep them ≥ 300–500 ms to avoid flicker; keep the original label ("Saving…"); optimistic updates with rollback/Undo on error [20].
- React 19 `useOptimistic` shows the optimistic state during an Action and reverts automatically when the Action fails; the setter must be called inside an Action/Transition [56].

**[O]**
- Skeletons only where the layout is **known and image-led** (poster grids, a title page hero) and they must match final geometry exactly (same aspect-ratio boxes, same type line heights) — otherwise use nothing for < 1 s. Static tone, no shimmer sweeps (shimmer is ambient motion and repaints); if anything, a single slow opacity fade 0.5→0.7 that stops under reduced-motion.
- Posters: reserve 2:3 boxes with the dominant-colour or neutral surface; fade the image in over 150 ms on load — the box itself is the skeleton.
- Every social write (log a viewing, save with a reason, rate, react) should be **optimistic**, confirmed by an in-place state change, with an Undo toast on failure — never a spinner on the button for a sub-second write.
- Empty states are a **people prompt**, not an illustration: one serif line in the editorial voice ("Nothing logged with Maya yet") + one action ("Log the last thing you watched together"). Errors: plain sentence, what still works, one retry; never a sad-face illustration.

## Recommendation for letsee

Everything in this section is **[O]**: design judgement built on the evidence above.

### R1. Font pairing — Newsreader (voice) + Geist (interface)

- **Newsreader** for film/show titles at ≥ 20 px, page and section titles, and **people's words in italic** (notes, "saved because…", recap quotes). Why: it's the closest free cousin of the Tiempos that Letterboxd and MUBI pair with a grotesk [1][4]; its `opsz` 6–72 covers 20 px section heads to 56 px heroes in one file; it has `tnum`; it reads editorial, not bookish (Literata) or retro (Fraunces).
- **Geist** stays for the whole interface, numbers and metadata. Why: already shipped (no migration risk), among the smallest UI files measured (29 KB; only Figtree, Manrope and Plus Jakarta are smaller), `tnum` present, compact on 390 px lines. Letterboxd's Graphik is a deliberately plain neo-grotesk too [1] — the neutral layer is meant to be quiet. What made letsee generic was Geist doing *every* job, including display, plus decorative motion — not Geist itself.
- **Geist Mono:** drop unless a real use emerges; `tabular-nums` on Geist covers ratings, dates, episode codes.
- Loading (`src/app/fonts.ts`):
  - `Newsreader({ subsets: ['latin'], axes: ['opsz'], style: 'normal', variable: '--font-serif', display: 'swap' })` → 132 KB, preloaded (titles are above the fold).
  - A second instance `Newsreader({ subsets: ['latin'], style: 'italic', variable: '--font-serif-italic', preload: false })` → 65 KB (no `opsz`), fetched only on pages that render a quote.
  - `Geist({ subsets: ['latin'], variable: '--font-sans' })` → 29 KB.
  - Total preloaded ≈ **161 KB** latin; `adjustFontFallback` stays on (default) to limit CLS [12].
- Pairing rule: when serif and sans share a line, set the serif with `font-size-adjust: ex-height 0.53` (or simply +2 px) so x-heights match [15].
- **Fallback options.** (a) Budget: swap Newsreader for **Instrument Serif** (15 + 16 KB) as display-only, ≥ 24 px, with titles below that size in Geist 600. (b) Warmer: **Fraunces** (`opsz`, 67 KB) + **Figtree** (20 KB). (c) If dropping the scaffold font matters to the owner: **Inter** with `opsz` (73 KB), used Linear-style — Display cut for headings, Text cut for body [23].

### R2. Type scale (rem at a 16 px root; tracking in em)

| Token | Font | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display-xl` | Newsreader opsz auto | `clamp(2.25rem, 1.85rem + 1.8vw, 3.5rem)` / 1.05 | 500 | −0.02 | title page hero, recap headline |
| `display` | Newsreader | `clamp(1.75rem, 1.55rem + 0.9vw, 2.5rem)` / 1.1 | 500 | −0.015 | page title, person name |
| `title-lg` | Newsreader | 1.375rem (22) / 1.75rem (28) | 500 | −0.01 | section heads ("This week with Maya") |
| `title` | Geist | 1.125rem (18) / 1.5rem (24) | 600 | −0.01 | sheet titles, list-row titles |
| `title-sm` | Geist | 0.9375rem (15) / 1.25rem (20) | 600 | −0.005 | poster captions (2-line clamp) |
| `quote` | Newsreader italic | 1.125rem (18) / 1.75rem (28) | 400 | 0 | people's words; reading column only |
| `body` | Geist | 1rem (16) / 1.5rem (24) | 400 | 0 | paragraphs, inputs (never < 16 px) |
| `body-sm` | Geist | 0.875rem (14) / 1.25rem (20) | 400 | 0 | secondary lines |
| `meta` | Geist, `tabular-nums` | 0.8125rem (13) / 1.125rem (18) | 450 | +0.005 | dates, runtime, "with Maya, Ravi" |
| `label` | Geist, `tabular-nums` | 0.75rem (12) / 1rem (16) | 500 | +0.01 | badges, S02E07, counts — the floor |

Ten tokens, two of them fluid. Ratings use the context's size at weight 600 with `tabular-nums`. No text under 12 px; no weight under 400 anywhere; at most one uppercase label style (`label` + `uppercase` + 0.06em) for rare section kickers.

### R3. Spacing scale (Tailwind multiples of the 4 px `--spacing`)

- Allowed steps: **0.5 (2), 1 (4), 1.5 (6), 2 (8), 3 (12), 4 (16), 5 (20), 6 (24), 8 (32), 10 (40), 12 (48), 16 (64)**. Nothing else without a reason in review.
- Semantic tokens:
  - `--gutter`: `max(16px, env(safe-area-inset-left))` phone → 24 px ≥ md → 32 px ≥ lg.
  - `--gap-grid`: 8 phone / 16 md / 20 xl.
  - `--stack-tight` 4 (title→meta), `--stack` 12 (blocks in a card), `--stack-loose` 24 (groups).
  - `--section`: 32 phone / 48 md / 64 lg.
- Rows: 44 px compact (episode list), 56 px standard (person, setting), 72 px media row (48×72 poster thumb). Every tappable thing ≥ 44 px tall on touch.
- Max widths: reading column **40rem** (recaps, reviews, notes); app content **76rem** (1216 px); sheets and dialogs **32rem**; poster detail hero poster ≤ 16rem wide on desktop.
- Bottom tab bar and sticky actions pad with `env(safe-area-inset-bottom)`; add `viewport-fit=cover`.

### R4. Radius scale

| Token | px | Use |
|---|---|---|
| `--radius-xs` | 2 | thumbnails ≤ 48 px wide, inline badges on images |
| `--radius-media` | 6 | posters, stills, backdrops, headshot cards |
| `--radius-control` | 10 | inputs, buttons, segmented controls |
| `--radius-card` | 14 | surfaces; with 8 px padding the media inside gets 6 (concentric) |
| `--radius-sheet` | 20 | bottom sheets and dialogs (top corners on phone) |
| `full` | — | avatars, chips, toggles, avatar stacks |

### R5. Borders and elevation (colour values deferred to note 01)

- **Level 0** page. **Level 1** card/surface: one lightness step up + 1 px hairline at ~8% white; no shadow. **Level 2** popover/sheet/menu: one more step + 1 px hairline ~12% + `inset 0 1px 0 rgb(255 255 255 / .05)` top highlight + one soft drop shadow (`0 12px 32px rgb(0 0 0 / .5)`).
- Posters get a 1 px inset ring at ~6% white so dark artwork doesn't melt into the page (draw it with a wrapper `::after`; an inset `box-shadow` on the `<img>` itself is painted under the image).
- List dividers: 1 px ~6% white, inset to the text column, never full-bleed between every row (use spacing first).
- Focus: 2 px solid accent, 2 px offset, never removed.
- Glass: only the sticky top bar and bottom tab bar; `backdrop-filter: blur(12px)` over a ≥ 80% opaque fill, so it degrades to "opaque" safely. No blur anywhere in scrolling content.
- Grain: optional, one ≤ 4 KB tiling WebP at ≤ 4% opacity on the hero scrim only; static.

### R6. Motion tokens

```css
--dur-1: 100ms;  /* press, toggle, check */
--dur-2: 150ms;  /* hover colour, fades, exits, image fade-in */
--dur-3: 200ms;  /* small enters: menu, popover, toast, spoiler reveal */
--dur-4: 300ms;  /* sheet / dialog enter (exit at --dur-3) */
--dur-morph: 400ms; /* poster→detail shared element only */
--ease-standard: cubic-bezier(0.2, 0, 0, 1);    /* M3 standard: on-screen changes */
--ease-enter:    cubic-bezier(0.05, 0.7, 0.1, 1); /* M3 emphasized-decelerate */
--ease-exit:     cubic-bezier(0.3, 0, 0.8, 0.15); /* M3 emphasized-accelerate */
```

- **Animates:** press feedback on cards/buttons (`scale(.97)`, `--dur-1`); sheets/dialogs (enter 300 / exit 200); toasts; optimistic state swaps (crossfade 150); the poster→detail morph (`<ViewTransition name="poster-{id}" share="morph" default="none">`, 400 ms) on title links that are prefetched; Suspense reveals on title pages (exit 150 / enter 210, Next's recipe); spoiler reveal (blur 6→0 px + opacity, 200 ms, poster-sized area only); friend data arriving (opacity + 4 px rise, 200 ms, once).
- **Never animates:** tab and filter switches (instant, or ≤ 150 ms crossfade), keyboard-triggered actions, list reordering, scroll-linked effects, anything infinite. Delete `float`, `glow-pulse`, `scale-pulse`, `pulse-soft` from `globals.css`.
- **Reduced motion:** all translate/scale become 0; crossfades stay but cap at 150 ms; `::view-transition-*` durations set to 0 [50]. Respect it in JS too (`matchMedia`).
- **No motion library.** CSS transitions + `<ViewTransition>` + Web Animations API cover everything above.

### R7. Poster grid and shelf rules

- Grid: `grid-template-columns: repeat(auto-fill, minmax(var(--poster-min), 1fr))` inside an `@container`; `--poster-min` = 104 px (< 640), 124 px (≥ 640), 140 px (≥ 1024). With `--gap-grid` and `--gutter` that yields **3 / 4 / 5 / 6 / 7 columns** at 390 / 640 / 768 / 1024 / ≥ 1280 px (content capped at 76rem), matching the grid-math table in §4.
- Feature 2-up grid on phones: gap 12, poster ~173 px wide.
- Images: `srcset` w185 / w342 / w500 with `sizes` per breakpoint; grid cells resolve to **w342**, 2-up features and the detail hero to **w500**, never w780/original in lists; backdrops w780 on phones and w1280 ≥ lg; headshots w185. Raw `<img>` with `loading="lazy"`, `decoding="async"` and explicit `width`/`height` (or `aspect-ratio: 2/3`) — not Vercel image optimization [38].
- Caption under each poster: `title-sm` 2-line clamp + one `meta` line — the people line ("Maya ★4.5") beats the year.
- Shelves: poster width 108 px phone (~3.3 visible) / 128 px md / 148 px lg; `scroll-snap-type: x proximity`; `padding-inline` and `scroll-padding-inline` = `--gutter` so the first poster aligns with the heading; ≤ 12 items, then a "See all" tile into a grid; arrows only on hover-capable pointers; no dots, no auto-advance.

## Anti-patterns

1. One sans doing every job, including display titles — the scaffold-default look.
2. Font weights below 400 on dark; grey text below 12 px; tiny uppercase wide-tracked labels as the main hierarchy.
3. Fluid (`vw`-driven) sizes for body/UI text, or a display `clamp()` with a large vw term that hasn't been tested at 200% browser zoom.
4. Serif and sans at the same font size in one line with no x-height compensation.
5. Shipping every axis and italic upfront (Newsreader with italic + `opsz` adds ~147 KB) or loading via `<link>` to Google instead of `next/font`.
6. Infinite ambient animation (float, glow, pulse, shimmer); `transition: all`; animating size, position, `box-shadow` or `filter` on large areas.
7. Backdrop blur on cards in scrolling lists; live SVG noise; animated grain.
8. Auto-advancing hero carousels; dots as the only cue; owned data reachable only by horizontal scroll.
9. Spinners on sub-second social writes; skeletons that don't match the final layout; full-page loaders for one module.
10. Gamified presence: confetti, streak flames, typing dots, pulsing "live" rings, bouncing count badges.
11. Big radii (≥ 12 px) on posters; drop shadows as the main depth cue on dark.
12. `next/image` optimisation for TMDB art, or w780/original in grids.
13. A poster→detail morph without prefetch on that link — it silently falls back to a plain enter.

## Sources
1. Fonts In Use, "Letterboxd for iPhone" — https://fontsinuse.com/uses/14608/letterboxd-for-iphone
2. Fonts In Use, "MUBI identity" — https://www.fontsinuse.com/uses/51030/mubi-identity
3. Spin, MUBI project — https://spin.co.uk/projects/mubi
4. mubi.com homepage HTML (inspected `font-family` declarations) — https://mubi.com/en
5. Fonts In Use, "A24 website" — https://fontsinuse.com/uses/53928/a24-website ; Grand Army, A24 — https://www.grandarmy.com/projects/a24
6. Fonts In Use, "John Waters collection on Criterion Channel" — https://fontsinuse.com/uses/65390/john-waters-collection-on-criterion-channel
7. Creative Review, "Pentagram redesigns Sight and Sound" — https://www.creativereview.co.uk/pentagram-sight-and-sound/
8. GDUSA, "Netflix unveils new custom typeface" — https://gdusa.com/netflix-unveils-new-custom-typeface/
9. Entrepreneur, "To Save Some Cash, Netflix Developed Its Own Font" — https://www.entrepreneur.com/article/310839
10. Apple HIG, Typography — https://developer.apple.com/design/human-interface-guidelines/typography
11. Google Fonts metadata — https://fonts.google.com/metadata/fonts
12. Next.js, Font module (`next/font`) — https://nextjs.org/docs/app/api-reference/components/font
13. vercel/next.js, `create-next-app` app template `layout.tsx` — https://github.com/vercel/next.js/blob/canary/packages/create-next-app/templates/app-tw/ts/app/layout.tsx
14. MDN, `font-optical-sizing` — https://developer.mozilla.org/en-US/docs/Web/CSS/font-optical-sizing
15. MDN, `font-size-adjust` — https://developer.mozilla.org/en-US/docs/Web/CSS/font-size-adjust
16. Adam Argyle, "Adjust perceived typeface weight for dark mode without layout shift" — https://nerdy.dev/adjust-perceived-typepace-weight-for-dark-mode-without-layout-shift
17. Material Design 2, Dark theme — https://m2.material.io/design/color/dark-theme
18. Rasmus Andersson, Inter "Dynamic Metrics" (archived v3 site) — https://d.rsms.me/inter-website/v3/dynmetrics/
19. MDN, `font-variant-numeric` — https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
20. Vercel, Web Interface Guidelines — https://vercel.com/design/guidelines
21. Material 3 type scale — https://m3.material.io/styles/typography/type-scale-tokens ; Compose `Typography` reference — https://developer.android.com/reference/kotlin/androidx/compose/material3/Typography
22. Vercel Geist, Typography — https://vercel.com/geist/typography
23. Linear, "How we redesigned the Linear UI" — https://linear.app/now/how-we-redesigned-the-linear-ui
24. Adrian Roselli, "Responsive Type and Zoom" — https://adrianroselli.com/2019/12/responsive-type-and-zoom.html
25. Utopia, "Designing with fluid type scales" — https://utopia.fyi/blog/designing-with-fluid-type-scales/
26. Baymard, "Readability: the optimal line length" — https://baymard.com/blog/line-length-readability
27. Tailwind CSS 4 default theme (installed `tailwindcss@4.1.18`, `theme.css`) — https://tailwindcss.com/docs/theme
28. spec.fm, "The 8-Point Grid" — https://spec.fm/specifics/8-pt-grid
29. Tailwind CSS, Padding — https://tailwindcss.com/docs/padding
30. Apple HIG, Layout — https://developer.apple.com/design/human-interface-guidelines/layout
31. W3C, Understanding SC 2.5.8 Target Size (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
32. WebKit, "Designing Websites for iPhone X" — https://webkit.org/blog/7929/designing-websites-for-iphone-x/
33. Tailwind CSS, Responsive design / container queries — https://tailwindcss.com/docs/responsive-design
34. NN/g, "Designing Effective Carousels" — https://www.nngroup.com/articles/designing-effective-carousels/
35. NN/g, "Beware Horizontal Scrolling…" — https://www.nngroup.com/articles/horizontal-scrolling/
36. Baymard, "Homepage carousels" — https://baymard.com/blog/homepage-carousel
37. TMDB, Configuration details (image sizes) — https://developer.themoviedb.org/reference/configuration-details
38. Vercel, Image Optimization limits and pricing — https://vercel.com/docs/image-optimization/limits-and-pricing
39. Material Components Android, `Shape.md` — https://github.com/material-components/material-components-android/blob/master/docs/theming/Shape.md
40. web.dev, "How to create high-performance CSS animations" — https://web.dev/articles/animations-guide
41. MDN, `prefers-reduced-transparency` — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency
42. CSS-Tricks, "Grainy Gradients" — https://css-tricks.com/grainy-gradients/
43. Alex Russell, "The Performance Inequality Gap, 2024" — https://infrequently.org/2024/01/performance-inequality-gap-2024/
44. NN/g, "Executing UX Animations: Duration and Motion Characteristics" — https://www.nngroup.com/articles/animation-duration/
45. Material Components Android, `Motion.md` — https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md
46. Apple HIG, Motion — https://developer.apple.com/design/human-interface-guidelines/motion
47. Emil Kowalski, "You don't need animations" — https://emilkowal.ski/ui/you-dont-need-animations
48. W3C, Understanding SC 2.3.3 Animation from Interactions — https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
49. React, `<ViewTransition>` — https://react.dev/reference/react/ViewTransition
50. Next.js, "Designing view transitions" guide — https://nextjs.org/docs/app/guides/view-transitions
51. Can I use, View Transitions API (single-document) — https://caniuse.com/view-transitions
52. Apple HIG, SharePlay — https://developer.apple.com/design/human-interface-guidelines/shareplay
53. NN/g, "Skeleton Screens 101" — https://www.nngroup.com/articles/skeleton-screens/
54. NN/g, "Response Times: The 3 Important Limits" — https://www.nngroup.com/articles/response-times-3-important-limits/
55. Viget, "A Bone to Pick with Skeleton Screens" — https://www.viget.com/articles/a-bone-to-pick-with-skeleton-screens/
56. React, `useOptimistic` — https://react.dev/reference/react/useOptimistic

Measurement method for §1.2 (reproducible): Google Fonts metadata JSON for axes/popularity; `fonts.googleapis.com/css2` requested with a Chrome UA, latin `@font-face` block's woff2 downloaded and byte-counted; x-height from the OS/2 table of the static TTF the API serves to a non-browser UA; OpenType feature tags parsed from GSUB/GPOS of the served TTF/WOFF. Run 2026-10-03.
