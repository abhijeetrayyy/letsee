# Profile: Diary, Reviews, Ratings & Visibility — Scope & Plan

This document outlines the full scope for showing **diary**, **reviews**, and **ratings** on user profiles and giving users the ability to **manage** them and control **visibility**.

---

## Current state

### Data model

| Data | Where | Who sees it |
|------|--------|-------------|
| **Diary** | `watched_items.review_text` | Only the owner (private). Never exposed in public APIs. |
| **Public review** | `watched_items.public_review_text` | Everyone (when set). Used in `GET /api/reviews` and on profile. |
| **Ratings** | `user_ratings` (score 1–10 per item) | Stored per user; **not currently shown on profile**. |
| **Profile visibility** | `users.visibility` | One setting: **public** / **followers** / **private**. Controls who can see the whole profile. |

### What’s on the profile today

- **Watched section** (`ProfileWatched`): Cards show watched titles. **Owner** sees diary snippet (`review_text`); **visitors** see public review snippet (`public_review_text`) if set. **Ratings are not shown** on these cards.
- **Recent activity** (`RecentActivityStrip`): Shows recent watched items with diary snippet (owner only). Copy says “Watched titles and ratings” but ratings are not displayed.
- **Visibility control** (`visibility.tsx`): One dropdown — “Profile visibility” (Public / Friends only / Only me). No per-category toggles (e.g. “Show diary on profile”, “Show ratings”).

### Gaps

1. **Ratings** are not shown anywhere on the profile (neither for owner nor visitors).
2. There is no dedicated **“Your diary”** section (diary only appears as a snippet on Watched cards and in Recent activity).
3. There is no dedicated **“Your reviews”** section (public reviews only appear as snippets on Watched cards and in `/api/reviews` on title pages).
4. **No per-category visibility**: Users cannot choose to hide diary, ratings, or reviews on profile while keeping the rest visible.
5. **No management UI** on profile: Edit/delete diary, edit/delete public review, change rating, or toggle visibility per item (if we add it) — today this is done only on the movie/TV detail page.

---

## Goals (what you asked for)

1. **Show on profile:** Diary, reviews, and ratings data **present** on the user’s profile (for owner and/or visitors as appropriate).
2. **Manage:** Ability to **manage** ratings, reviews, diary (and optionally their visibility).
3. **Visibility:** Ability to control **visibility** of diary, reviews, and ratings on the profile.

---

## Recommended approach

### Phase 1 — Show data & basic visibility (recommended first)

**1. Show ratings on profile**

- **Watched section:** For each watched item, if the user has a rating, show it on the card (e.g. “8/10”).
  - **API:** Either extend `UserWatchedPagination` to join/return rating per item, or have the client call `GET /api/user-rating` for visible items (heavier). Prefer **one server-side join or a dedicated “watched + ratings” endpoint** that returns `watched_items` with an optional `score` per item.
- **Owner vs visitor:** Respect visibility (see below). If “Show ratings on profile” is off, don’t show scores.

**2. Dedicated sections (optional but clear)**

- **“Your diary”** (owner only): A subsection or tab that lists watched items with **diary** text (and optionally link to the title). Makes “diary” first-class on the profile.
- **“Your reviews”** (or “Public reviews”): A subsection that lists items where **public_review_text** is set. Visitors see this; owner sees it with an “Edit” link to the title page.
- **“Your ratings”**: A subsection or integrated into Watched that shows “Rated X/10” per title. Helps if we add “hide ratings” later.

You can keep everything inside the existing **Watched** block and add **ratings + clearer diary/review labels** first, then split into “Diary” / “Reviews” / “Ratings” subsections if you want.

**3. Profile-level visibility toggles (diary, reviews, ratings)**

- **DB:** Add to `users` (or a small `user_profile_settings` table) three booleans, e.g.:
  - `profile_show_diary` (default true) — show diary snippets/section to visitors who can see profile.
  - `profile_show_ratings` (default true) — show ratings on profile.
  - `profile_show_public_reviews` (default true) — show public review snippets/section.
- **API:** When returning profile data or when returning “watched list for profile”, include these flags (for owner) and respect them (for visitors): if `profile_show_diary` is false, do not return/send diary text to visitors; same for ratings and public reviews.
- **UI:** In **Settings** or under the existing **Profile visibility** area, add three checkboxes: “Show diary on profile”, “Show ratings on profile”, “Show public reviews on profile”. Owner can turn them off without changing the global “Profile visibility”.

**4. Management**

- **Edit/delete diary and public review:** Already possible on the **movie/TV detail page** (WatchedReview). On profile, add a clear “Edit” (or “Manage”) link on each card that goes to the title page (e.g. `/app/movie/123-...` or `/app/tv/456-...`) where they can edit diary, public review, and rating.
- **Manage visibility:** The new toggles above *are* the management of “visibility” for diary, reviews, and ratings at the profile level. No need for per-item visibility in v1 unless you want it later.

### Phase 2 — Richer management (optional)

- **Profile “Manage diary/reviews/ratings” page:** One place to see all items with diary, all with public review, all with ratings; bulk actions or quick edit (e.g. “Hide from profile” per item) if you add per-item visibility later.
- **Per-item visibility:** e.g. “Show this diary entry on profile” per watched item. Requires DB column(s) on `watched_items` / `user_ratings` and API + UI changes.

---

## Implementation checklist (Phase 1)

### Database

- [ ] Add to `users` (or new table): `profile_show_diary boolean default true`, `profile_show_ratings boolean default true`, `profile_show_public_reviews boolean default true`.
- [ ] Migration file, e.g. `014_profile_diary_reviews_ratings_visibility.sql`.

### API

- [ ] **Watched list for profile:** Either extend `UserWatchedPagination` or add `GET /api/profile/watched-with-ratings?userId=&page=&genre=` that returns watched items **and** rating (score) per item. Respect `profile_show_diary` / `profile_show_ratings` / `profile_show_public_reviews` for visitors (do not return diary if off; do not return score if ratings hidden; same for public review).
- [ ] **Profile settings:** `GET/PATCH` for current user’s profile flags (e.g. `GET /api/profile/settings`, `PATCH /api/profile/settings` with `{ profile_show_diary, profile_show_ratings, profile_show_public_reviews }`). Or reuse existing user update if you have one.

### UI — Profile page

- [ ] **Watched cards:** Show rating (e.g. “8/10”) when present and when `profile_show_ratings` is true (for owner always; for visitors only if they can see profile and flag is true).
- [ ] **Labels:** Clearly label “Diary” vs “Public review” on cards (e.g. “Your diary” for owner, “Review” for visitor when `public_review_text` is set).
- [ ] **“Edit” / “Manage”:** Link from each card to the movie/TV detail page so the user can manage diary, review, and rating there.

### UI — Settings / visibility

- [ ] **Visibility section:** Next to “Profile visibility” (Public / Followers / Private), add three toggles: “Show diary on profile”, “Show ratings on profile”, “Show public reviews on profile”. Save via PATCH profile/settings.

### Optional (Phase 1 or later)

- [ ] Dedicated “Your diary” block on profile (list of titles with diary text).
- [ ] Dedicated “Your reviews” block (list of titles with public review).
- [ ] “Your ratings” block or integrate fully into Watched with “Rated X/10” on every card that has a rating.

---

## Summary

| What | Current | After Phase 1 |
|------|--------|----------------|
| **Diary on profile** | Snippet on Watched (owner only) | Same + optional “Your diary” section; **visibility toggle** so owner can hide diary from profile. |
| **Reviews on profile** | Snippet on Watched (visitors see public review) | Same + optional “Your reviews” section; **visibility toggle** to hide public reviews on profile. |
| **Ratings on profile** | Not shown | **Shown** on Watched cards (and/or dedicated block); **visibility toggle** to hide ratings on profile. |
| **Manage** | Only on movie/TV page | Same + **“Edit” link** on profile cards to that page; optional “Manage” page later. |
| **Visibility** | One “Profile visibility” | **Plus** three toggles: show diary / show ratings / show public reviews on profile. |

Implementing **Phase 1** gives you: diary, reviews, and ratings **present** on the profile, **visibility** control for each category, and **management** via the existing detail-page flow plus clear links from the profile.
