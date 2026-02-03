# Profile Page Tasks — Priority & Compatibility

Tasks are ordered so that **dependencies come first** and **compatible work is grouped**. Do them one by one.

---

## Task 1 — Schema: profile enhancements (P0)

**Purpose:** Unblocks avatar, banner, tagline, Taste in 4, featured list, pinned review.

**Deliverable:** Migration `011_profile_enhancements.sql`

- **users:** Add `avatar_url text`, `banner_url text`, `tagline text`, `featured_list_id bigint references user_lists(id) on delete set null`, `pinned_review_id bigint` (app-enforced: must be user’s watched_items.id).
- **user_favorite_display:** New table for “Taste in 4”: `user_id`, `position` (1–4), `item_id`, `item_type`, `image_url`, `item_name`; unique (user_id, position).

**Apply in Supabase:** Run migration 011.

---

## Task 2 — Profile hero: avatar + optional banner (P0)

**Depends on:** Task 1 (schema).

**Deliverables:**

- Profile page: show `avatar_url` (or fallback `/avatar.svg`) and optional `banner_url` (full-width behind header).
- Profile setup/edit: allow setting avatar URL and banner URL (or upload to Supabase Storage and set URL).

**Compatibility:** Can be done right after Task 1; no dependency on Taste in 4.

---

## Task 3 — Taste in 4: pick 4 + filmstrip in hero (P0)

**Depends on:** Task 1 (schema), Task 2 (hero layout so filmstrip has a place).

**Deliverables:**

- API or Supabase: GET/PUT `user_favorite_display` for current user (list 4, set 4 from watched/favorites).
- Profile setup or profile edit: UI to pick up to 4 titles from watched + favorites (search/select).
- Profile page hero: “Taste in 4” filmstrip (overlapping posters, not grid).

**Compatibility:** Needs hero area from Task 2.

---

## Task 4 — Tagline (P3, quick)

**Depends on:** Task 1 (schema).

**Deliverables:**

- Profile setup/edit: add `tagline` field (short text).
- Profile page: show tagline under username (one line).

**Compatibility:** Independent; can do right after Task 1 or with Task 2.

---

## Task 5 — Profile tabs (P1)

**Depends on:** None (reorganizes existing content).

**Deliverables:**

- Tabs: **Activity** (recent strip) | **Watched** | **Watchlist** | **Favorites** | **Lists** (and optionally **Reviews** or fold into Watched).
- Keep Recommendations strip above tabs.
- Each tab renders existing components (ProfileWatched, ProfileWatchlater, etc.).

**Compatibility:** Can be done in parallel with 2–4 once you choose; better after Recent activity exists (Task 6) so “Activity” tab has content.

---

## Task 6 — Recent activity strip (P1)

**Depends on:** None (uses existing watched_items + user_ratings).

**Deliverables:**

- Fetch last 5–10 items: watched + ratings (e.g. “Watched X”, “Rated Y ★8”).
- Component: horizontal strip (poster + title + date/snippet) above or beside main content.
- Use in profile and optionally in “Activity” tab (Task 5).

**Compatibility:** Fits well before or with Task 5 (tabs).

---

## Task 7 — Richer stats (P1)

**Depends on:** None (computed from existing data).

**Deliverables:**

- **Hours watched:** Approximate (e.g. movies × 2h, TV × 0.5h per episode) or use TMDB runtime if stored/fetched.
- **This year:** Watched count for current year (e.g. “47 in 2025”).
- **Movies vs TV:** Ratio or small bar (from watched_items.item_type).
- Profile: add these to stat cards or a second row of stats.

**Compatibility:** Independent; can do anytime.

---

## Task 8 — Featured list + pinned review (P2)

**Depends on:** Task 1 (schema). Display can follow Task 5 (Lists tab).

**Deliverables:**

- Profile edit: choose **featured list** (dropdown of user’s lists) and **pinned review** (dropdown of user’s watched items with review text).
- Profile page: highlight featured list at top of Lists; show pinned review in a dedicated block (e.g. above tabs or in Watched/Diary).

**Compatibility:** Needs schema from Task 1; UI after lists/diary are in place (Task 5).

---

## Suggested order of execution (completed in this order)

| Order | Task | Status |
|-------|------|--------|
| 1 | Schema (Task 1) | ✅ Migration `011_profile_enhancements.sql` |
| 2 | Avatar + banner (Task 2) | ✅ Profile + setup display/edit |
| 3 | Taste in 4 (Task 3) | ✅ API, TasteInFourStrip, EditTasteInFour |
| 4 | Tagline (Task 4) | ✅ Setup + profile display |
| 5 | Recent activity strip (Task 6) | ✅ RecentActivityStrip |
| 6 | Profile tabs (Task 5) | ✅ ProfileTabs (Activity \| Lists \| Watched & more) |
| 7 | Richer stats (Task 7) | ✅ This year, hours (est.), movies vs TV bar |
| 8 | Featured list + pinned review (Task 8) | ✅ Display + setup dropdowns, API watched-with-reviews |

---

## Later (not in this batch)

- **Diary view** (chronological, filters): P2; can reuse ProfileWatched data with a “diary” view mode.
- **Year in Review / Wrapped**: P2; new page or section; computed from watched + ratings.
- **Genre chart upgrade**: P3; visual polish.
- **“People you follow follow them”**: P3; discovery.
