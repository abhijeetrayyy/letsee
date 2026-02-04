# Agent instruction: database & migrations reference

**Use this file as the single source of truth** for: which database this app uses, which SQL migration files exist, what each does, which are valid to run, and which should not be run.

---

## 1. Database

- **Platform:** Supabase (PostgreSQL).
- **Schema:** `public` (app tables, functions, RLS). Auth/storage/realtime are Supabase-managed and not defined in this repo.
- **Where to run SQL:** Supabase Dashboard → SQL Editor (paste file contents → Run). Or `pg_dump` / Supabase CLI for pulling schema (see `docs/PULL_SCHEMA_FROM_SUPABASE.md`).
- **Reference files:**
  - **`schema.sql`** — Full consolidated schema (tables, types, functions, RLS) as the app expects. Use for “what the app expects” and for diffing.
  - **`schema_from_supabase.sql`** — Optional dump from live Supabase (`pg_dump` or `supabase db dump`). Use to compare live DB vs repo; re-dump after applying migrations.

---

## 2. Migrations (what each file does)

All migration files live in **`migrations/`**. Run **in numeric order** (007 → 008 → … → 019). Skip any that are already applied to your database.

| File | What it does | Valid to run? | Idempotent? | Notes |
|------|----------------|---------------|-------------|-------|
| **007_watched_review_text.sql** | Adds column `watched_items.review_text` (reviews/diary). | ✅ Yes | ✅ Yes (`add column if not exists`) | Required for reviews/diary. |
| **008_public_reviews.sql** | Adds index `watched_items(item_id, item_type)`; adds RLS policy for public reviews (initially on `review_text`). | ✅ Yes | ⚠️ Uses `if not exists` for policy only | Policy is replaced by 009; index remains useful. Run before 009. |
| **009_diary_vs_public_review.sql** | Adds `watched_items.public_review_text`; **drops** old public-reviews policy; creates new RLS policy on `public_review_text`. | ✅ Yes | ❌ No (drop + create policy) | Run after 008. Defines diary vs public review. |
| **010_remove_activity.sql** | Drops table `activity` and enum `activity_type`. | ✅ Yes | ✅ Yes (drop if exists) | Only run after app code no longer references activity. |
| **011_profile_enhancements.sql** | `users`: adds avatar_url, banner_url, tagline, featured_list_id, pinned_review_id. Creates table `user_favorite_display` (Taste in 4) and RLS. | ✅ Yes | ⚠️ Columns via `if not exists`; policies are CREATE (fail if already exist) | **Required** for profile hero and Taste in 4. |
| **012_watched_episodes.sql** | Creates table `watched_episodes` and RLS (self only). | ✅ Yes | ✅ Yes (`create table if not exists`, etc.) | Required for episode-level TV tracking. |
| **013_watched_episodes_public_read.sql** | Adds RLS policy: anyone can SELECT `watched_episodes` (for profile TV progress). | ✅ Yes | ❌ No (plain CREATE POLICY) | Run after 012. |
| **014_backfill_watched_episodes_function.sql** | Creates function `backfill_watched_episodes_for_show(p_user_id, p_show_id, p_episodes)`. | ✅ Yes | ✅ Yes (`create or replace`) | **Required** for `/api/backfill-watched-episodes`. |
| **015_profile_diary_reviews_ratings_visibility.sql** | Adds to `users`: profile_show_diary, profile_show_ratings, profile_show_public_reviews. | ✅ Yes | ✅ Yes (`add column if not exists`) | Required for profile visibility toggles. |
| **016_watched_items_is_watched.sql** | Adds `watched_items.is_watched` (soft unwatch). | ✅ Yes | ✅ Yes (`add column if not exists`) | Required for “remove from Watched” keeping diary. |
| **017_runtime_minutes_for_hours.sql** | Adds `watched_items.runtime_minutes`, `watched_episodes.runtime_minutes`. | ✅ Yes | ✅ Yes (guarded by table existence + `if not exists`) | Optional for profile “Hours” stat. |
| **018_profile_visible_to_viewer_robust.sql** | Defines/replaces function `profile_visible_to_viewer(owner_user_id)`: null = public, case-insensitive visibility. | ✅ Yes | ✅ Yes (`create or replace`) | **Required** so RLS allows viewing public/followers profiles. Run before 019. |
| **019_add_profile_visibility_policies.sql** | Adds RLS SELECT policies (profile_visible_to_viewer) on watched_items, favorite_items, user_watchlist, user_ratings, recommendation. | ✅ Yes | ✅ Yes (drop if exists + create) | **Required** so other users see watched/favorites/watchlist on public profiles. Run after 018. |
| **020_remove_runtime_minutes.sql** | Drops columns `watched_items.runtime_minutes` and `watched_episodes.runtime_minutes`. Profile stats show Movies, TV, Episodes (count on fetch); Hours removed. | ✅ Yes | ✅ Yes (drop column if exists) | Run when removing Hours from profile; no triggers/functions reference these columns. |
| **021_tv_list_status.sql** | Adds `users.default_tv_status`. Creates table `user_tv_list` (user_id, show_id, status) and RLS (self + profile_visible_to_viewer for SELECT). | ✅ Yes | ⚠️ Policies CREATE (run once) | **Required** for TV list status (profile TV section, TV detail, default when adding TV). |

---

## 3. What to run and what not to run

### ✅ Do run (in order)

- Run migrations **007 through 020** in numeric order on any database that doesn’t have those changes yet.
- Prefer running **individual migration files** (not the whole `schema.sql`) when bringing an existing DB up to date, so you don’t duplicate or conflict with existing objects.

### ❌ Do not run

- **Do not run `schema.sql`** on a DB that already has tables created by migrations — it will duplicate or conflict. Use `schema.sql` only as reference or for a **brand-new** empty DB.
- **Do not run migrations out of order** (e.g. 019 before 018); 019 depends on the function defined in 018.
- **Do not run 010** until the app code no longer references the `activity` table.

### ⚠️ One-time vs idempotent

- **Idempotent (safe to run more than once):** 007, 010, 012, 014, 015, 016, 017, 018, 019, 020.
- **Not idempotent (run once per DB):** 008, 009, 011, 013 — they use plain `CREATE POLICY` or similar; re-running can error with “already exists.” If in doubt, check the file before re-running.

---

## 4. Quick reference for agents

- **Database:** Supabase, `public` schema.
- **Apply migrations:** Supabase SQL Editor; run files in `migrations/` in order 007 → 021.
- **What each file does:** See table in section 2.
- **Reference schema:** `schema.sql` (app expectation). Optional: `schema_from_supabase.sql` (dump from live DB).
- **Pull live schema:** See `docs/PULL_SCHEMA_FROM_SUPABASE.md`.
- **Full audit (tables, APIs, policies):** See `docs/SCHEMA_AND_CODE_AUDIT.md`.

---

## Profile stats: count on fetch (no stored movie/TV/episode counts)

Profile stats (Watched, Movies, TV, Episodes, Favorites, Watchlist, This year) are **counted on each profile load** from `watched_items`, `watched_episodes`, `favorite_items`, `user_watchlist`. We do **not** store movie count, TV count, or episode count in the DB. That avoids extra CRUD in watched/favorite/watchlist/episode buttons and keeps counts correct (e.g. with soft-unwatch). `user_cout_stats` remains for HomeDiscover (watched_count, favorites_count, watchlist_count) where the app already maintains it.
