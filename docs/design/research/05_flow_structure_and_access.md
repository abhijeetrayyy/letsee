# 05 — Flow, structure and access

> Research note for the letsee redesign. Question: what does the evidence say about structuring flows and pages in a social film/TV journal — and how should a redesign be executed so that every page and every component instance gets it, not just the showcase pages?
>
> Status: complete first version (2026-10-03). Companion to 01–04 (colour, type/motion, two-person design, competitors); this note covers structure, flows, access and the method for applying a new system everywhere.
>
> Convention: **[E]** = evidence (sourced fact; source linked inline). **[O]** = opinion / design judgement derived from the evidence. **[R]** = observation about the letsee repo as of commit `7c8e03a`.

---

## 1. Information architecture

### 1.1 Objects before pages (OOUX)
- **[E]** Object-Oriented UX (Sophia Prater, 2015/16) designs the *nouns* of a system — objects, their relationships, the calls-to-action on each, and their attributes (the "ORCA" process) — before drawing flows or screens; "CTAs are the main entry points to interaction flows." ([A List Apart, 2016](https://alistapart.com/article/ooux-a-foundation-for-interaction-design/); [LogRocket on ORCA](https://blog.logrocket.com/ux-design/object-oriented-ux-ooux/)). A nested-object matrix (objects on both axes) exposes relationships that page-first design misses ([LogRocket](https://blog.logrocket.com/ux-design/object-oriented-ux-ooux/)).
- **[O]** letsee's objects are unusually clear: **Title** (film / show), **Season**, **Episode**, **Person** (cast/crew), **Member** (a user), **Viewing** (a dated event, already modelled as such in commit `c8b916c`), **Take** (rating/review attached to a viewing), **Recommendation** (from→to, with why), **List**, **Room** (Tonight), **Conversation**. Every page is either *one object in detail* or *a collection of one object type*. That gives a small, closed set of page templates (see Recommendation §a). Each object needs exactly one canonical "card" representation reused everywhere it appears — the OOUX corollary that the same object should look and behave the same in every context.

### 1.2 Task-first vs catalogue-first home
- **[E]** Gerry McGovern's Top Tasks method: users have a small set of top tasks ("usually less than 10, often less than five") and the product should be measured on how quickly those are completed, removing clutter around them ([UIE/Center Centre](https://articles.centercentre.com/?p=877)).
- **[E]** Progressive disclosure: show "only a few of the most important options" initially; designs with more than two disclosure levels "typically have low usability because users often get lost" ([NN/g, Nielsen 2006](https://www.nngroup.com/articles/progressive-disclosure/)).
- **[O]** A catalogue-first home (rows of trending/popular posters) answers "what exists?", which TMDB, JustWatch and streaming services already answer better. letsee's differentiated question is "what are *my people* watching and what do I owe them?" — so the signed-in home should be task-first: (1) continue/log what I just watched, (2) friends' recent viewings and takes, (3) open recommendations addressed to me, (4) next episode of shows I follow, (5) Tonight room if one is live. Catalogue browsing belongs on Search/Browse.

### 1.3 How many top-level destinations
- **[E]** Material: a navigation bar holds **three to five** destinations; fewer than three → tabs; more than five → tabs or a drawer ([Material bottom navigation](https://material.io/components/bottom-navigation); [MDC iOS README](https://github.com/material-components/material-components-ios/blob/c8b8acabf8c78b9e266c33803848e9e67967fe73/components/BottomNavigation/docs/README.md)).
- **[E]** NN/g: "If your site has more than 5 options, it's hard to fit them in a tab or navigation bar" ([NN/g mobile navigation primer, 2015](https://www.nngroup.com/articles/mobile-navigation-patterns/)); for phones with more than four top-level links, a *combo* (some visible, rest hidden) is "the only reasonable solution" ([NN/g, Pernice & Budiu 2016](https://www.nngroup.com/articles/hamburger-menus/)).
- **[R]** The header currently links to ~12 app destinations (browse, clubs, data, import, messages, notification, profile, quick-add, search, tonight, watchlist, welcome) and mobile relies on a `BurgerMenu`.
- **[O]** Five is a ceiling, not a target; utilities (import, data export, settings) are not destinations and belong under the profile/"You" area.

### 1.4 Page families and consistency
- **[E]** NN/g heuristic #4: internal consistency (within the product) and external consistency (with conventions elsewhere — Jakob's Law, "people spend most of their time on sites other than yours") both reduce cognitive load ([NN/g, Krause 2021](https://www.nngroup.com/articles/consistency-and-standards/)).
- **[O]** Consistency is easiest to enforce at the *template* level: if ~37 routes collapse into ~7 families, each with one layout component, then "redesign every page" becomes "redesign 7 templates + ~30 components", and new routes inherit the design by construction.

---

## 2. Detail pages (title, season, episode, person)

### 2.1 Lessons from product detail pages (Baymard)
- **[E]** Horizontal tabs on detail pages perform poorly: users "repeatedly overlooked core product content" hidden in tabs, because the basic assumption "is that simply scrolling vertically will allow them to access core content sections"; 29% of sites still use them. Better: **expanded sections** (desktop, often with a sticky table of contents of anchor links) and **vertically collapsed sections** on long mobile pages ([Baymard, updated 2026](https://baymard.com/blog/avoid-horizontal-tabs)).
- **[E]** Splitting detail content into subpages (26% of mobile sites) caused users to miss content entirely and to get lost on Back — the device Back button sent them two levels up, losing scroll position. Collapsed-section headers should carry content counts, e.g. "Reviews (14)" ([Baymard, 2020](https://baymard.com/blog/avoid-using-subpages)).
- **[E]** Mobile users swipe the main image immediately and assume more images exist; dot indicators are routinely ignored; 100% of desktop sites but only 24% of mobile sites use thumbnails ([Baymard, 2020](https://baymard.com/blog/always-use-thumbnails-additional-images)).
- **[E]** A **sticky product summary** (title, key info, primary action) attached to the viewport edge keeps "the 'Buy' button within hand's reach" while users read long content such as reviews ([Baymard, Responsive Upscaling #10](https://baymard.com/blog/responsive-upscaling)).
- **[E]** 95% of users rely on reviews to evaluate products in Baymard testing ([Baymard reviews benchmark](https://baymard.com/product-page/benchmark/page-designs/user-reviews-section)).
- Caveat: widely-quoted figures such as "sticky add-to-cart lifts conversion 7.9%" are attributed to Baymard by vendor blogs but I could not find them in a Baymard primary source — excluded.

### 2.2 Transfer to letsee title pages [O]
- The "buy" equivalent is **Log / Save / Recommend**. It must be above the fold on a 375×667 viewport *with* the poster, title, year, runtime and friends' signal ("3 friends watched; Asha ★★★★").
- Friends' takes are the "reviews" — and for a social product they come *first*, before global ratings; reviews from strangers are secondary.
- Cast pages (`/movie/[id]/cast`, `/tv/[id]/cast`) are subpages; Baymard's subpage evidence argues the main page should show the top-billed cast inline with a count ("Cast (64) →") and the subpage stays for completeness only.
- Long title pages: expanded sections + sticky in-page section nav (anchors) on desktop; collapsed or short sections on mobile. No horizontal tabs on title pages (profile tabs are different: they switch between collections, not sections of one object).
- Season → episode is a real hierarchy; breadcrumbs belong there (see §5).

---

## 3. Feeds and home screens

- **[E] Chronological vs ranked.** In the 2020 US-election Meta experiments, moving users from algorithmic to reverse-chronological feeds "substantially decreased the time they spent on the platforms and their activity", but did not significantly change polarisation or political knowledge over three months ([Guess et al., *Science* 2023, via NYU CSMaP](https://csmapnyu.org/research/academic-research/how-do-social-media-feed-algorithms-affect-attitudes-and-behavior-in-an-election-campaign)). Time-on-site is not letsee's goal; *connection* is.
- **[E] Endpoints.** Instagram added "You're All Caught Up" (July 2018) after the move from chronological to ranked feeds created confusion about what was new; the marker appears once posts from the last two days have been seen ([Instagram announcement](https://about.instagram.com/blog/announcements/introducing-youre-all-caught-up-in-feed); [TechCrunch](https://techcrunch.com/2018/05/21/scroll-responsibly/)).
- **[E] Infinite scroll** suits homogeneous, goal-less browsing (social, news); it fails when users need to re-find or compare items, loses position on Back, and blocks footer access. "Load more" reduces these problems ([NN/g, 2022](https://nngroup.com/articles/infinite-scrolling-tips)).
- **[E] Empty states** should (1) communicate system status honestly (never claim "nothing here" and then populate), (2) teach ("Star your favorites to list them here"), (3) offer a direct pathway to the key task ([NN/g, Kaplan 2021](https://www.nngroup.com/articles/empty-state-interface-design/)).
- **[E] Cold start.** Network products need an "atomic network" — the smallest self-sustaining group (2–3 people for Zoom, 5–10 for Slack) — before network effects work ([Lenny's Newsletter with Andrew Chen](https://lennysnewsletter.com/p/atomic-network)).
- **[O] For letsee:** a friends feed should be reverse-chronological, grouped by *viewing* (one card per dated viewing with its companions and take), finite ("You're caught up — 12 viewings since Sunday"), and end with a deliberate next step (log something, recommend something, invite someone). For a user with 0–2 friends the home must still be useful alone (own diary, next episodes, watchlist) and must make the *first friend* the primary empty-state action — the atomic network for "watching together" is two people.

---

## 4. Forms and logging flows

- **[E] Speed thresholds.** 0.1 s feels instantaneous (direct manipulation), 1 s keeps flow of thought, 10 s keeps attention ([NN/g, Nielsen 1993/2014](https://nngroup.com/articles/response-times-3-important-limits)).
- **[E] Optimistic UI.** React's `useOptimistic` renders the expected state while an Action is in flight and automatically falls back to the real value if it throws ("a failure means `value` hasn't changed, so the UI shows what it showed before") ([react.dev](https://react.dev/reference/react/useOptimistic)).
- **[E] Undo vs confirm.** Confirmations should be reserved for serious, irreversible consequences; overuse habituates — "If you cry wolf too many times, people will stop paying attention"; button labels should name the consequence ("Delete file" / "Keep file"), and undo is preferable to confirmation ([NN/g, Nielsen 2018](https://www.nngroup.com/articles/confirmation-dialog/)). GitHub's Primer encodes the same rule in its confirmation-dialog guidelines ([Primer](https://primer.style/product/components/confirmation-dialog/guidelines)).
- **[E] Bottom sheets.** Good for short, contextual controls; must support the device Back button and a visible Close button; swipe-to-dismiss alone is unreliable and inaccessible to users with motor impairments; never stack sheets; don't use sheets for long workflows or as a replacement for page navigation ([NN/g, Laubheimer 2023](https://www.nngroup.com/articles/bottom-sheet/)).
- **[E] Precedent.** Letterboxd separates *marking watched* (one tap) from *logging* (+ Log: date, rating 0.5–5, rewatch, review), and logging builds the Diary ([Letterboxd FAQ](https://letterboxd.com/about/faq/)).
- **[O] Fastest credible log:** one tap on "Watched" records a viewing *today, alone/with nobody specified, no rating* — optimistic, with a toast "Logged for today · Add details · Undo". "Add details" opens a bottom sheet (mobile) / anchored popover (desktop) with, in order: date (default today, chips: Today / Yesterday / Pick), companions (recent co-watchers as chips first — this is the social differentiator), rating, short take, rewatch flag (auto-detected). Everything after the tap is optional and saves on change; no Submit button. Deleting a viewing uses undo, not a confirm dialog; deleting a list or account uses a confirm dialog with a named consequence.

---

## 5. Navigation and wayfinding

- **[E] Hidden navigation costs.** NN/g's 179-participant study: hidden navigation cut content discoverability by >20%; users were ≥39% slower on desktop and 15% slower on mobile vs combo navigation; difficulty ratings rose 21% vs visible nav ([NN/g, Pernice & Budiu 2016](https://www.nngroup.com/articles/hamburger-menus/); methodology: [NN/g](https://www.nngroup.com/articles/hidden-navigation-methodology/)). On desktop: "Use visible, exposed links for navigation instead of collapsing it under a hamburger" ([NN/g](https://www.nngroup.com/articles/find-navigation-desktop-not-hamburger/)).
- **[E] Labels.** Few icons are universally recognised; "text labels are necessary to communicate the meaning and reduce ambiguity", and labels should be visible, not on hover ([NN/g, Harley 2014](https://www.nngroup.com/articles/icon-usability/)). Material: with 3 destinations show labels on all; with 5, labels "with caution" ([Material](https://material.io/components/bottom-navigation)).
- **[E] Sticky headers.** Keep them compact and opaque (not translucent); *partially persistent* headers (hide on scroll down, reveal on scroll up) work well on mobile if animation is ~300–400 ms and natural ([NN/g, Laubheimer 2021](https://www.nngroup.com/articles/sticky-headers/)).
- **[E] Breadcrumbs** show position in the hierarchy, not session history; the current page is not a link; on mobile show only the immediate parent; unnecessary for flat sites ([NN/g, Laubheimer 2018](https://www.nngroup.com/articles/breadcrumbs/)).
- **[E] Back.** Baymard saw users on subpages hit device Back and land two steps up, losing scroll position in lists ([Baymard](https://baymard.com/blog/avoid-using-subpages)); infinite lists lose position on Back ([NN/g](https://nngroup.com/articles/infinite-scrolling-tips)).
- **[E] Search suggestions.** Every suggested query must have good results; visually distinguish typed vs suggested text; scoped suggestions ("in People") are useful; simplify to text-only on mobile; suggestions were selected in only 23% of the cases where offered, but still serve as reference ([NN/g, Moran 2018](https://www.nngroup.com/articles/site-search-suggestions/)).
- **[O] For letsee:** on mobile a persistent bottom tab bar with labels (5 max) — not a burger; on desktop a visible top or side nav. Header hides on scroll down on long pages, never on the bottom bar. Season → Episode pages carry a one-level breadcrumb ("‹ Severance · Season 2"). Search opens to recent searches + "people you follow" shortcuts; results are grouped by object type (Titles, People, Members, Lists) with scope chips. Back must restore scroll position on feeds and grids (Next's router does this for client navigations; verify on every feed).

---

## 6. Accessibility (WCAG 2.2 AA, dark, image-heavy)

### 6.1 What WCAG 2.2 changed, and a common misreading
- **[E]** WCAG 2.2 added nine criteria; at A/AA: **2.4.11 Focus Not Obscured (Minimum) (AA)**, **2.5.7 Dragging Movements (AA)**, **2.5.8 Target Size (Minimum) (AA)**, **3.2.6 Consistent Help (A)**, **3.3.7 Redundant Entry (A)**, **3.3.8 Accessible Authentication (Minimum) (AA)**. **2.4.13 Focus Appearance is AAA**, not AA. 4.1.1 Parsing was removed ([W3C WAI, What's new in 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)). The brief says "focus appearance" — at AA the binding requirements are 2.4.7 Focus Visible plus 1.4.11's 3:1 rule for the indicator; 2.4.13's "≥2 CSS px, 3:1 change" is a good *design target* even though it is AAA.

### 6.2 Contrast on dark, over images
- **[E]** 1.4.11 Non-text Contrast: UI components, states and graphical objects need **3:1** against adjacent colours; focus indicators are included; a star rating whose filled/empty states differ only by hue fails ([W3C Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Body text remains 4.5:1 (3:1 for large text) under 1.4.3 ([W3C Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- **[O]** On a poster-heavy dark UI the failure modes are: muted grey metadata [R, computed with the WCAG formula: `surface-500` #71717a is 4.12:1 on `surface-950` and 3.67:1 on `surface-900` — fails 4.5:1 for small text; `surface-600` #52525b is 2.57:1 on `surface-950`; `surface-400` #a1a1aa is 7.76:1; `text-surface-500` appears ~399 times and `text-surface-600` ~101 times]; text laid over backdrops without a guaranteed scrim; empty vs filled stars differing by colour only; 1px borders at 10% white (`border-white/10`) as the only boundary of an input. A token system should make the *passing* pairs the only nameable ones (§8).

### 6.3 Targets, focus and sticky chrome
- **[E]** 2.5.8: pointer targets ≥ **24×24 CSS px**, or spaced so a 24 px circle centred on each does not intersect another; inline-text and "equivalent control" exceptions apply ([W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). NN/g's recommended physical size for sticky-header targets is ~1 cm × 1 cm ([NN/g](https://www.nngroup.com/articles/sticky-headers/)).
- **[E]** 2.4.11: a focused component must not be *entirely* hidden by author content; sticky headers/footers and non-modal banners are the typical culprits; CSS `scroll-padding` is a sufficient technique ([W3C Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).
- **[R]** The codebase has ~85 `outline-none` usages against ~11 `focus-visible:` styles — the single biggest likely keyboard failure. A bottom tab bar + sticky header will require `scroll-padding-top/bottom` on `html`.

### 6.4 Shelves, carousels, motion
- **[E]** APG carousel pattern: auto-rotation must stop on keyboard focus and on hover; Tab/Shift+Tab move through slide content normally; prev/next buttons don't move focus; container gets `aria-roledescription="carousel"` and a label, slides get `aria-roledescription="slide"` and a name like "3 of 10"; `aria-live="off"` while rotating, `polite` otherwise ([W3C APG](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)).
- **[E]** 2.2.2 Pause, Stop, Hide (A): anything that moves automatically for >5 s alongside other content needs a pause/stop/hide mechanism ([W3C Understanding 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)).
- **[E]** `prefers-reduced-motion: reduce` signals the user wants motion removed or replaced; scaling, panning and parallax are named vestibular triggers ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).
- **[E]** 1.4.10 Reflow (AA): no two-dimensional scrolling at 320 CSS px width (= 1280 px at 400% zoom), with exceptions for content that is inherently 2-D ([W3C Understanding 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)).
- **[O]** Horizontal poster shelves are acceptable under 1.4.10 only if each shelf has a "See all" link to a vertically wrapping grid — that gives zoom users and keyboard users a non-horizontal path. Shelves should be native-scrolling lists (`<ul>` of links) with visible prev/next buttons on pointer devices, *no auto-advance*, and the shelf heading as its accessible name. [R] `globals.css` defines `float`, `glow-pulse`, `scale-pulse` and `pulse-soft` infinite animations; only ~2 files reference reduced motion.

### 6.5 Images, ratings, spoilers
- **[E]** Functional images (images inside links) get alt text describing the destination; when the link already contains the title text, use `alt=""` to avoid duplicate announcements ([W3C WAI images tutorial](https://www.w3.org/WAI/tutorials/images/functional/)).
- **[E]** APG rating example: a `radiogroup` of `radio` stars, each labelled ("three stars"), roving tabindex, arrow keys move and check, focus ring ≥2 px with spacing ([W3C APG radio rating](https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio-rating/)).
- **[E]** Disclosure pattern: a `button` with `aria-expanded` (and optional `aria-controls`); Enter/Space toggle ([W3C APG disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)).
- **[O]** Poster card = one link whose accessible name is "Title (Year)"; poster `alt=""`; friend avatars inside the card are decorative with the names in text ("with Asha"). A read-only rating renders as text for AT ("Rated 3.5 out of 5") with the stars `aria-hidden`. A spoiler gate is a disclosure button ("Show spoiler: episode 4 take by Asha") — the hidden text must not be in the accessibility tree until revealed (use `hidden`, not blur alone; a CSS blur hides nothing from a screen reader).

### 6.6 Zoom and dynamic type
- **[E]** 1.4.4 Resize Text (AA): text resizable to 200% without loss of content or function ([W3C Understanding 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)); 1.4.12 Text Spacing (AA): no loss when line-height 1.5, paragraph spacing 2×, letter 0.12em, word 0.16em ([W3C Understanding 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)).
- **[O]** Use `rem` for type and for any container height that holds text (chips, tabs, bottom bar); never fix the height of a text-bearing element in `px`. [R] ~144 arbitrary `text-[NNpx]` sizes and ~119 arbitrary px spacings exist today.

---

## 7. Performance as UX

- **[E] Targets.** Core Web Vitals "good": **LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1**, at the **75th percentile** of page loads, split mobile/desktop; INP replaced FID in 2024 ([web.dev](https://web.dev/articles/vitals)).
- **[E] Thresholds that matter to humans**: 0.1 s / 1 s / 10 s ([NN/g](https://nngroup.com/articles/response-times-3-important-limits)). INP's 200 ms budget sits between the first two — which is why optimistic UI (§4) matters more than raw server speed for a log/save tap.
- **[E] Don't lazy-load the LCP image.** In HTTP Archive data, median LCP was 2,922 ms on pages without lazy-loading vs 3,546 ms with it; disabling lazy-load on above-the-fold images improved LCP 13–15% on archive pages; the fix is eager above the fold, lazy below ([web.dev](https://web.dev/articles/lcp-lazy-loading)).
- **[E] Priority hints.** `fetchpriority="high"` on the LCP image moved Google Flights LCP from 2.6 s to 1.9 s; for carousels, first visible image high, the rest low ([web.dev](https://web.dev/articles/fetch-priority)).
- **[E] Next.js 16**: `priority` on `next/image` is deprecated in favour of `preload`, and the docs advise "In most cases, you should use `loading="eager"` or `fetchPriority="high"` instead of `preload`"; `images.qualities` is now required ([Next.js Image docs, v16](https://nextjs.org/docs/app/api-reference/components/image)).
- **[E] Long poster walls.** `content-visibility: auto` + `contain-intrinsic-size` lets the browser skip rendering off-screen sections — 232 ms → 30 ms rendering in web.dev's case study; `contain-intrinsic-size: auto <h>` remembers real sizes to avoid scroll jumps ([web.dev](https://web.dev/articles/content-visibility)).
- **[E] Skeletons** suit full-page loads under ~10 s; spinners for 2–10 s single-module waits; nothing under 1 s; frame-only skeletons (header/footer only) look broken; skeletons "do not replace performance-optimization efforts" ([NN/g, Tankala 2023](https://www.nngroup.com/articles/skeleton-screens/)).
- **[R]** 69 files render raw `<img>` (TMDB-sized URLs, `loading="lazy"` in ~69 places, `fetchPriority` in only 2). 7 `loading.tsx` route skeletons exist for ~31 app routes.
- **[O] For letsee:** (1) every poster/backdrop/avatar goes through *one* `<Poster>`/`<Backdrop>`/`<Avatar>` component that sets `width`/`height` (or `aspect-ratio`), `sizes`/TMDB size bucket, `decoding="async"`, and takes an `above` prop that switches to `loading="eager" fetchPriority="high"` — so the LCP decision is made per template, not per call site; (2) skeletons must be *the same template* as the loaded page (same grid, same card sizes) so CLS stays ~0; (3) shelves and grids below the fold get `content-visibility: auto`; (4) treat "tap Log → visible change" as a ≤100 ms requirement satisfied optimistically.

## 8. Executing a redesign across a whole product

### 8.1 Tokens: format and tiers
- **[E]** The W3C Design Tokens Community Group format reached its first stable version, **2025.10**, on 28 Oct 2025, with reference implementations in Style Dictionary, Tokens Studio and Terrazzo and adoption by Figma, Penpot, Sketch, Framer and others; it supports themes (light/dark, accessibility variants) without duplicating files, Display P3/OKLCH colour, and aliases ([W3C DTCG announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)). Tokens are JSON objects with `$value`, `$type`, optional `$description`; aliases use `{group.token}`; composite types include shadow, border, transition, typography; files use `.tokens`/`.tokens.json` ([DTCG format draft](https://www.designtokens.org/tr/drafts/format/)).
- **[E]** GitHub Primer splits tokens into **base** (primitive scales) and **functional** (semantic, e.g. `bgColor`, `borderColor.accent.muted`) layers, compiles them with Style Dictionary, defines modes (light, dark, dark-dimmed, high-contrast, colour-blind variants) as *overrides* of a main mode, and uses the W3C `$extensions` field for tool metadata ([primer/primitives README](https://github.com/primer/primitives)).
- **[E]** Tailwind v4: theme variables in `@theme` generate utilities; `--color-*: initial` removes the whole default palette so only your values exist ("all of the default utilities that use that namespace … will be removed"); `--*: initial` removes all defaults; `:root` variables do *not* create utilities; `@theme inline` for variables that reference other variables ([Tailwind docs](https://tailwindcss.com/docs/theme)).
- **[E]** Linear's 2024 theme rebuild reduced each theme from 98 variables to **three inputs** (base, accent, contrast) generated in LCH, because LCH is perceptually uniform ([Linear, "How we redesigned the Linear UI"](https://linear.app/now/how-we-redesigned-the-linear-ui)).
- **[R]** letsee today has primitive scales only (`surface-50…950`, `brand-50…700`, `accent-gold`) in `src/app/globals.css`, used directly ~3,037 times (`text-surface-500` ×399, `bg-surface-800` ×211…), plus `text-white` ×480, ~71 hex literals, 144 arbitrary font sizes, 119 arbitrary px spacings. Nothing distinguishes "muted text" from "a grey that happens to be 500". This is the root cause of drift: a redesign that changes `surface-500` changes borders, icons and text alike.

### 8.2 Components, lint and codemods (how the big systems do it)
- **[E] GitHub / Primer.** Stylelint rules `primer/colors`, `primer/spacing`, `primer/typography`, `primer/borders`, `primer/box-shadow` require Primer variables instead of raw values ([primer/stylelint-config](https://github.com/primer/stylelint-config)). `eslint-plugin-primer-react` autofixes legacy colour variables to Primitives v8 (`new-color-css-vars`) and forces deprecated components to be imported from a quarantined `@primer/react/deprecated` entrypoint (`use-deprecated-from-deprecated`) ([eslint-plugin-primer-react rules](https://github.com/primer/eslint-plugin-primer-react/tree/main/docs/rules)). Primer CSS is in "KTLO mode" with consumers directed to Primer React or ViewComponents ([primer/css](https://github.com/primer/css)) — i.e. GitHub runs several implementations at once, which a large org can afford and a one-person product cannot.
- **[E] Shopify / Polaris.** `@shopify/polaris-migrator` ships a codemod per breaking change (e.g. `v9-scss-replace-color`, `v12-styles-replace-custom-property-space`), run as `npx @shopify/polaris-migrator <migration> <path>` with `--dry`; anything it cannot migrate gets a `polaris-migrator: Unable to migrate … Please upgrade manually` comment, and the docs recommend committing clean files separately from flagged ones. `stylelint-polaris` (40+ rules across border, colour, layout, motion, shadow, space, typography, z-index) *measures coverage*; a `styles-insert-stylelint-disable` migration inserts ignore comments on existing violations so the linter can be switched on immediately — a ratchet ([Polaris migrator docs](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/tools/polaris-migrator.mdx); [stylelint-polaris docs](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/tools/stylelint-polaris.mdx); these docs are now archived in the repo).
- **[E] Atlassian.** `@atlaskit/eslint-plugin-design-system` (v16.13) includes `ensure-design-token-usage` ("Enforces usage of design tokens rather than hard-coded values" — recommended, autofixable), `no-deprecated-design-token-usage`, `no-deprecated-imports`, `use-tokens-space`, `use-tokens-typography`, `use-tokens-motion`, `use-tokens-shape`, and `no-unsafe-design-token-usage` (token usage must be statically analysable) ([npm registry readme](https://www.npmjs.com/package/@atlaskit/eslint-plugin-design-system)); codemods are distributed via `@atlaskit/codemod-cli` ([npm](https://www.npmjs.com/package/@atlaskit/codemod-cli)).
- **[E] Airbnb.** The Design Language System (from 2015) aimed for "unified … well-defined, reusable and cross-platform components" and was adopted by "dozens of designers and engineers" across native apps and web ([Karri Saarinen, DLS](https://karrisaarinen.com/dls/)).
- **[E] Tailwind-specific linting.** `eslint-plugin-better-tailwindcss` supports Tailwind v4 and offers `no-unknown-classes` (flags classes not registered with Tailwind — so, combined with `--color-*: initial`, any default-palette class), `no-restricted-classes` (regex-banned classes, autofix), `no-conflicting-classes`, `no-deprecated-classes` ([schoero/eslint-plugin-better-tailwindcss](https://github.com/schoero/eslint-plugin-better-tailwindcss)). `eslint-plugin-tailwindcss` has `no-arbitrary-value` (off by default) ([docs](https://github.com/francoismassart/eslint-plugin-tailwindcss/blob/master/docs/rules/no-arbitrary-value.md)).
- **[E] Inventories.** An interface inventory — screenshotting every distinct treatment of each component type side by side — exposes unintended variety (Brad Frost's bank example vs Etsy's few intentional buttons) and fixes scope so components don't "slip between the cracks" ([Brad Frost, 2013](https://bradfrost.com/blog/post/interface-inventory/)).

### 8.3 Visual regression and automated a11y
- **[E]** Playwright `toHaveScreenshot()` writes a baseline on first run (after two consecutive identical captures), names files per browser and platform because rendering differs, compares with pixelmatch, accepts `maxDiffPixels`, and can inject a `stylePath` CSS to hide volatile content; `--update-snapshots` re-baselines ([Playwright](https://playwright.dev/docs/test-snapshots)).
- **[E]** Chromatic snapshots Storybook stories in cloud browsers with a review/approve workflow; TurboSnap only re-captures stories whose dependency graph changed ([Chromatic](https://www.chromatic.com/docs/turbosnap/)).
- **[E]** `@axe-core/playwright` scans pages filtered by WCAG tags; Playwright's docs warn automated tests "can detect some common accessibility problems … many accessibility problems can only be discovered through manual testing" ([Playwright a11y](https://playwright.dev/docs/accessibility-testing)).
- **[R]** letsee already has the right enforcement idiom: `tests/invariants/*.test.ts` are Vitest tests that read the source tree and fail on forbidden patterns with a commented allowlist (e.g. `links-do-not-prefetch.test.ts` bans `next/link` outside `AppLink`). Design-system rules belong in exactly this form. There is no Playwright or Storybook yet.

### 8.4 Rollout: strangler fig, flags, speed
- **[E]** Strangler fig: replace a system gradually behind a transitional layer rather than a big-bang rewrite, because replacement "takes a long time, and the users can't wait" ([Fowler, 2024](https://martinfowler.com/bliki/StranglerFigApplication.html)).
- **[E]** Release toggles should live days to weeks; "Savvy teams view the Feature Toggles in their codebase as inventory which comes with a carrying cost"; use expiry dates or tests that fail when a toggle outlives its date ([Hodgson on martinfowler.com](https://martinfowler.com/articles/feature-toggles.html)).
- **[E]** Linear did its redesign in ~6 weeks with a small team, dogfooded behind internal flags, then private beta, then percentage rollout by workspace; lesson: "It's always better to do a redesign quickly. Otherwise, you will block almost every project and create design debt." They deferred navigation changes as too complex for the window ([Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)).
- **[O] Failure modes to design against:** (1) *showcase drift* — the title page and home get the new look, the cast page, import flow and 404 don't; (2) *two systems at once* — old `surface-*` classes and new semantic classes both valid, so new code picks whichever it copied; (3) *zombie flags* — `design=v2` branches still in code months later; (4) *token aliasing that isn't* — semantic names created but mapped 1:1 to primitives with no rule preventing primitives, so nothing changes; (5) *screenshot fatigue* — visual tests that are flaky (dates, avatars, TMDB images) get blanket-updated and stop catching anything.

---

## Recommendation for letsee

Everything below is **[O]** — derived from the evidence above, not itself evidence.

### (a) Page families and templates
Every one of the 37 `page.tsx` routes belongs to exactly one family; each family is one layout component under `src/components/templates/`, and a route may not render its own outer layout.

| Family | Routes | Template anatomy (top → bottom) |
|---|---|---|
| **1. Focus** (outside the app shell) | `/`, `/login`, `/signup`, `/forgot-password`, `/update-password`, `/tv-time`, `/app/welcome`, `/app/profile/setup` | No global nav. Single column ≤ 34rem. One headline, one primary action, one secondary link. Errors inline. |
| **2. Stream** (time-ordered things addressed to me) | `/app` (home), `/app/notification` | Page header (title + one action) → "since you were last here" group → items grouped by day → explicit end ("You're caught up") → one next-step card. Load-more, no infinite scroll. Empty state = first-friend / first-log action. |
| **3. Detail** (one object) | `/app/movie/[id]`, `/app/tv/[id]`, `…/season/[n]`, `…/episode/[id]`, `/app/person/[id]`, `/app/review/[id]`, `/app/lists/[listId]`, `/app/clubs/[slug]`, `/app/profile/[id]` | Parent crumb (season/episode only) → hero (art + title + key facts) → **action bar** (Log / Save / Recommend; becomes a sticky bottom bar on mobile once scrolled past) → **people signal** (friends who watched, their takes, recs to me) → sections in fixed order (Friends' takes → About → Cast (top 10 + "All 64 →") → Seasons/Episodes → Where to watch → Related). Expanded sections + sticky anchor nav on desktop; short expanded sections on mobile, collapse only past ~5 screens. No horizontal tabs, except profile's collection tabs. |
| **4. Collection** (many of one object type) | `/app/watchlist`, `/app/lists`, `/app/clubs`, `/app/person`, `/app/browse`, `/app/search/[query]`, `/app/movie/[id]/cast`, `/app/tv/[id]/cast`, profile tabs (films, lists) | Header (title + count + one action) → filter/sort row (chips, scoped) → grid or list of the object's *canonical card* → load more with count ("Showing 40 of 212") → empty state with direct pathway. Back restores scroll. |
| **5. Recap** (time) | `/app/profile/[id]/month/[month]`, `/app/profile/[id]/year/[year]`, diary tab, stats tab | Period switcher (‹ Sept 2026 ›) → headline numbers (as text, not only charts) → calendar/timeline of viewings → "watched with" people → share. Charts have a text/table equivalent. |
| **6. Conversation** (live, two-way) | `/app/messages`, `/app/messages/[id]`, `/app/tonight` | List ↔ detail (two panes ≥ 1024px). Composer pinned to bottom with `scroll-padding-bottom`. New messages/votes announced via one polite live region. |
| **7. Task** (do one job, then leave) | `/app/quick-add`, `/app/import`, `/app/data`, `/app/search` (landing), settings | Title + one-line purpose → steps or a single form → visible progress for >10 s work (import) → explicit outcome screen with the next action. |

Object cards (OOUX): one canonical card per object — `TitleCard`, `EpisodeRow`, `PersonCard`, `MemberChip`, `ViewingCard`, `TakeCard`, `RecCard`, `ListCard` — each with a fixed set of variants (`compact | standard | hero`). A Title looks the same on home, search, watchlist, person filmography and lists.

### (b) Top-level navigation
- **Mobile bottom bar, labelled, five destinations:** **Home** (Stream) · **Search** · **Up next** (watchlist + recommendations to me with who/why + next episodes of followed shows + "Decide tonight" entry to Tonight rooms — loops 2, 3, 4) · **Inbox** (messages + notifications, one badge) · **You** (profile, diary, lists, stats, recaps; import, data export, settings, clubs as rows inside).
- **Desktop:** the same five as a visible top bar or left rail (never a burger), plus a persistent "+ Log" button.
- **Logging is an action, not a destination**: it lives on every title/episode as the primary action, in the Home header ("+ Log"), and via search ("Log something" opens search scoped to titles, results have inline Log).
- Header: compact, opaque, hides on scroll-down on Detail/Collection pages; the bottom bar never hides. `html { scroll-padding-top/bottom }` equals the chrome heights.
- Retire `BurgerMenu` on app routes; the ~12 current header links collapse into the five above.

### (c) The logging interaction
1. **Tap "Watched"** (title page action bar, episode row checkbox, search result, Up next item). Immediately (optimistic, `useOptimistic`): button becomes "Watched today ✓"; a toast: "Logged · Today — Add details · Undo" (toast in a polite live region, ≥ 5 s, pauses on hover/focus).
2. **"Add details"** opens a **bottom sheet** on touch / anchored popover on desktop, one screen, no submit button, each field saves on change: *When* (chips: Today · Yesterday · Pick date) → *With* (recent co-watchers as avatar chips first, then search people; "alone" is the default, not a field) → *Rating* (radio-group stars, half-steps, clearable) → *Take* (one line, expands) → *Spoilers?* toggle (auto-on for episode takes until the episode is >7 days old, editable) → *Rewatch* (auto-detected, shown as fact). Sheet has a visible Close, supports Back, never stacks.
3. **Companions are told** after the sheet closes ("Asha will see you watched this together") — the social payoff lands where the effort happened.
4. **Undo, not confirm**, for deleting a viewing, unsaving, unfollowing. **Confirm dialogs** only for deleting a list, leaving a club, deleting the account, wiping imported data — labelled with the consequence ("Delete list 'Noir'" / "Keep list").
5. TV: episode rows have a single check target (≥ 44 px row height; checkbox semantics); "Mark all up to here" is a separate, explicit action with undo.

### (d) Accessibility checklist specific to letsee
- [ ] Semantic colour tokens only; every allowed text/background pair ≥ 4.5:1 (≥ 3:1 for ≥ 24px or 19px bold); every UI-boundary/icon/star pair ≥ 3:1 — enforced by a unit test over the token file (below). Retire `surface-500/600` as text colours on `surface-900/950`.
- [ ] Text over posters/backdrops always sits on a token-defined scrim; never rely on image darkness.
- [ ] Focus: one `focus-visible` ring token (≥ 2px, ≥ 3:1 against both the element and the page, with offset); `outline-none` banned without a replacement (lint).
- [ ] Focus never fully hidden by the sticky header or bottom bar (`scroll-padding`; Playwright check).
- [ ] Every pointer target ≥ 24×24 CSS px; app convention 44×44 for primary touch targets (episode checks, rating stars, bottom-bar items, toast actions).
- [ ] Poster cards: one link per card, accessible name "Title (Year)", poster `alt=""`; standalone hero posters get `alt="Poster: Title"`; person photos `alt=""` when the name is adjacent text.
- [ ] Ratings: input = APG radio group with labelled stars and arrow-key support; display = text "Rated 3.5 out of 5" with icons `aria-hidden`.
- [ ] Spoiler gate = disclosure button (`aria-expanded`), hidden content removed from the accessibility tree (`hidden`), label names whose take and which episode.
- [ ] Shelves: `<section aria-labelledby>` + `<ul>` of links, native horizontal scroll, prev/next buttons for pointer users, no auto-advance, every shelf has "See all" to a reflowing grid (1.4.10).
- [ ] Reduced motion: all `--animate-*` tokens resolve to `none` under `prefers-reduced-motion: reduce` (one override in `globals.css` — [R] verified against this repo's Tailwind v4: `.animate-fade-up` compiles to `animation: var(--animate-fade-up)`, so redefining the variable in a media query reaches every instance); no infinite decorative animation (`float`, `glow-pulse`, `scale-pulse`) on by default; spinners exempt.
- [ ] Zoom: all type and text-bearing heights in `rem`; usable at 320 CSS px and at 200% text; no truncation that hides the only copy of a title.
- [ ] Live regions: one polite region in the shell for toasts; messages/Tonight votes announced politely; nothing announces on page load.
- [ ] Headings: one `h1` per page (the object's name or collection title), sections `h2`; landmarks `header/nav/main`; skip link to `main`.
- [ ] Forms: labels visible; errors inline and associated (`aria-describedby`); no CAPTCHA-style cognitive test at login (3.3.8); remembered companions/dates satisfy 3.3.7.
- [ ] Charts in stats/recaps have a text or table equivalent.

### (e) Execution method: every route, every instance, never visibly half-done

**Principle:** separate the *mechanical* migration (invisible, automated, provable by zero-diff screenshots) from the *visual* change (one commit to token values) and the *structural* changes (per family, short-lived flag). The look switches everywhere at once because every instance already reads semantic tokens; the structure switches per family, but each family switches completely.

**Phase 0 — Inventory and baselines (no visual change).**
1. `tests/invariants/routes.test.ts`: derive the route list from `find src/app -name page.tsx` and assert each appears in a `ROUTE_FAMILIES` manifest (route → family → fixture). A new route without a family fails CI.
2. Interface inventory: script that lists every JSX element with a `className` per component file and groups by element type (button, img, input, dialog) — the 164 component files become a target-component mapping.
3. Add Playwright. One spec iterates `ROUTE_FAMILIES` × {375×812, 1280×800} × {logged-in seeded user}, with TMDB and Supabase responses served from fixtures, `stylePath` hiding timestamps, animations disabled. Commit baselines. Add `@axe-core/playwright` with `wcag2a, wcag2aa, wcag21a, wcag21aa` (+ `wcag22aa` where the axe version supports it); record current violation counts as a baseline file.

**Phase 1 — Semantic tokens, mechanically (zero-diff).**
1. Author `src/design/tokens.tokens.json` (DTCG 2025.10): `primitive.*` (the existing scales) and `semantic.*` — e.g. `color.bg.canvas|raised|sunken|overlay`, `color.text.primary|secondary|muted|on-accent`, `color.border.subtle|strong|focus`, `color.accent.*`, `color.rating.*`, `space.1…12`, `radius.*`, `font.size.*` (rem), `motion.duration/easing.*`, `elevation.*`, and declared contrast pairs in `$extensions`.
2. A small build script (or Style Dictionary) emits `src/design/tokens.css` imported by `globals.css` as `@theme { --color-*: initial; … }` exposing **only semantic names** as utilities (`bg-canvas`, `text-muted`, `border-subtle`, `p-3`).
3. Initially map each semantic token to the *current* primitive value it replaces.
4. Codemod (string-level on className literals/`cn()` args; jscodeshift for template literals): `text-surface-500 → text-muted`, `bg-surface-800 → bg-raised`, `text-white → text-primary`, arbitrary `text-[13px] → text-sm`, `p-[18px] → p-4`… The mapping table is reviewed by a human once; ambiguous sites get a `// ds-migrate: manual` comment (Polaris pattern) and are committed separately.
5. Screenshot suite must show **zero diff** (or reviewed sub-pixel diffs). This proves the migration was mechanical.

**Phase 2 — Make drift impossible (ratchet to zero).** Add Vitest invariants in the existing style, each with a commented allowlist and a stored violation count that may only go down:
- `no-primitive-colours`: bans `(bg|text|border|ring|fill|stroke|from|to|via|outline|shadow)-(surface|brand|white|black|zinc|neutral|gray|…)` and any `#hex`/`rgb(`/`oklch(` outside `src/design/`.
- `no-arbitrary-values`: bans `-\[[^\]]*(px|rem|#)` in class strings outside an allowlist.
- `ds-primitives-only`: raw `<img>`, `<button>`, `<dialog>`, `<input type="range|checkbox">` only inside `src/components/ds/` (mirrors `links-do-not-prefetch`).
- `focus-has-replacement`: `outline-none` only alongside the focus-ring utility.
- `motion-is-tokenised`: no `transition-[…]`/`duration-[…]` literals; `animate-*` only from tokens.
- `token-contrast`: computes WCAG contrast for every declared semantic pair in the token file and fails below 4.5:1 / 3:1 — so a future palette change cannot ship a failing pair.
- `every-route-has-a-family` and `every-family-has-a-skeleton` (a `loading.tsx` built from the family template).
- Optionally `eslint-plugin-better-tailwindcss` (`no-unknown-classes`, `no-restricted-classes`, `no-conflicting-classes`) for editor feedback; the invariants are the CI gate.

**Phase 3 — Components and templates (near-zero diff).** Build `src/components/ds/` (Button, IconButton, Poster, Backdrop, Avatar, the object cards, Sheet, Dialog, Toast+Undo, Tabs, Shelf, RatingInput/RatingDisplay, SpoilerGate, EmptyState, Skeleton, PageHeader, Section, ActionBar) and the seven templates, styled with semantic tokens at *current* values. Replace call sites family by family; screenshot diffs are reviewed per family and should be small. A dev-only, uncrawlable `/app/_ds` route renders every component in every state and is part of the screenshot suite (Storybook + Chromatic only if a second contributor joins).

**Phase 4 — The visual flip (one deploy).** Change token *values* (palette, type scale, spacing rhythm, radii, motion) in `tokens.tokens.json`. Every instance of every component changes at once; re-baseline screenshots in the same PR after reviewing every family at both widths. No route can be left behind because no route owns a colour.

**Phase 5 — Structural changes (per family, short flag).** Navigation (bottom bar), Detail page anatomy, Stream endpoint, logging sheet: each behind a single cookie flag `ui=v2` read in the root layout, dogfooded by the owner for days, then default-on, then the old branch deleted. A `flag-expiry` invariant fails CI if the flag still exists after its date (Hodgson). Order: (1) logging interaction + toast/undo (highest-frequency loop), (2) Detail family, (3) navigation shell, (4) Stream, (5) Collection, (6) Recap, Conversation, Task, Focus.

**Per-route definition of done** (checked in the PR that migrates a family; automated items in bold):
- [ ] **Route is in `ROUTE_FAMILIES` and renders its family template**
- [ ] **Zero invariant violations in the route's files** (no primitives, arbitrary values, raw elements, bare `outline-none`)
- [ ] **Screenshots at 375 and 1280 reviewed and re-baselined; skeleton screenshot matches the loaded layout (CLS ≈ 0)**
- [ ] **axe: zero violations at A/AA**
- [ ] Keyboard path walked by hand: skip link → primary action ≤ 3 tabs → every shelf → footer; focus always visible and unobscured
- [ ] Screen reader pass (VoiceOver iOS + one desktop SR) on the primary task of the route
- [ ] Empty, loading, error and "zero friends" states designed and visible in the `/app/_ds` or fixture set
- [ ] LCP element identified and marked `above`; images below the fold lazy; CWV checked at p75 after deploy (Vercel Speed Insights or CrUX)
- [ ] 200% text and 320 px width usable; reduced-motion checked
- [ ] Copy: object names, counts on section headers, button labels name the consequence

---

## Confidence and gaps

| Claim area | Strength | Why |
|---|---|---|
| Hidden vs visible navigation | Strong | Quantitative, 179 participants, both platforms (NN/g 2016); consistent with Material/HIG conventions. |
| Detail-page structure (no horizontal tabs, no subpages, inline counts) | Strong for e-commerce, **inferred** for titles | Baymard's large-scale testing is on product pages; a title page shares the "scroll to learn, then act" shape, but nobody has published equivalent tests on film/TV pages. |
| Friends' takes before global ratings | Opinion | Follows from letsee's purpose and Baymard's "reviews matter" finding; no direct study. |
| Chronological, finite feed | Moderate | The *Science* 2023 experiments measured time-on-platform and political attitudes, not connection or satisfaction; letsee's choice is a values choice that the evidence does not contradict. |
| One-tap log + optional sheet | Moderate | Built from response-time limits, undo-over-confirm, bottom-sheet guidance and Letterboxd precedent; should be validated by measuring the share of viewings logged with companions after launch. |
| WCAG items | Normative | These are the standard's own requirements; the letsee-specific mappings (posters, spoilers, shelves) are judgement. |
| Token/lint/codemod execution | Strong practice, weak outcome data | GitHub, Shopify and Atlassian all ship token linting and codemods publicly; none publish controlled data on drift reduction. Linear's speed lesson is one company's retrospective. |
| CWV thresholds and image loading | Strong | Google's published thresholds and HTTP Archive analysis. |

**Anti-patterns to reject in review:** horizontal tabs on title pages; a burger as the only mobile navigation; infinite scroll on search, watchlist or cast; confirm dialogs on reversible actions; swipe-only sheet dismissal; spoilers hidden by CSS blur alone; icon-only nav; lazy-loaded hero posters; route-local colours or spacing; a `v2` flag older than a month; "we'll migrate that page later".

---

## Sources

IA & patterns: [OOUX, A List Apart](https://alistapart.com/article/ooux-a-foundation-for-interaction-design/) · [OOUX/ORCA, LogRocket](https://blog.logrocket.com/ux-design/object-oriented-ux-ooux/) · [Top Tasks, Center Centre](https://articles.centercentre.com/?p=877) · [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) · [NN/g Consistency & Standards](https://www.nngroup.com/articles/consistency-and-standards/) · [Material bottom navigation](https://material.io/components/bottom-navigation) · [MDC iOS bottom navigation README](https://github.com/material-components/material-components-ios/blob/c8b8acabf8c78b9e266c33803848e9e67967fe73/components/BottomNavigation/docs/README.md) · [NN/g mobile navigation primer](https://www.nngroup.com/articles/mobile-navigation-patterns/)

Detail pages: [Baymard horizontal tabs](https://baymard.com/blog/avoid-horizontal-tabs) · [Baymard subpages](https://baymard.com/blog/avoid-using-subpages) · [Baymard thumbnails](https://baymard.com/blog/always-use-thumbnails-additional-images) · [Baymard responsive upscaling](https://baymard.com/blog/responsive-upscaling) · [Baymard reviews benchmark](https://baymard.com/product-page/benchmark/page-designs/user-reviews-section)

Feeds: [Guess et al. 2023 via NYU CSMaP](https://csmapnyu.org/research/academic-research/how-do-social-media-feed-algorithms-affect-attitudes-and-behavior-in-an-election-campaign) · [Instagram "You're All Caught Up"](https://about.instagram.com/blog/announcements/introducing-youre-all-caught-up-in-feed) · [TechCrunch on it](https://techcrunch.com/2018/05/21/scroll-responsibly/) · [NN/g infinite scrolling](https://nngroup.com/articles/infinite-scrolling-tips) · [NN/g empty states](https://www.nngroup.com/articles/empty-state-interface-design/) · [Andrew Chen, atomic network](https://lennysnewsletter.com/p/atomic-network)

Forms & logging: [NN/g response times](https://nngroup.com/articles/response-times-3-important-limits) · [React useOptimistic](https://react.dev/reference/react/useOptimistic) · [NN/g confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/) · [Primer confirmation dialog](https://primer.style/product/components/confirmation-dialog/guidelines) · [NN/g bottom sheets](https://www.nngroup.com/articles/bottom-sheet/) · [Letterboxd FAQ](https://letterboxd.com/about/faq/)

Navigation: [NN/g hamburger menus](https://www.nngroup.com/articles/hamburger-menus/) · [NN/g methodology](https://www.nngroup.com/articles/hidden-navigation-methodology/) · [NN/g desktop navigation](https://www.nngroup.com/articles/find-navigation-desktop-not-hamburger/) · [NN/g icon usability](https://www.nngroup.com/articles/icon-usability/) · [NN/g sticky headers](https://www.nngroup.com/articles/sticky-headers/) · [NN/g breadcrumbs](https://www.nngroup.com/articles/breadcrumbs/) · [NN/g search suggestions](https://www.nngroup.com/articles/site-search-suggestions/) · [NN/g scoped search](https://www.nngroup.com/articles/scoped-search/)

Accessibility: [What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) · [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) · [1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) · [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) · [2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) · [2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) · [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [APG carousel](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) · [APG disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) · [APG rating radio group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio-rating/) · [WAI functional images](https://www.w3.org/WAI/tutorials/images/functional/) · [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

Performance: [web.dev Web Vitals](https://web.dev/articles/vitals) · [web.dev LCP lazy-loading](https://web.dev/articles/lcp-lazy-loading) · [web.dev fetch priority](https://web.dev/articles/fetch-priority) · [web.dev content-visibility](https://web.dev/articles/content-visibility) · [Next.js 16 Image](https://nextjs.org/docs/app/api-reference/components/image) · [NN/g skeleton screens](https://www.nngroup.com/articles/skeleton-screens/) · [Harrison et al., progress bars (CHI 2010)](https://www.chrisharrison.net/index.php/Research/ProgressBars2)

Execution: [W3C DTCG 2025.10 announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/) · [DTCG format](https://www.designtokens.org/tr/drafts/format/) · [primer/primitives](https://github.com/primer/primitives) · [primer/stylelint-config](https://github.com/primer/stylelint-config) · [eslint-plugin-primer-react rules](https://github.com/primer/eslint-plugin-primer-react/tree/main/docs/rules) · [primer/css (KTLO)](https://github.com/primer/css) · [Polaris migrator](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/tools/polaris-migrator.mdx) · [stylelint-polaris](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/tools/stylelint-polaris.mdx) · [Atlassian ESLint plugin](https://www.npmjs.com/package/@atlaskit/eslint-plugin-design-system) · [Atlassian codemod-cli](https://www.npmjs.com/package/@atlaskit/codemod-cli) · [Airbnb DLS, Karri Saarinen](https://karrisaarinen.com/dls/) · [Linear redesign](https://linear.app/now/how-we-redesigned-the-linear-ui) · [Tailwind v4 theme](https://tailwindcss.com/docs/theme) · [eslint-plugin-better-tailwindcss](https://github.com/schoero/eslint-plugin-better-tailwindcss) · [eslint-plugin-tailwindcss no-arbitrary-value](https://github.com/francoismassart/eslint-plugin-tailwindcss/blob/master/docs/rules/no-arbitrary-value.md) · [Brad Frost interface inventory](https://bradfrost.com/blog/post/interface-inventory/) · [Playwright screenshots](https://playwright.dev/docs/test-snapshots) · [Playwright a11y](https://playwright.dev/docs/accessibility-testing) · [Chromatic TurboSnap](https://www.chromatic.com/docs/turbosnap/) · [Fowler strangler fig](https://martinfowler.com/bliki/StranglerFigApplication.html) · [Hodgson feature toggles](https://martinfowler.com/articles/feature-toggles.html)

Excluded as unverifiable: vendor-blog statistics attributed to Baymard on sticky add-to-cart conversion lifts.
