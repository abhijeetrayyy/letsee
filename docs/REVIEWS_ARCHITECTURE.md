# Review System Architecture

This document describes the review system design for Letsee, inspired by [Letterboxd](https://letterboxd.com)-style diary + public reviews. The goal is a **sustainable, maintainable** setup that can be extended later (likes, comments, spoiler flags, etc.).

---

## Design principles

1. **Diary vs public review** – **Your diary** is **private** (only you see it). **Reviews** are **public** (everyone sees them). They are separate: diary = personal notes; public review = optional text you publish to the Reviews section.
2. **One diary + one public review per user per title** – You can have private diary notes and optionally one public review per watched title. No duplicate public reviews per user per movie/TV.
3. **Tied to “Watched”** – You can only write diary or public review after marking the title as Watched. Unwatching removes the row (diary, public review, and rating) server-side.
4. **Backend gatekeeping** – All write APIs check that the item is in the user’s `watched_items`.

---

## Data model

- **Diary (private):** **`watched_items.review_text`** – Only returned to the owner; never in public APIs or on others’ profiles.
- **Public review:** **`watched_items.public_review_text`** – When set, the row is included in `GET /api/reviews` and shown on the user’s profile to others.
- **One row per user per item** in `watched_items`: `(user_id, item_id)` unique, with optional `review_text` (diary), `public_review_text` (public review), and `watched_at`.

---

## APIs

| Endpoint | Auth | Purpose |
|----------|------|--------|
| `GET /api/watched-review?itemId=&itemType=` | Required | Current user’s diary and public review (returns `diaryText`, `publicReviewText`, `watchedAt`). |
| `PATCH /api/watched-review` | Required | Set diary and/or public review (body: `itemId`, `itemType`, `diaryText?`, `publicReviewText?`). |
| `GET /api/reviews?itemId=&itemType=&page=&limit=` | **None** | Public list of **public reviews** only (paginated). Only rows with `public_review_text` set. |

Public listing uses RLS: **`watched_items_select_public_reviews`** allows `SELECT` on `watched_items` where **`public_review_text IS NOT NULL`**. Diary (`review_text`) is never exposed by this policy.

---

## UI flow

1. **Movie/TV detail page**
   - **Your rating** – Shown only when Watched (placeholder: “Mark as watched to rate”).
   - **Your diary** – Private notes; only when Watched; “Only you can see this.” Save diary.
   - **Your public review** – Optional; only when Watched; “Visible to everyone in Reviews below.” Save public review.
   - **Reviews** – **Public** list: only public reviews (author, date, text). “Add yours above in Your public review.”

2. **Dynamic behavior**
   - When the user clicks **Watched**, rating and review sections become active without a full reload (context + `isWatched` prop).
   - When the user **unwatches**, a confirm says “Your review and rating will also be deleted”; on confirm, the backend removes the `watched_items` row and the `user_ratings` row.

---

## Indexes and performance

- **`watched_items_item_id_item_type_idx`** on `(item_id, item_type)` – Used by `GET /api/reviews` to list reviews by title and paginate.
- Exact count for pagination can be heavy at scale; we can later switch to `count: 'planned'` or cursor-based pagination if needed.

---

## Future extensions (sustainable path)

The current design leaves room for:

1. **Likes on reviews** – New table `review_likes (user_id, watched_item_id)` and an API to like/unlike; show count and “You liked” in the public list.
2. **Comments on reviews** – New table `review_comments (id, watched_item_id, user_id, body, created_at)` and CRUD API; list under each review.
3. **Spoiler flag** – Add `contains_spoilers boolean` to `watched_items` (or a small JSONB “review_meta”); hide text behind “Show spoilers” in the public list.
4. **Privacy** – Add `review_visibility` (e.g. public / followers / private) to `watched_items`; in RLS and in `GET /api/reviews`, filter by visibility.
5. **Standalone reviews** – Optional separate `reviews` table for “review without diary”; merge with diary reviews in the public API.
6. **Moderation** – Soft-delete or `review_hidden`; filter in `GET /api/reviews` and admin UI.

Adding these later does not require changing the core rule: **one review per user per title, tied to Watched, with public read and backend gatekeeping.**

---

## Summary

- **Diary (private):** Only you see it. Stored in `watched_items.review_text`. Shown on your profile as a snippet; never in public Reviews.
- **Public review:** Optional. Stored in `watched_items.public_review_text`. Visible in `GET /api/reviews` and on your profile to others.
- **Architecture:** One row per user per title; diary and public review are separate columns. RLS exposes only rows with `public_review_text` set for public read.
- **Maintainable:** Clear separation of private vs public, two save actions (Save diary / Save public review), and a documented path for likes, comments, spoilers, and privacy.
