# 01 — A dark that feels alive

> Research note for the letsee redesign. Question: how do you build a dark visual system that feels alive, warm and human — not cold, techy or generic — for a social product about film/TV and the people you watch with?
>
> Status: complete, 2026-10-03.
>
> Convention: **[E]** = evidence (a sourced fact). **[O]** = opinion or design judgement. **[Weak] / [Unverified]** = could not be confirmed against a primary source. "Computed" = my own OKLCH / WCAG / APCA / colour-vision-deficiency calculations (method in §1).
>
> **TL;DR.** Use a wine-dark "velvet" base (hue 345, very low chroma, never black), warm ivory text (never white), and one ember accent (the red-orange halo that film leaves around highlights). Give every person an identity hue, and separate two people by *lightness* so the pair survives colour blindness. Poster colour, computed once at ingest, appears only as a bounded wash. Colour does not create connection. The evidence for that is weak to absent (§5). It makes *people* visible.

## 1. Dark UI colour science

**Method note.** Where a value below says "computed", I converted hex to OKLCH and ran WCAG 2 and APCA (0.0.98G constants) with a small script. The APCA implementation reproduces the published reference pairs (#888 on #fff = Lc 63.1; #aaa on #000 = Lc −56.2), so the numbers can be trusted to ±0.1.

### 1.1 Why not pure black
- [E] Material's dark theme baseline surface is `#121212`, not `#000`. Google's reasons: dark grey can show elevation (lighter = higher) and lowers eye strain, because white text on true black is a very harsh contrast. https://m2.material.io/design/color/dark-theme · summary in https://codelabs.developers.google.com/codelabs/design-material-darktheme
- [E] Material 3 sets the dark `surface` at **HCT tone 6, not 0**. Only `surfaceContainerLowest` goes down to tone 4. Source: `material_dynamic_colors.js` in `@material/material-color-utilities` 0.3.0 (https://unpkg.com/@material/material-color-utilities@0.3.0/dynamiccolor/material_dynamic_colors.js).
- [E] OLED "black smear": a pixel at true black is switched off and is slow to turn on. Dark-grey content scrolling over `#000` leaves a purple or grey trail, worst at low brightness. https://piunikaweb.com/2023/05/05/samsung-galaxy-s23-ultra-black-or-purple-smearing-issue/ · https://forums.macrumors.com/threads/iphone-12-oled-black-smearing.2276007/ (press and forum sources: the effect is well known, but there is no peer-reviewed study).
- [E] Apple is the main exception. Its HIG defines a darker *base* background set and a lighter *elevated* set for layered interfaces such as sheets and popovers. https://developer.apple.com/design/human-interface-guidelines/dark-mode. [Observed, not published on that page] iOS's base `systemBackground` in dark mode renders as true black. Discord also ships "Onyx", a true-black theme, as an option, not the default. https://support.discord.com/hc/en-us/articles/42383370736023-Mobile-Visual-Refresh-What-s-Changing
- [O] For letsee, posters are the brightest objects on screen. A base around L 0.16–0.19 lets a poster's own black frame read as "deeper than the room", which looks good, and it keeps the UI from smearing.

### 1.2 Elevation through lightness, not shadow
- [E] Material 2 drew elevation as a white overlay on `#121212`, with more opacity the higher the surface. Material 3 swapped the overlay for fixed **tonal surface roles**. Dark tones: containerLowest **4**, surface/dim **6**, containerLow **10**, container **12**, containerHigh **17**, containerHighest **22**, surfaceBright **24**. Each tone is an L* value. Same source file as above. Role mapping: https://docs.flutter.dev/release/breaking-changes/new-color-scheme-roles
- [E] M3 also **tints its neutrals**. The neutral palette uses the *source hue* at HCT chroma ~6, so its "greys" lean toward the brand colour (`scheme_tonal_spot.js`, same package). Radix does the same with tinted greys (`mauve`, `slate`, `sage`, `olive`, `sand`) and advises pairing an accent with "the gray scale which is saturated with the hue closest to your accent hue". https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette
- [E] Apple uses "base" and "elevated" background sets, and the elevated set is lighter. https://developer.apple.com/design/human-interface-guidelines/dark-mode
- [E] Shadows barely show against a near-black page, so dark systems lean on lighter fills and hairline borders. Linear ships both solid borders (`#23252a`) and translucent ones (`#ffffff14`) (inspected in linear.app's production CSS, 2026-10).

### 1.3 Halation: pure white on black
- [E] Halation is the glow or bleed around light text on a dark ground. Trimble's Modus system notes it "intensifies with reading white text on black" and is worse for people with astigmatism, especially with "pure white on pure black". https://modus-v1.trimble.com/foundations/dark-mode/ · https://a11ywithdiana.substack.com/p/and. The mechanism: a dark screen lets the pupil dilate, and "smaller pupil sizes make the eyes less susceptible to spherical aberrations" (NN/g). https://www.nngroup.com/articles/dark-mode/
- [E] Positive polarity (dark text on light) beats negative polarity for proofreading and acuity in young and old adults, and the advantage grows as font size shrinks (Piepenbrock et al. 2013 and 2014, summarised by NN/g; https://doi.org/10.1080/00140139.2013.790485). https://www.nngroup.com/articles/dark-mode/. **Implication:** a dark product has to make up for it with larger body text, generous line height and off-white text.
- [E] Material 3's dark `onSurface` is **tone 90, not 100**, and `onSurfaceVariant` is tone 80 (same source file). Linear's primary text is `#f7f8f8`, about oklch 0.978. GitHub dark-dimmed uses `#d1d7e0`, about oklch 0.877 (computed from production CSS and `@primer/primitives` 11.10).

### 1.4 Contrast on dark: WCAG 2.2 vs APCA
- [E] WCAG 2.2 still requires 4.5:1 for normal text, 3:1 for large text, and 3:1 for non-text UI parts and focus indicators. https://www.w3.org/TR/WCAG22/#contrast-minimum · https://www.w3.org/TR/WCAG22/#non-text-contrast
- [E] The WCAG 2 ratio overstates contrast between dark colours. APCA models polarity, so the same pair scores differently depending on which colour is the text, and it reports much lower contrast for dark pairs. https://github.com/Myndex/apca-introduction
- [E, computed] `#777` text on `#000` passes WCAG at 4.69:1 but scores only **APCA Lc −30.6**, below body-text usefulness. The same grey on white scores 4.48:1 (fail) but **Lc 71.1**. On a dark UI, WCAG will happily pass muted text that is actually hard to read.
- [E] APCA guide levels: Lc 90 preferred for body text, Lc 75 minimum for body text, Lc 60 for content text, Lc 45 for large or heading text, Lc 30 for placeholder and disabled text, Lc 15 as the floor for non-text. https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell. APCA is **not** a WCAG 2.2 conformance method. WCAG 3 is still a draft. https://www.w3.org/TR/wcag-3.0/
- [O] Ship-gate on WCAG 2.2 AA (it is the legal baseline). *Design* to APCA, so muted text reaches Lc ≥ 60 and anything someone must read reaches Lc ≥ 75.

### 1.5 Why saturated colours vibrate on dark, and how to tune chroma
- [E] Material: saturated colours "can visually vibrate against dark surfaces", so use lighter, desaturated tones (the 200 tone) for primary colours in dark theme. https://m2.material.io/design/color/dark-theme · https://codelabs.developers.google.com/codelabs/design-material-darktheme. M3's dark `primary` is tone 80 (source file above).
- [E, computed] On `#121212`: pure blue `#0000ff` reaches only 2.18:1 / Lc −15.6. Netflix red `#e50914` reaches 3.91:1, which fails as text. Linear's accent `#7170ff` reaches 4.87:1 but only Lc −35.5. Saturated blues and violets have low luminance, so they look vivid but carry little actual contrast.
- [O] Rule of thumb in OKLCH. On a surface at L ≈ 0.18, an accent used as text or icon needs **L ≥ 0.72** with **C ≤ 0.16**. An accent used as a fill (button, chip) can sit at L 0.62–0.70 with C up to 0.18, carrying dark text on top. Above C ≈ 0.18–0.20, a hue at mid lightness starts to "buzz" at its edges against near-black, especially red against blue-black.

### 1.6 OKLCH / LCH for perceptually even scales
- [E] Linear moved its theme engine from HSL to LCH because in LCH "a red and a yellow color with lightness 50 will appear roughly equally light". The generator now takes **3 inputs (base, accent, contrast)** instead of the 98 variables each theme used to need. https://linear.app/now/how-we-redesigned-the-linear-ui
- [E] OKLCH keeps perceived lightness when hue changes. HSL does not: `hsl(60 100% 50%)` yellow looks far brighter than `hsl(240 100% 50%)` blue. OKLCH also reaches P3 colours. https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl. Tool for building palettes this way: https://evilmartians.com/chronicles/exploring-the-oklch-ecosystem-and-its-tools
- [E] Material's HCT turns contrast into tone arithmetic: a tone difference of 40 guarantees ≥ 3:1 and a difference of 50 guarantees ≥ 4.5:1. https://material.io/blog/science-of-color-design
- [E] Tailwind CSS v4 defines its default palette in OKLCH, so `oklch()` tokens drop straight into `@theme`. https://tailwindcss.com/docs/colors

### 1.7 How many surface levels does a dark UI need?
- [E] Systems people trust ship **4–6 opaque surface steps**. Linear: `bg-level-0..3` = `#08090a #0f1011 #141516 #191a1b`, which is OKLCH L 0.139 / 0.172 / 0.195 / 0.217 (ΔL ≈ 0.02–0.03 per step). Raycast: grey-900..600 = `#07080a #0c0d0f #111214 #1b1c1e` (L 0.134–0.226). GitHub dark: `#010409 / #0d1117 / #151b23` (inset / default / muted). M3: 7 tones, of which about 5 get regular use. Radix: steps 1–2 backgrounds, 3–5 component states, 6–8 borders. https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- [O] letsee needs **5**: page, raised (cards/rows), overlay (sheets, menus, dialogs), plus two *interaction* states (hover and pressed/selected). Elevation steps of ΔL ≈ 0.035–0.045 in OKLCH are visible on a phone at 50% brightness. Linear's ~0.02 steps work on calibrated desktop monitors but vanish on a dim phone.

## 2. Case studies

"Inspected" means I took the values from the product's production CSS on 2026-10-03 (linear.app, raycast.com, open.spotify.com, discord.com, vercel.com, criterionchannel.com, mubi.com, culturedcode.com, teenage.engineering, arc.net) or from its published token package. Letterboxd and Netflix block scripted fetches or keep tokens out of public CSS, so their values come from third-party extractions and are marked that way. OKLCH values are computed.

| Product | Base → raised surfaces | Text | Accent | Temperature read |
|---|---|---|---|---|
| **Linear** (inspected) | `#08090a` L.139 → `#0f1011` → `#141516` → `#191a1b` L.217, hue 248 at C .003 | `#f7f8f8` / `#d0d6e0` / `#8a8f98` | `#7170ff` oklch(.623 .207 279) | Cold. Near-achromatic blue-black with an indigo accent; "deep space" |
| **Raycast** (inspected) | `#07080a` → `#0c0d0f` → `#111214` → `#1b1c1e` (hue ~263) | grey-200 `#9c9c9d` body | red `#ff6363`, kept for the hero | Cool base, made warm by a single hot red and glossy macOS-style keycap shadows |
| **Spotify** Encore (inspected) | `#121212` → highlight/elevated `#1f1f1f` → `#2a2a2a`; press `#000` | `#fff` / subdued `#b3b3b3` (Lc −60.6) | `#1ed760` with **black** text on it (white on that green is 1.92:1) | Neutral. The warmth comes from album-art gradients, not the chrome |
| **GitHub dark** (`@primer/primitives` 11.10) | inset `#010409` / default `#0d1117` / muted `#151b23` | `#f0f6fc` / `#9198a1` | `#4493f8` | Cool, blue-black hue 258 |
| **GitHub dark dimmed** | inset `#151b23` / default `#212830` L.274 / muted `#262c36` | `#d1d7e0` (L.877, deliberately not white) | `#478be6` | Softer and lower contrast; feels like slate, not a void |
| **Vercel Geist** (inspected) | `background-100/200` = `#000`; gray-100 `#1a1a1a` | gray-1000 `#ededed` | blue-700 `oklch(57.61% .2321 258.23)` | Clinical. True black, zero chroma, on purpose |
| **Discord** (inspected) | Classic dark neutrals `#2c2d32`–`#36373e` (HSL hue ~230°, ~6% sat → oklch C ≈ .01, hue 277); Onyx = true black | — | blurple `#5865f2` | Cool-lavender grey. User "saturation" setting multiplies every neutral's saturation |
| **Letterboxd** (3rd-party extraction¹) | `#14181c` oklch(.207 .010 248) / poster well `#12161a` / raised `#283038` | `#fff` heads, `#99aabb` body (Lc −54), `#667788` meta (3.87:1, **fails AA**) | green `#00e054`, orange `#ff8000`, blue `#40bcf4` | Blue-slate "night sky". Three saturated logo dots on a desaturated ground |
| **Netflix** (3rd-party²) | `#000` / `#141414` | `#fff` | `#e50914` (white on it = 4.79:1) | Neutral black, theatrical. Red is kept to one action |
| **Criterion Channel** (inspected) | `#121212`, `#181818`, `#222` | `#fff`, `#d2d2d2`, `#929292` | ochre-gold `#b4841e` oklch(.644 .124 81) | Warm. One antique-gold accent on neutral black reads as "cinematheque" |
| **MUBI** (inspected) | black / white; pages use deep ultramarine `#001489`, `#001aaf` | `#fff`, `#c8c8c8` | the blue *is* the brand | Saturated, cool and confident. Colour as identity |
| **Things** (site dark mode, inspected) | `#212224` oklch(.252 .004 264) | `#f0f1f2` | blue lifts from `#2576eb` (light) to `#649fff` / `#92bbfe` (dark) | Calm and soft. Shows the rule "raise the accent's L in dark mode" |
| **Teenage Engineering** (inspected) | Neutral greys `#272727`–`#e5e5e5` | — | `--te-orange #f05a24`, `--te-yellow #fab413`, `--te-red #b81d13`, `--te-green #006837` | Industrial but joyful. Each saturated colour has a job, the way coloured keys do |
| **Arc** (marketing site, inspected) | cream `#fffcea` (light site); in the app, users pick their own Space colour/gradient | — | `#3139fb` | Warm and personal. The user owns the colour |
| **Apple TV app** (tvOS 26) | Dark, with "cinematic poster art" that "incorporates Liquid Glass" | — | — | The content is the colour. https://www.apple.com/newsroom/2025/06/apple-tv-brings-a-beautiful-redesign-and-enhanced-home-entertainment-experience/ |
| **A24** (inspected) | Near-monochrome greys (`#888`, `#cacaca`, `#444`, `#000`) | — | none | Gallery-neutral. Film stills supply all the colour |

¹ https://www.shadcn.io/design/letterboxd (described as extracted from the live site). Letterboxd's own brand page lists no colour values: https://letterboxd.com/about/brand/
² https://www.webdesignhot.com/design.md/netflix/ ; Netflix's homepage HTML confirms `#000` backgrounds and a `#e50914` fill (inspected).

Sources for the rows above: Linear https://linear.app/now/how-we-redesigned-the-linear-ui · Primer https://cdn.jsdelivr.net/npm/@primer/primitives/dist/css/functional/themes/dark-dimmed.css · Discord themes https://support.discord.com/hc/en-us/articles/42383370736023-Mobile-Visual-Refresh-What-s-Changing (Light/Ash/Dark/Onyx; Ash is the "OG" dark; Onyx is true black) · MUBI identity by Spin https://spin.co.uk/projects/mubi · Tailwind palette https://tailwindcss.com/docs/colors

**What separates warm from cold here** (the evidence is in the table; the reading is [O]):
1. **Base chroma and hue.** Every "techy" base (Linear, Raycast, GitHub, Vercel, Tailwind `zinc` at hue 286) is either achromatic or blue-violet (hue 248–286), at C ≤ 0.018. None of the case studies uses a *warm* base. That gap is letsee's opportunity.
2. **Where the warmth comes from.** Warm-feeling dark products take it from **content** (Spotify, Apple TV, A24), from **one warm accent** (Criterion's ochre, Raycast's red), or from **the user** (Arc, Discord's custom themes). None of them gets it from a saturated chrome.
3. **Accent discipline.** Netflix keeps red for one action, and Raycast's red mostly lives in the hero. Letterboxd's green, orange and blue appear to be tied to specific actions (watched / like / watchlist icons; observed in the product, not documented). Teenage Engineering gives each colour a function.
4. **Low contrast reads as "film", until it fails.** Letterboxd's slate-blue text on slate (`#99aabb`, `#667788`) is a big part of its moody feel, and its metadata text fails WCAG AA. GitHub dimmed shows the same mood can stay within AA.
5. **The current letsee palette** is Tailwind `zinc-950` (oklch .141 .004 286, faintly violet-cold) + `green-500` (oklch .723 .219 150) + IMDb gold `#f5c518`. That is the default Tailwind dark recipe: cool, generic, and the green says "success state" or "Spotify" rather than "letsee".

## 3. Colour that comes from the content

### 3.1 How the big products do it
- [E] **Apple Music API.** Every `Artwork` object ships with precomputed `bgColor` ("the average background color of the image") and `textColor1`–`textColor4` ("used if the background color gets displayed"). Apple computes the colours once on its servers and sends them with the metadata, so the client does no image work. https://developer.apple.com/documentation/applemusicapi/artwork
- [E, inspected] **Spotify web player.** Cover-art metadata carries `extractedColors { colorDark, colorLight, colorRaw, isFallback }`, so a dark-UI variant, a light-UI variant and the raw colour are all computed server-side, along with a flag for when extraction failed. Album headers then fade the extracted colour into `--background-base` (`linear-gradient(…, var(--background-base) 75%)`). Source: `web-player.*.js` / `.css` on open.spotify.com, 2026-10.
- [E] **Material You / M3.** Android takes a *source colour* from the wallpaper, derives five key colours, expands each into a 13-tone palette, and assigns roles at fixed tones. Contrast is built into the role tones, not checked per image. https://developer.android.com/develop/ui/views/theming/dynamic-colors. M3 also has image-oriented variants: `SchemeContent` and `SchemeFidelity` keep the seed's own chroma in `primaryContainer` but "adjusted to ensure contrast with surfaces". https://api.flutter.dev/flutter/package-material_color_utilities_scheme_scheme_fidelity/SchemeFidelity-class.html
- [E, inspected] **Discord custom themes.** Every surface token is `color-mix(in oklab, var(--neutral-N) 100%, var(--custom-theme-base-color, #000) var(--custom-theme-base-color-amount, 0%))`, with an amount around 20% when a theme is on. That is a pure-CSS way to tint a whole ladder with one runtime colour without breaking its lightness order (discord.com CSS, 2026-10).
- [E] **Apple TV app (tvOS 26).** Poster art carries the colour: "beautiful new poster art that incorporates Liquid Glass". https://www.apple.com/newsroom/2025/06/apple-tv-brings-a-beautiful-redesign-and-enhanced-home-entertainment-experience/
- [Weak] **YouTube "ambient mode"** (2022) casts a soft glow of the video's colours onto the dark page around the player. It is widely known, but I could not reach a primary Google source this session, so treat the details as unverified.

### 3.2 Keeping text accessible over extracted colour
- [E] Every system above **fixes the text ladder and bounds the background**. M3 does it with role tones. Apple does it by sending text colours computed per artwork. Spotify ships a separate `colorDark` for dark UI. None of them puts raw poster colour behind body text.
- [E, computed] On letsee's proposed base, a poster wash limited to **L ≤ 0.30 and C ≤ 0.06** keeps primary text at APCA Lc ≥ 91 and secondary text at Lc ≥ 62 for *every* hue (I swept hue 0–360 in 5° steps). Bounding L and C is enough. No per-image contrast check is needed.
- [E] `contrast-color()`, which returns black or white for a given background, reached Baseline in April 2026 (Chrome 147, Firefox 146, Safari 26). It is a fallback for chips that sit on poster colour, not a design tool. web-features data: https://github.com/web-platform-dx/web-features

### 3.3 Cheap implementations (no per-request server cost)
- [E] `sharp` `stats()` returns `dominant`, "the most dominant sRGB colour based on a 4096-bin 3D histogram". Run it once when a title is first cached and store the result. https://sharp.pixelplumbing.com/api-input
- [E] `color-mix()` and `oklch()` are **Baseline widely available** (Chrome 111, Firefox 113, Safari 16.2; "high" since 2025-11-09). **Relative colour syntax** (`oklch(from var(--poster) 0.28 min(c, 0.05) h)`) is **Baseline 2024** (Chrome 122/125, Firefox 128, Safari 18). Gradient interpolation (`linear-gradient(in oklch, …)`) is Baseline 2024. Data from web-features (`relative-color`, `color-mix`, `oklab`, `gradient-interpolation`); MDN https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors
- [O] Pipeline for letsee: when a TMDB title is ingested, take the poster at w92, run `sharp().stats()` to get the dominant colour, convert it to OKLCH, and store `poster_h` (int) and `poster_c` (float, capped). Then render `style="--ph: 212; --pc: .05"` on the title root, and let tokens derive the wash/glow/ring in CSS. Cost is one column and one inline style. No client canvas, no edge function.

## 4. Warm darks vs cool darks, and cinema material

### 4.1 Evidence
- [E] "Warm–cool" (colour heat) is one of three robust colour-emotion factors, with activity and weight. It was largely consistent between British and Chinese observers. Small sample: N = 31. Ou et al. 2004, https://doi.org/10.1002/col.20010
- [E] Wilms & Oberfeld 2018 (N = 62, hue, saturation and brightness varied independently): **saturated and bright colours raise arousal and valence**. Arousal rises from blue to green to red. Achromatic colours briefly *slowed* heart rate. https://doi.org/10.1007/s00426-017-0880-8. **Implication:** a dark, desaturated base is by nature calm and low in arousal. "Alive" has to come from small, bright, saturated areas set against that calm, not from a coloured base.
- [E] Ecological valence theory: people like colours tied to things they like (blues: sky, clean water) and **dislike browns** (faeces, rotten food). Palmer & Schloss 2010, PNAS, https://doi.org/10.1073/pnas.0906172107. This argues against a brown-black base. Raised brown-greys at L 0.25–0.35 look like coffee or mud.
- [E] **Projector light is not warm.** The DCI-P3 cinema white point comes from a xenon bulb at ~6300 K and is "slightly greener" than D65. https://en.wikipedia.org/wiki/DCI-P3. A xenon short-arc lamp runs around 6200 K. https://en.wikipedia.org/wiki/Xenon_arc_lamp
- [E] **Film adds red warmth at the highlights.** Even with anti-halation backing, most film stock "renders a slight red halo around the brightest elements". https://en.wikipedia.org/wiki/Anti-halation_backing
- [E] Orange-and-teal grading spread through Hollywood from about 2010. https://en.wikipedia.org/wiki/Color_grading
- [E] **Purkinje shift:** in low light, the eye's sensitivity moves toward blue, so "reds will appear darker". https://en.wikipedia.org/wiki/Purkinje_effect. A warm accent seen at night at low screen brightness needs *extra* lightness to hold up.
- [E, skeptical] The "warm light feels cosy when it's dim" rule, the Kruithof curve, rests on thin data. Fotios's 2017 review of the credible studies found they "do not support Kruithof" and "do not favor any CCT". https://doi.org/10.1080/15502724.2016.1159137

### 4.2 Reading the hue options for a base (all at L ≈ 0.165, C ≈ 0.016; hex computed) [O]
| Base hue | Hex | Reads as |
|---|---|---|
| blue-black h250 | `#090f15` | Night sky, GitHub, Letterboxd. The default. Competent, but it's the default |
| ink / indigo h268 | `#0b0e15` | Terminal, Linear, Discord, Tailwind `zinc`. "Software" |
| plum h320 | `#110c13` | Evening and twilight. Soft and slightly romantic |
| **aubergine–velvet h335–350** | `#130c11` / `#140c0f` | Theatre seat, wine, the inside of a cinema with the house lights down. Warm without being brown |
| oxblood h10 | `#150b0d` | Intense. Reads as horror or error once surfaces lift |
| warm brown h55 | `#140d08` | Leather and coffee. Cosy at L .16, muddy at L .30 (Palmer & Schloss) |
| olive h100 | `#100f07` | Military, old monitor |
| green-black h160 | `#08110c` | Terminal or Matrix. Wrong for this product |

[O] The material to copy for "a dark room with people in it" is **velvet under low house light**: a near-black that is faintly wine-coloured. Inside it sit **light sources**: the screen (cool and neutral, like a projector), a lamp (warm), a film's red halation around highlights, and faces. In the UI, the base is the room, posters are the screen, and the accent and person colours are the lamps and faces. Keep the cool, screen-like light for the *posters themselves*. Do not tint the chrome blue.

## 5. Colour and social warmth: what the evidence does and doesn't say

| Claim | Evidence | Strength |
|---|---|---|
| Holding something warm makes you see others as warmer | Williams & Bargh 2008, *Science* (N = 41 and 53) https://doi.org/10.1126/science.1162548 | **Did not replicate.** Lynott et al. 2014 ran three high-powered replications and found no effect https://doi.org/10.1027/1864-9335/a000187. Chabris et al. 2019 used samples three times larger, double-blind, and found r = −.03 and .02 https://doi.org/10.1027/1864-9335/a000361 |
| Red increases romantic attraction | Elliot & Niesta 2008 | **Weak or absent.** Two pre-registered replications found d = 0.09 for men and d = −0.09 for women (N = 242 / 360). Lehmann & Calin-Jageman 2017 https://doi.org/10.1027/1864-9335/a000296 |
| People link colours to emotions in similar ways across cultures | 4,598 people, 30 nations, average similarity r = .88. Nationality still predicts differences beyond that https://doi.org/10.1177/0956797620948810 | **Strong**, but only for verbal associations. It does not show that colour causes an emotion |
| Saturated and bright colours raise arousal and valence | Wilms & Oberfeld 2018, N = 62, with physiological measures | **Moderate.** Lab study, single colours seen for 30 s |
| Colour changes behaviour in general | Elliot & Maier 2014, *Annual Review*: the field is "at a nascent stage"; much more work is needed "before strong conceptual statements and recommendations for application are warranted" https://doi.org/10.1146/annurev-psych-010213-115035 | Field-level caveat |

**What this means for letsee [O]:** there is **no good evidence that any colour makes people feel more connected**. Physical-warmth priming, the closest effect, failed to replicate. Colour can do three defensible jobs:
1. **Set a mood that people recognise.** Colour-emotion associations are shared enough (r = .88) that warm, low-arousal darks with small bright accents will read as "evening, intimate" to most people. Expect some cultural drift, so test with the users you actually have.
2. **Mark people.** Colour is a strong cue for *who* (identity), which is the product's subject.
3. **Build familiarity.** A consistent hue tied to a friend grows meaning through repeated use. That is learned association, not a property of the hue.
The warmth that matters will come from faces, names, "with Priya", shared dates and comparisons. Colour should make those things impossible to miss. It is not a replacement for them.

## 6. Two-person colour

### 6.1 Precedents
- [E] **iMessage** uses colour for *self vs. channel*: your iMessages are blue, SMS/RCS messages are green, and the other person's bubbles are grey. https://support.apple.com/en-us/104972. The pattern is asymmetric: a colour for me, neutral for them.
- [E] **Telegram** gives each peer an accent colour from **7 base colours** (red, orange, violet, green, cyan, blue, pink), with separate `dark_colors` variants, and users can choose their own palette. https://core.telegram.org/api/colors. The pattern is a symmetric identity colour that works in both themes.
- [E] **Figma** shows "the cursor and selection of all active participants" plus an avatar for each person. Presence is the feature. https://www.figma.com/blog/multiplayer-editing-in-figma/ (the post does not document how colours are assigned).
- [E] **Spotify Blend** is a shared playlist (up to 10 people) with a "taste match" score and its own cover art. https://newsroom.spotify.com/2021-08-31/how-spotifys-newest-personalized-experience-blend-creates-a-playlist-for-you-and-your-bestie/ · https://support.spotify.com/us/article/blend/. Spotify's identity uses screen-print **duotones** and "bold, high-contrast color pairs". https://www.wearecollins.com/work/spotify. On the web, a duotone is one SVG `feColorMatrix` filter. https://jmperezperez.com/duotone-using-fecolormatrix/
- [E] **Apple Watch Activity sharing** lets two people compete for 7 days on points. The documentation describes no per-person colour, because the ring colours belong to the *metric*. https://support.apple.com/guide/watch/share-your-activity-apd68a69f5c7/watchos. This is the counter-pattern: colour means "what", and the name and avatar mean "who".
- [E] **Discord** lets the user colour the room itself, by mixing a chosen colour into every surface (§3.1).
- [Unverified] Co-Star is widely seen as monochrome, with two-person compatibility charts. I could not confirm details from a primary source.

### 6.2 The colour-vision problem with N identity hues [E, computed]
With 8 identity hues at the *same* lightness (oklch L .80, C .11), simulated colour-vision deficiency (Machado 2009 matrices) makes several pairs nearly identical. Under deuteranopia, **rose–jade ΔE_ok = 1.4**, **lagoon–orchid = 0.5** and **cornflower–iris = 0.3**. A 1-in-12 share of men have a colour-vision deficiency, most often red–green (https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/color-blindness). Equal-lightness identity colours therefore *cannot* carry "which of us" alone.
**Fix:** split the two people by **lightness as well as hue**. If one person is drawn at L .86 and the other at L .70, the worst pair across all 64 combinations and all three simulated deficiencies is **ΔE_ok 8.8**, which stays distinct. This matches Okabe & Ito's advice to vary brightness, alternate warm and cool, and add shape and position. https://jfly.uni-koeln.de/color/

### 6.3 Ways two colours can meet in one element [O]
1. **Thread:** a 2px line along a shared card's edge, `linear-gradient(90deg in oklch, var(--them), var(--you))`. It shows the viewing was shared without adding clutter.
2. **Lens:** two avatar rings overlap, and the overlap is filled with `color-mix(in oklch, var(--them), var(--you))`. It is the literal "us" shape.
3. **Duotone:** shared-year recaps render a poster with shadows in one person's deep tone and highlights in the other's light tone. Decorative only, never used to identify a poster.
4. **Split numerals:** "You 8 · Priya 6", with each numeral (large, ≥ 24px) in its owner's colour and the gap shown as a two-colour bar.
5. **Room glow:** a Tonight room's ambient wash is the bounded mix of its participants' hues, so the room takes on the colour of the people in it.

## 7. Accessibility traps specific to dark themes and accents
- [E] **Colour alone** (WCAG 1.4.1): every person colour needs a name or avatar, and every semantic colour needs an icon or word. https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- [E] **Non-text contrast** (WCAG 1.4.11): input borders, icons and focus rings need 3:1 against what is next to them. A subtle border at L .30 on an L .165 page is only 1.4:1, which is fine as a decorative divider but fails as the only edge of an input. Input edges need about L ≥ .55: 3.9:1 on the page and 3.3:1 on overlays (computed). https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- [E] **Focus** (2.4.7 AA, 2.4.11 AA, 2.4.13 AAA): the AAA bar is an indicator at least as large as a 2 CSS px perimeter with 3:1 change between states. https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html. Vercel's dark focus ring is two-layer: `0 0 0 1px gray-600, 0 0 0 4px #ffffff3d` (inspected). A two-tone ring (page-colour gap plus a bright outer ring) also survives on top of poster images.
- [E] **Reduced transparency:** `prefers-reduced-transparency` works in Chromium only (118+) and is not Baseline. `backdrop-filter` is Baseline 2024. Glass effects therefore need a solid, opaque fallback by default, not only behind the media query (web-features data).
- [E] **More contrast:** `prefers-contrast` (Baseline high) and `forced-colors` (Baseline high) should swap in a high-contrast token set. Linear's theme generator and Discord's settings (contrast and saturation) both treat contrast as a user setting (§1.6, §2).
- [E] **Vibrating accents and halation** (§1.3, §1.5): use desaturated, lightened accents and off-white text. WCAG passes many muted greys on dark that APCA scores as hard to read (§1.4).
- [O] **Red and green for "liked/disliked" or rating gaps** is the classic trap. Use the sign, an arrow and the person's colour, not red versus green.
- [O] **Low-contrast "moody" metadata** (Letterboxd's `#667788`, 3.87:1) is the easiest way to get atmosphere and the easiest way to fail AA. Put the atmosphere into surfaces, not text.

## Recommendation for letsee

> Everything in this section is **[O] design judgement** built on the evidence above. All contrast numbers are computed against `--bg` unless stated. Define tokens in OKLCH: Tailwind v4 already does, and `oklch()` is Baseline widely available. Use the hex values only where OKLCH can't go (OG images, `theme-color`, email).

**Concept: "Velvet and lamplight."** The room is a wine-dark velvet. The interface is lamplight: ivory text and one ember accent. Every other saturated pixel is a **person** or a **film**.

### R1. Base hue and surface ladder: hue 345 ("velvet"), chroma 0.012–0.02
| Token | OKLCH | Hex | Use |
|---|---|---|---|
| `--bg-sunken` | `oklch(0.135 0.012 345)` | `#0c0709` | Poster wells, inset inputs, the player-dark behind a hero |
| `--bg` | `oklch(0.165 0.014 345)` | `#130c10` | Page. CIELAB L* ≈ 4, a little darker than Material's `#121212` (L* 5.5) but not black: pixels stay lit, so no OLED smear, and posters still read deeper than the room |
| `--bg-raised` | `oklch(0.205 0.016 345)` | `#1d1419` | Cards, list rows, the bottom nav |
| `--bg-overlay` | `oklch(0.245 0.018 345)` | `#271d22` | Sheets, menus, dialogs, popovers |
| `--bg-hover` | `oklch(0.285 0.018 345)` | `#31272c` | Hover/pressed on any surface (or +0.04 L relative to its surface) |
| `--bg-selected` | `oklch(0.325 0.020 345)` | `#3c3036` | Selected rows, active segmented control |
| `--line` | `oklch(0.30 0.018 345)` | `#352a30` | Decorative dividers only (1.4:1) |
| `--line-strong` | `oklch(0.42 0.020 345)` | `#564950` | Card outlines on raised surfaces |
| `--line-input` | `oklch(0.55 0.020 345)` | `#7b6d74` | Input/checkbox edges: 3.9:1 on page, 3.3:1 on overlay (meets 1.4.11) |

Steps are ΔL 0.04, about twice Linear's, so they still show on a dim phone. Elevation comes from lightness and a hairline border. Use no drop shadows on dark, except a large, soft, low-opacity shadow under overlays to separate them from posters.

### R2. Text ladder: warm ivory, never pure white
| Token | OKLCH | Hex | vs `--bg` | Use |
|---|---|---|---|---|
| `--text-1` | `oklch(0.95 0.012 75)` | `#f3ede6` | 16.6:1 · Lc −96 | Titles, body, names |
| `--text-2` | `oklch(0.82 0.016 60)` | `#ccc2ba` | 11.0:1 · Lc −70 | Secondary copy, labels, review text |
| `--text-3` | `oklch(0.72 0.018 50)` | `#aea29b` | 7.8:1 · Lc −53 | Metadata ≥ 14px (year, runtime, timestamps). Not for sentences |
| `--text-off` | `oklch(0.50 0.014 40)` | `#6b615d` | 3.2:1 · Lc −21 | Disabled only |

Body text ≥ 16px with line-height ≥ 1.5, to offset negative polarity (§1.3). Text never derives from poster colour.

### R3. One primary accent: "Ember" (the halation colour)
| Token | OKLCH | Hex | Notes |
|---|---|---|---|
| `--ember` | `oklch(0.76 0.14 42)` | `#fb9167` | Primary button fill, focus ring, live dot, active tab indicator. 8.6:1 on `--bg` |
| `--ember-hover` / `--ember-press` | `oklch(0.80 0.13 46)` / `oklch(0.70 0.14 40)` | `#ffa478` / `#e67d58` | |
| `--on-ember` | `oklch(0.18 0.02 345)` | `#180e14` | **Dark** label on ember: 8.4:1 (white on ember is 2.25:1, never use it) |
| `--ember-text` | `oklch(0.82 0.12 45)` | `#ffae89` | Accent used as text or links: 10.7:1 · Lc −69 |
| `--ember-tint` | `oklch(0.30 0.06 40)` | `#472215` | Selected chip and "Tonight is live" banner background (`--text-1` on it is 12:1) |

**Why ember:** (a) It is the warm red-orange that film adds around highlights (§4.1). The cinema reference comes from the medium, not from nostalgia. (b) No one in the category owns it: Letterboxd is green and blue (its orange `#ff8000` is hotter and, per the third-party extraction, reserved for Pro badges), Netflix is pure red, Criterion is ochre, MUBI is ultramarine, Spotify is green, Linear is indigo. (c) It sits next to the velvet base (h 345 → 42), so the palette reads as one warm room rather than "dark theme + brand colour". (d) Chroma 0.14 at L 0.76 is bright enough to feel alive and below the vibration zone (§1.5). It also gets past the Purkinje dimming of reds at night (§4.1) by being an orange of high lightness. **Ember is for action and "live" only**. It is never decoration and never a status.

### R4. Person colours: identity hue × role lightness
- **Eight identity hues**, assigned by `hash(user_id) % 8` and changeable by the user, as in Telegram. The ember band h 20–60 stays free so a person is never mistaken for an action: rose 0, marigold 80, moss 125, jade 165, lagoon 205, cornflower 250, iris 290, orchid 325.
- **Four tones per hue:** `lit` L .86 C .10 · `deep` L .70 C .12 · `fill` L .40 C .08 · `tint` L .27 C .045.

| Hue | lit | deep | fill | tint |
|---|---|---|---|---|
| rose 0 | `#ffbbcf` | `#da7d9b` | `#6a3446` | `#381d25` |
| marigold 80 | `#f4ca84` | `#c5953b` | `#5e4205` | `#32240a` |
| moss 125 | `#c2dd94` | `#8dab54` | `#3e4f1a` | `#212a10` |
| jade 165 | `#8fe6c1` | `#46b68c` | `#0a553d` | `#0d2d21` |
| lagoon 205 | `#79e4f0` | `#00b3c2` | `#005259` | `#012d31` |
| cornflower 250 | `#aed5ff` | `#61a3e6` | `#224a71` | `#14283c` |
| iris 290 | `#d0c9ff` | `#9e91e4` | `#473f70` | `#26223b` |
| orchid 325 | `#f3bbf5` | `#c483c7` | `#5d385f` | `#321e33` |

- **In any two-person view, the other person is lit (L .86) and you are deep (L .70).** Lightness, not hue, carries "which of us". The worst pair across all 64 combinations under simulated protan, deutan and tritan vision is still ΔE_ok 8.8 (§6.2). A shared hue still works. Keep the order fixed; the product's existing "You 8, Priya 6" order is fine.
- Person colour shows up as avatar rings, dots, bars, threads, and numerals ≥ 24px. **Never** use it for small text (the deep tier is only Lc ≈ −48); names stay `--text-1`.
- **"Us"** is shown where two colours meet: the gradient thread (`in oklch`), the lens (`color-mix(in oklch, them, you)`), split numerals, and duotone recaps (§6.3). A shared object never carries only one person's colour.

### R5. Semantic colours (always with an icon or word; WCAG 1.4.1)
| Token | OKLCH | Hex | vs `--bg` |
|---|---|---|---|
| `--success` | `oklch(0.78 0.12 160)` | `#6bcf9d` | 10.1:1 |
| `--warn` | `oklch(0.80 0.14 70)` | `#f7ac4d` | 10.1:1 |
| `--danger` / `--danger-text` | `oklch(0.70 0.17 22)` / `oklch(0.74 0.15 22)` | `#f66c6d` / `#fb817f` | 6.7:1 / 7.9:1 |
| `--rating` (stars, "marquee gold") | `oklch(0.85 0.12 88)` | `#eec96c` | 12.1:1 · Lc −76 |
| `--info` | `oklch(0.80 0.08 235)` | `#8ac7ea` | 10.5:1 |

Ember sits close to danger (ΔE_ok 8.6, 6.5 under deutan) and to warn (7.7). So: destructive buttons are neutral with `--danger-text` plus a trash or alert icon, never an ember-like fill. Warn always has its triangle. Stars use `--rating` for a single rating. In comparisons, each person's score uses *their* colour, and the gap is shown by sign or arrow, never red versus green.

### R6. Poster-derived colour: used, but bounded
1. **Compute once**: at TMDB ingest, run `sharp(posterW92).stats().dominant`, convert to OKLCH, and store `poster_h` and `poster_c` (§3.3). There is no request-time cost. Expose them as `--ph` / `--pc`, plus `--poster: oklch(0.60 var(--pc) var(--ph))`.
2. **Bound it**: wash = `oklch(0.27 min(var(--pc), 0.05) var(--ph))`, glow = `oklch(0.55 min(var(--pc), 0.10) var(--ph) / 0.18)`. With L ≤ 0.30 and C ≤ 0.06, `--text-1` stays ≥ Lc 91 and `--text-2` ≥ Lc 62 for every hue (§3.2).
3. **Where**: only the title page hero (fading to `--bg` by ~480px), the "now watching" card, and the Tonight room's chosen pick. At most **one** poster-tinted region per viewport. Never tint grid items one by one.
4. **What it never touches**: text, buttons, borders, rating, focus, person colours.
5. **Fallback**: when `poster_c < 0.03` (black-and-white or near-grey posters), don't wash, and don't invent a hue.
6. **Raised surfaces** on a title page may take `color-mix(in oklab, var(--bg-raised) 94%, var(--poster) 6%)`, the same technique as Discord's themes.

### R7. The five rules that keep it from turning generic
1. **No hueless neutrals.** Every surface, line and text token carries a hue (velvet 345 for surfaces, ivory 50–75 for text). Use no `zinc`, `neutral`, `#121212` or `#000`. Tinted neutrals are what M3 and Radix do (§1.2). Skipping them is what makes Tailwind dark themes look identical.
2. **Colour belongs to people and films.** The chrome is lamplight: ivory plus ember. If a saturated pixel is neither a person, a poster, an action nor a status, remove it.
3. **One ember per region.** One primary action or live state per card or sheet. Never use ember for decoration, gradients or illustrations.
4. **Two people means two colours meeting.** Every shared viewing, comparison, recommendation or Tonight room shows both identities, distinguished by lightness and joined by a thread, lens or split.
5. **Mood from hue, legibility from lightness.** Hues and chroma can be expressive. Lightness is locked by the ladders above and checked in WCAG 2.2 AA (gate) and APCA (target Lc ≥ 75 for body, ≥ 60 for content, ≥ 45 for large).

### R8. Starter `@theme` (Tailwind v4)
```css
@theme {
  --color-bg-sunken: oklch(0.135 0.012 345);  --color-bg: oklch(0.165 0.014 345);
  --color-bg-raised: oklch(0.205 0.016 345);  --color-bg-overlay: oklch(0.245 0.018 345);
  --color-bg-hover: oklch(0.285 0.018 345);   --color-bg-selected: oklch(0.325 0.02 345);
  --color-line: oklch(0.30 0.018 345); --color-line-strong: oklch(0.42 0.02 345); --color-line-input: oklch(0.55 0.02 345);
  --color-text-1: oklch(0.95 0.012 75); --color-text-2: oklch(0.82 0.016 60);
  --color-text-3: oklch(0.72 0.018 50); --color-text-off: oklch(0.50 0.014 40);
  --color-ember: oklch(0.76 0.14 42); --color-ember-text: oklch(0.82 0.12 45);
  --color-on-ember: oklch(0.18 0.02 345); --color-ember-tint: oklch(0.30 0.06 40);
  --color-rating: oklch(0.85 0.12 88);
}
/* person colour: set --ph (hue) per avatar/row; tiers derive in CSS */
.person { --p-lit: oklch(0.86 0.10 var(--ph)); --p-deep: oklch(0.70 0.12 var(--ph));
          --p-fill: oklch(0.40 0.08 var(--ph)); --p-tint: oklch(0.27 0.045 var(--ph)); }
.us-thread { background: linear-gradient(90deg in oklch, var(--them), var(--you)); }
:focus-visible { outline: 2px solid var(--color-ember); outline-offset: 2px;
                 box-shadow: 0 0 0 2px var(--color-bg); } /* page-colour gap survives on posters */
@media (prefers-contrast: more) { :root { --color-text-2: var(--color-text-1); --color-line: var(--color-line-input); } }
```

## Anti-patterns to avoid
- **Pure `#000` page or pure `#fff` text.** It smears on OLED, causes halation, and reads as a terminal (§1.1, §1.3).
- **"Tailwind zinc + one brand colour".** This is the current look: hue 286 cool neutrals + `green-500`. Green also means "success", Spotify and Letterboxd.
- **A brown-black or green-black base.** Mud (Palmer & Schloss) or Matrix. **Blue-black** is not wrong, but it is the category default.
- **Neon accents** (C > 0.18 at mid L) on dark, and **aurora/mesh gradients everywhere**. They vibrate, they're generic, and they compete with posters.
- **Glass on everything.** Blur over posters breaks legibility, `prefers-reduced-transparency` only works in Chromium, and solid fallbacks are mandatory (§7).
- **Per-card poster tints in grids.** Confetti. One poster-coloured region per viewport.
- **Moody low-contrast metadata** in the style of Letterboxd's `#667788` (3.87:1). Put atmosphere in surfaces, not text.
- **Red vs green** for rating gaps, likes or "watched / not watched".
- **White text on ember** (2.25:1), and person colour used for small text.
- **Shadow-only elevation** on dark surfaces.
- **One person's colour on a shared object.** It erases the other person, which is the product's whole point.
- **Expecting colour to create connection.** Warmth priming didn't replicate (§5). Faces, names and "with whom" do the work.

## Sources
Primary and inspected sources are cited inline. Key ones:
- Material: https://m2.material.io/design/color/dark-theme · https://unpkg.com/@material/material-color-utilities@0.3.0/dynamiccolor/material_dynamic_colors.js · https://material.io/blog/science-of-color-design · https://developer.android.com/develop/ui/views/theming/dynamic-colors
- Apple: https://developer.apple.com/design/human-interface-guidelines/dark-mode · https://developer.apple.com/documentation/applemusicapi/artwork · https://support.apple.com/en-us/104972
- Contrast: https://www.w3.org/TR/WCAG22/ · https://github.com/Myndex/apca-introduction · https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell · https://www.nngroup.com/articles/dark-mode/
- Colour spaces: https://linear.app/now/how-we-redesigned-the-linear-ui · https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl · https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette · https://tailwindcss.com/docs/colors
- Browser support: https://github.com/web-platform-dx/web-features · https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors
- Research: Williams & Bargh 2008 https://doi.org/10.1126/science.1162548 · Lynott et al. 2014 https://doi.org/10.1027/1864-9335/a000187 · Chabris et al. 2019 https://doi.org/10.1027/1864-9335/a000361 · Lehmann & Calin-Jageman 2017 https://doi.org/10.1027/1864-9335/a000296 · Jonauskaite et al. 2020 https://doi.org/10.1177/0956797620948810 · Elliot & Maier 2014 https://doi.org/10.1146/annurev-psych-010213-115035 · Wilms & Oberfeld 2018 https://doi.org/10.1007/s00426-017-0880-8 · Palmer & Schloss 2010 https://doi.org/10.1073/pnas.0906172107 · Ou et al. 2004 https://doi.org/10.1002/col.20010 · Fotios 2017 https://doi.org/10.1080/15502724.2016.1159137 · Piepenbrock et al. 2013 https://doi.org/10.1080/00140139.2013.790485
- Accessibility: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html · https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/color-blindness · https://jfly.uni-koeln.de/color/
- Inspected production CSS (2026-10-03): linear.app, raycast.com, open.spotify.com, discord.com, vercel.com/geist, criterionchannel.com, mubi.com, culturedcode.com/things, teenage.engineering, arc.net, a24films.com, `@primer/primitives` 11.10 on jsDelivr.
