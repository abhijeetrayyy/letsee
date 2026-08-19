# Agent instruction: database & migrations reference

**Use this file as the single source of truth** for: which database this app uses, which SQL migration files exist, what each does, which are valid to run, and which should not be run.

---

## 1. Database

- **Platform:** Supabase (PostgreSQL).
- **Schema:** `public` (app tables, functions, RLS). Auth/storage/realtime are Supabase-managed and not defined in this repo.
- **Where to run SQL:** Supabase Dashboard → SQL Editor (paste file contents → Run). Or `pg_dump` / Supabase CLI for pulling schema (see `docs/PULL_SCHEMA_FROM_SUPABASE.md`).
- **Reference file:**
  - **`migrations/000_baseline.sql`** — the complete schema as production actually has it, generated with `pg_dump` on 2026-08-19 after 007–083 were applied. **A fresh database needs this file and nothing else; an existing one must never run it** — apply the numbered migrations it is missing instead. Regenerate with `npm run db:dump` after every applied migration.
  - It replaced `schema.sql` (15 tables, predated migration 024, annotated "do not trust it") and `schema_from_supabase.sql` (14 tables). Both are deleted; git history keeps them. Neither could build a working database, and neither could `migrations/` alone — 007–028 assumed state `schema.sql` half-provided and half-contradicted, and `set_updated_at()` existed only there. There was no artefact in this repo that could create this database; now there is.

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
| **021_tv_list_status.sql** | Adds `users.default_tv_status`. Creates table `user_tv_list` (user_id, show_id, status) and RLS (self + profile_visible_to_viewer for SELECT). | ⚠️ Superseded by 055 | ⚠️ Policies CREATE (run once) | **Do not run on a live DB.** The column it adds was dropped by 055 and nothing reads it; `user_tv_list` does not exist live and no code references it. |
| **055_drop_default_tv_status.sql** | Drops `users.default_tv_status` and its check constraint (`users_default_tv_status_check`, from 022). | ✅ Yes | ✅ Yes (`drop ... if exists`) | Irreversible. Nothing read the column; all users held the default `watching`. Run after removing the setting from the UI and the settings route. |
| **056_user_providers.sql** | Creates `user_providers` (TMDB provider ids per user) + `users.watch_region`; RLS self-write, `profile_visible_to_viewer` read. | ✅ **Applied 2026-08-16** | ✅ Yes (`if not exists`, `drop policy if exists`) | **Required by `/app/tonight`.** Run before 057. |
| **057_watch_sessions.sql** | Creates `watch_sessions`, `watch_session_participants`, `watch_session_votes`, and `is_session_participant()` (SECURITY DEFINER, same anti-recursion pattern as 049). | ✅ **Applied 2026-08-16** | ✅ Yes (`if not exists`, `create or replace`, `drop policy if exists`) | **Required by `/app/tonight`.** Run after 056. |
| **058_letterboxd_import.sql** | Creates `import_jobs`, `import_rows`, and `owns_import_job()` (SECURITY DEFINER). Self-only RLS on both, so the importing user polls their own progress without an admin client. | ✅ **Applied 2026-08-16** | ✅ Yes (`if not exists`, `create or replace`, `drop policy if exists`) | **Required by `/app/import`.** |
| **059_year_in_review.sql** | Creates `year_reviews` (per-user, per-year sharing opt-in). Self-write RLS plus a public read on the flag, so one year can be published without changing `users.visibility`. | ✅ **Applied 2026-08-16** | ✅ Yes (`if not exists`, `drop policy if exists`) | **Required by `/app/profile/[id]/year/[year]`.** |
| **060_season_reviews.sql** | Creates `season_reviews` (a review anchored to a season). Mirrors the diary/public split from 009. | ✅ **Applied 2026-08-16** | ✅ Yes (`if not exists`, `drop policy if exists`) | **Required by the season page's review block.** |
| **061_new_episode_notification.sql** | Adds the `new_episode` notification type and `notified_episodes` (the daily job's memory, so it can't re-announce). | ✅ **Applied 2026-08-16** | ⚠️ Constraint is drop-and-recreate; table is `if not exists` | **Required by `/api/cron/new-episodes`.** Keeps `wave` and `achievement_unlocked` in the constraint so existing rows stay valid. |
| **062_reviews_get_an_audience.sql** | Adds `notify_reaction()` + trigger (liking notified nobody), and the `reviews_for_title` / `popular_reviews` RPCs that rank reviews by reactions. | ✅ **Applied 2026-08-16** | ✅ Yes (`create or replace`, `drop trigger if exists`) | Reviews fall back to recency and the home row hides itself until this runs. |
| **063_nullable_notification_actor.sql** | Drops `not null` on `notifications.actor_id`. | ✅ **Applied 2026-08-16** | ✅ Yes | Required by `/api/cron/new-episodes` — without it every new-episode notification insert failed with 23502. |
| **064_key_on_item_type.sql** | Widens the `(user_id, item_id)` key to include `item_type` on `user_media_status`, `watched_items`, `favorite_items` and `user_ratings`, so a film and a series sharing a TMDB id can coexist. | ✅ **Applied 2026-08-16** | ✅ Yes — discovers tables and constraints by shape, skips what's absent, re-runs as a no-op | **The app's 16 upserts name the composite target, so writes fail until this runs.** Apply it with the deploy, never before. |

| **065_unified_takes.sql** | Creates `takes` — one row per (user, thing, scope), one `body` plus an `is_public` flag instead of separate private/public columns, and backfills from `user_ratings`, `watched_items`, `season_reviews` and `episode_ratings`. | ✅ **Applied — verified 2026-08-17** | ✅ Yes (`if not exists`, every backfill insert is `on conflict on constraint takes_identity_key do nothing`) | Was recorded here as NOT APPLIED until 2026-08-17. That was wrong: the table had been applied all along, and D1 saved correctly the whole time. |
| **066_related_by_audience.sql** | Adds `related_by_audience(item_id, item_type, limit)` — co-engagement counts over `user_title_affinity` for one title, for D5's "people here who watched this also watched" signal. | ✅ **Applied 2026-08-17** | ✅ Yes (`create or replace` in a transaction, creates no table) | Executes cleanly and returns **zero rows on this database** — by design, not by failure. See below. |

| **072_email_is_not_public.sql** | Revokes table-level `SELECT` on `public.users` from `anon`/`authenticated` and re-grants it column by column, omitting `email`. Column list is discovered from `pg_attribute`, not typed out. | ✅ **Applied & verified 2026-08-19** | ✅ Yes — and re-running is how you grant columns added later | **Security fix (critical).** `users_select_public` is `USING (deleted_at IS NULL)` and RLS filters rows, not columns, so the anon key could dump every user's email. After this, `select("*")` on `users` fails for those roles — `/api/account/export` names its columns as of the same commit. |
| **073_private_diary_stays_private.sql** | Drops `watched_items_select_public_reviews` (009). Replaces `watched_episodes_select_public` (013, `using (true)`) with a `profile_visible_to_viewer` gate. | ⚠️ **Applied 2026-08-19, effect not independently observable** | ✅ Yes (`drop policy if exists` before each create) | **Security fix (critical).** 009's policy exposed the whole row — including `review_text`, the private diary — for any title with a public review. 013's exposed every user's episode-by-episode history regardless of profile visibility. Public reviews still reach the UI through 062's `reviews_for_title` (SECURITY DEFINER, public columns only). |
| **074_taste_compatibility_respects_privacy.sql** | Rewrites `taste_compatibility(uuid,uuid)` in plpgsql behind three guards — `p_a = auth.uid()`, `profile_visible_to_viewer(p_b)`, `NOT is_blocked(p_a,p_b)` — and revokes `EXECUTE` from `anon`. Maths unchanged. | ⚠️ **Applied 2026-08-19 — guards verified, REVOKE was a no-op, see 077** | ✅ Yes (`create or replace`) | **Security fix (critical).** 043 granted this `SECURITY DEFINER` function to `anon` with no visibility or block test, so any holder of the publishable key could read named titles out of a private profile's library. A failed guard returns zero rows, which `/api/compatibility` already renders as "no overlap". |
| **075_notifications_cannot_be_forged.sql** | Drops `notifications_insert_service` (027, `with check (true)`). | ✅ **Applied & verified 2026-08-19** | ✅ Yes (`drop policy if exists`) | **Security fix (critical).** The policy granted INSERT to `anon`/`authenticated`, so anyone could put a notification in anyone's bell attributed to anyone. Nothing legitimate used it: `service_role` bypasses RLS and every notify trigger is SECURITY DEFINER. The one app-side insert (`jobs/newEpisodeNotifier.ts:129`) runs on `createAdminClient()`. |

| **076_the_diary_is_owner_only.sql** | Revokes table-level `SELECT` on `public.watched_items` from `anon`/`authenticated` and re-grants it column by column, omitting `review_text`. Adds `my_diary_notes(text[], int)` — SECURITY DEFINER, hard-scoped to `auth.uid()`, takes no user parameter — as the owner's read path. | ✅ **Applied & verified 2026-08-19 — column revoke confirmed; its REVOKE ... FROM anon on the accessor was a no-op, see 077** | ✅ Yes — and re-running is how you grant columns added later | **Security fix (critical).** The other half of the diary leak: 073 closed 009's path, this closes 019's, which was the larger one. `watched_items_select_profile_visible` makes the whole row readable to anyone who may see the profile, and `review_text` is the private diary on that row — so `select=review_text` off PostgREST read it for every public profile. Six call sites moved to the accessor; four `select("*")` on this table now name their columns. Writes are unaffected (INSERT/UPDATE privileges are separate, and the mirror upserts never chain `.select()`). |

| **077_rpcs_are_not_public.sql** | Revokes `EXECUTE` from **PUBLIC** (not just `anon`) on 17 signed-in-only functions, then grants to `authenticated`/`service_role`. Signatures discovered from `pg_proc` by name. | ✅ **Applied & verified 2026-08-19** | ✅ Yes | **Security fix (critical).** PostgreSQL grants EXECUTE to PUBLIC by default and `anon` is a member of PUBLIC, so every `REVOKE ... FROM anon` in this repo — including 074's and 076's — has been a no-op. Confirmed live: `taste_matches` answered an unauthenticated caller with real usernames and shared titles, and `recount_user_stats` / `increment_favorites_count` / `decrement_favorites_count` all reached execution. Leaves RLS policy helpers and the signed-out browsing surface alone; see the file header for the list and the reasoning. |

| **078_episodes_count_stops_drifting.sql** | Adds the four statement-level `sync_user_stats()` triggers to `watched_episodes` (insert / update-new / update-old / delete), then reconciles every user once. | ⏳ **WRITTEN, NOT YET APPLIED** | ✅ Yes (`drop trigger if exists`) | **High.** 069 is named `stats_cannot_drift` and triggered `user_media_status` and `favorite_items` — the two counters that were already fine — and not `watched_episodes`, the only table `episodes_count` is derived from. Ticking an episode on an already-`watching` show writes nothing to `user_media_status`, so no trigger fired and the count never moved; un-ticking never moved it down. `sync_user_stats()` needs no change. |
| **079_the_bell_and_the_follow_button_get_realtime.sql** | Adds `notifications` and `user_follow_requests` to the `supabase_realtime` publication (guarded on `pg_publication_tables`) and sets `REPLICA IDENTITY FULL` on both. | ⏳ **WRITTEN, NOT YET APPLIED** | ✅ Yes | **High.** 070 wrote the post-mortem for a subscription that reports SUBSCRIBED and delivers nothing, fixed `messages`, and is the only `ALTER PUBLICATION` in 77 migrations — while `NotificationBell` and `FollowButton` subscribe to two tables that were never published. The unread badge has never incremented live. |

| **080_a_follow_request_can_be_accepted.sql** | Adds `accept_follow_request(bigint)` — SECURITY DEFINER, proves the caller is the request's recipient, re-applies the block check, writes the connection, notifies the sender with `follow_accepted`, deletes the request row. Revoked from PUBLIC/anon. | ✅ **Applied & verified 2026-08-19** | ✅ Yes (`create or replace`, `on conflict do nothing`) | **High.** Accepting a follow request has never worked on any account: the client inserted into `user_connections` under the receiver's session, and 042's policy is `WITH CHECK (auth.uid() = follower_id)` where follower_id is the *sender*. The UI's `if (!error)` hid it, and `sendFollowRequest` blocks while any row exists, so the sender could never retry either — making followers-only visibility unreachable for anyone not already following. |

| **081_a_block_actually_blocks.sql** | Rewrites `profile_visible_to_viewer` to return false when `is_blocked(viewer, owner)`, restores its `SET search_path = public`, and adds `block_user(uuid)` — SECURITY DEFINER, pinned to `auth.uid()` — which inserts the block and severs connections and follow requests in **both** directions. | ✅ **Applied & verified 2026-08-19** | ✅ Yes (`create or replace`, `on conflict do nothing`) | **High.** The predicate that gates SELECT on watched_items, favorite_items, user_ratings, user_media_status, takes, user_activity and watched_episodes never consulted `user_blocks` — so on a **public** profile a block bought no RLS protection at all. Separately, `/api/user/block` ran its cleanup on the blocker's client, and `user_connections_delete_self USING (auth.uid() = follower_id)` made the row where the blocked user follows the blocker undeletable: PostgREST returned 200 having deleted nothing. |

| **082_a_deleted_user_can_still_reach_their_own_row.sql** | Widens `users_select_public` to `deleted_at IS NULL OR auth.uid() = id`. | ✅ **Applied & verified 2026-08-19** | ✅ Yes (drop + create) | **Prerequisite for the purge cron — apply before scheduling it.** 034's policy hid the row from the only people who need it: users who scheduled their own deletion. `/api/account/reactivate` reads that row first, got null, and answered "Account is not scheduled for deletion", so the 30-day grace period has never been usable; and the middleware's `deleted_at` redirect never fired, dropping those users into an infinite onboarding loop instead. Without this, the purge turns an inescapable window into an inescapable countdown. |

| **083_clubs_cannot_be_seized.sql** | Locks `club_members_insert_self` to `role='member'` with `status` derived from the club's `join_policy`; adds `WITH CHECK` to `club_members_update_admin`, `clubs_update_admin` and `club_picks_update_admin`; adds `is_club_owner()`, an AFTER INSERT trigger that makes the creator the owner, and a BEFORE UPDATE trigger making `clubs.created_by` immutable. | ✅ **Applied & verified 2026-08-19** | ✅ Yes (`create or replace`, `drop policy/trigger if exists`) | **High — privilege escalation, four paths.** (1) `WITH CHECK (auth.uid() = user_id)` constrained who the row was about and not what it claimed, so one POST with `"role":"owner"` made anyone an admin of any club. (2)–(3) `USING`-only UPDATE policies let a moderator promote themselves to owner and move a membership row into a club they don't administer. (4) `clubs_update_admin` had no `WITH CHECK`, so a moderator could set `created_by` to themselves and then delete the club via `clubs_delete_owner`. Also makes `join_policy='request'` mean something for the first time. **Creation keeps working because the owner row moves from the caller's client into the trigger.** |

> ✅ **072, 075 and 076 verified against the live database on 2026-08-19**, by issuing the exact requests that used to leak with the publishable anon key. `users?select=email` → 42501. `watched_items?select=review_text` → 42501. A forged `notifications` insert → 42501. Legitimate columns still answer 200.
>
> ⚠️ **073's effect is not independently observable on this database.** All 8 profiles are `public`, so a policy gated on `profile_visible_to_viewer` and one reading `USING (true)` return identical rows. It is recorded as applied on the operator's word. To actually confirm it, set one profile to `private` and check that `watched_episodes?user_id=eq.<that user>` returns `[]` to the anon key.
>
> ❌ **074 and 076 each shipped a `REVOKE ... FROM anon` that did nothing**, and the probe caught it: both functions still executed for an unauthenticated caller. The in-function guards held — `taste_compatibility` and `my_diary_notes` both returned `[]` — so no data escaped, but the privilege was never withdrawn. `077` is the actual fix and is **not yet applied**.

> ✅ **077 verified 2026-08-19.** With the anon key: `taste_matches`, `conversation_list`, `recount_user_stats`, `decrement_favorites_count`, `taste_compatibility` and `my_diary_notes` all now answer 42501, while `title_rating_histogram`, `title_audience`, `get_user_stats` and a public `watched_items` read (which exercises `profile_visible_to_viewer` inside the policy) still return 200. Signed-out browsing intact, policy helpers intact.
>
> ✅ **078 verified 2026-08-19** — `episodes_count` now matches the row count exactly for every user (7,959 for the heaviest). **079 applied**; publication membership is not readable over PostgREST, so it needs a live check: sign in on two accounts and confirm the bell increments without a reload.
>
> ✅ **083 verified 2026-08-19** — `is_club_owner` resolves, so the migration ran. The escalation itself needs a signed-in session to attempt and was not reproduced here; the database currently holds zero clubs and zero non-`member` rows, so there is no legacy self-granted owner to clean up.
>
> ✅ **082 verified 2026-08-19** — public reads still work for anonymous callers, so the widened policy did not regress the common path. The self-read half needs a deleted account's session to observe.
>
> ✅ **081 verified 2026-08-19** — `rpc/block_user` answers 42501 to the anon key, and the regression that mattered is clear: `watched_items`, `favorite_items`, `user_ratings`, `user_media_status`, `watched_episodes` and `user_activity` all still return rows to a signed-out reader through the rewritten predicate.
>
> ✅ **080 verified 2026-08-19** — `rpc/accept_follow_request` answers `42501` to the anon key, confirming both that it exists and that the PUBLIC grant was withdrawn. Apply in numeric order. None has been executed against any database — there is no local Postgres in this checkout — so treat the first run as the test. After applying, re-dump the baseline (`npm run db:dump`).

> ✅ **065 and 066 verified 2026-08-17**, through `supabase db query --linked` (Management API — no database password involved). `takes`: 12 columns, 7 constraints including `takes_identity_key`/`takes_scope_shape`/`takes_not_empty`, RLS enabled with 2 policies, 4 indexes, 12 rows. `related_by_audience`: correct signature, `SECURITY DEFINER`, `STABLE`, EXECUTE granted to `authenticated` and `anon`.
>
> **066 returns nothing here, and that is the k-anonymity floor doing its job.** This database has **3 users** and 505 affinity rows; its busiest title (`157336`, *Interstellar*) has **2 watchers**, against a required floor of 5. So D5's community term stays inert — but for a *data* reason now, not a missing-function one. The related section renormalises it away and ranks on keywords, director and collection, which is the designed degradation.
>
> **Correction:** this table recorded 065 as NOT APPLIED between 2026-08-16 and 2026-08-17. It had in fact been applied. Anything written in that window claiming D1 could not save was wrong.

> ✅ **056–064 were applied on 2026-08-16 and verified**: all nine tables present, `users.watch_region` added, four RPCs exposed and executing, 061's constraint confirmed to reject an unknown type while accepting `new_episode`, and 064 confirmed by writing a film and a series under the same id and getting **two** rows where one would previously have overwritten the other.
>
> **064 took three attempts, and the failures are the useful part.** v1 compared `array_agg(a.attname)` — which is `name[]` — against a `text[]` literal and aborted the transaction. v2 would then have failed on `user_watchlist`, which 029 migrated away from and which no longer exists here. Worse, both versions would have replaced `user_media_status`'s **primary key** with a plain `UNIQUE`: enough for `ON CONFLICT`, so every upsert would have worked and nothing would have complained, while the table quietly lost its primary key and with it its replica identity. All three came from asserting the schema instead of asking it. The shipped version asks, and PostgREST now reports the primary key as `(user_id, item_id, item_type)` — preserved and widened, not downgraded.
>
> `migrations/APPLY_056_TO_062.sql` is the one-paste bundle used for that batch. Re-dump the baseline (`npm run db:dump`) after any further migration.

### What verification caught

`notifications.actor_id` is `not null` (027), but a `new_episode` notification has no actor — nobody acted, a show aired. `newEpisodeNotifier.ts` inserts `actor_id => null`, so **every one of those inserts would have been rejected**, silently, inside a fire-and-forget cron job whose only trace is a console line nobody reads.

Found by probing 061's constraint with a deliberately failing insert and getting `23502` (not-null) where `23503` (foreign key) was expected. 063 is the fix, and after applying it the notifier's exact payload was inserted, confirmed to come back from the actor left join as `actor: null`, and deleted.

### A note on `background_jobs` (024)

That queue is **not functional**, and neither 058 nor 061 uses it:

- Nothing anywhere calls `registerJobHandler`, so `JOB_HANDLERS` is empty and `dispatchJob` always fails with *"No handler registered for job type"*.
- `vercel.json` now declares one cron (`/api/cron/new-episodes`), but still none for `/api/cron/run-jobs`, so the queue runner is still never invoked.

Anything scheduled onto it today silently never runs. `/api/cron/new-episodes` and `/api/cron/check-availability` sidestep it by being plain functions a cron route calls directly, which is the pattern to follow. Either wire the queue's two ends up or drop the table — but don't build on it as-is.

**`/api/cron/check-availability` still has no schedule.** It is written, working, and never fires. Add it to `vercel.json` or delete it.

⚠️ **`CRON_SECRET` must be set in production.** All three cron routes skip their auth guard when the variable is unset — convenient locally, an open endpoint in production.

---

## 3. What to run and what not to run

### ✅ Do run (in order)

- Run migrations **007 through 020** in numeric order on any database that doesn’t have those changes yet.
- Prefer running **individual migration files** (never `000_baseline.sql`) when bringing an existing DB up to date, so you don’t duplicate or conflict with existing objects.

### ❌ Do not run

- **Do not run `000_baseline.sql`** on a DB that already has tables — it will conflict. It is for a **brand-new** empty database, or for reading.
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
- **Reference schema:** `migrations/000_baseline.sql` (generated from production; the app expectation and the database are the same thing now).
- **Pull live schema:** See `docs/PULL_SCHEMA_FROM_SUPABASE.md`.
- **Full audit (tables, APIs, policies):** See `docs/SCHEMA_AND_CODE_AUDIT.md`.

---

## Profile stats: count on fetch (no stored movie/TV/episode counts)

Profile stats (Watched, Movies, TV, Episodes, Favorites, Watchlist, This year) are **counted on each profile load** from `watched_items`, `watched_episodes`, `favorite_items`, `user_watchlist`. We do **not** store movie count, TV count, or episode count in the DB. That avoids extra CRUD in watched/favorite/watchlist/episode buttons and keeps counts correct (e.g. with soft-unwatch). `user_cout_stats` remains for HomeDiscover (watched_count, favorites_count, watchlist_count) where the app already maintains it.
