# TV "Watched" vs episode-level tracking — logic

## Two ways to record progress

1. **Show-level "Watched"** — User clicks "Watched" on the TV show page. Stored in `watched_items` (item_type = 'tv'). Counts in profile "Watched" and stats.
2. **Episode-level** — User marks episodes one by one on season/episode pages. Stored in `watched_episodes`.

## Rule: keep them in sync

**Parameter for "this series is Watched" (show-level):**

- A TV show is in **Watched** (`watched_items`) when the user has **at least one** episode of that show marked in `watched_episodes`.
- So: "Watched" for TV = "user has watched at least one episode." The show appears in the Watched list and count as soon as they mark any episode.
- Once in Watched, the show **stays** in Watched. Unmarking episodes (even unmarking all) does **not** remove it. The only way to remove is to click "Watched" on the show page to untoggle (which clears all episodes and removes from Watched).

## Behaviors

### 1. User clicks "Watched" on the series (adds to Watched)

- Add the show to `watched_items` (current behavior).
- **Also:** Fetch the show’s seasons/episodes from TMDB and insert **every** (season_number, episode_number) into `watched_episodes` for this user.
- Result: Show is Watched and Series progress shows "All caught up", no "Next episode".

### 2. User removes the series from "Watched" (clicks Watched again to untoggle)

- Remove the show from `watched_items` (current behavior).
- **Also:** Delete **all** rows in `watched_episodes` for this user and this show_id.
- Result: No episode progress; Continue watching / Series progress no longer include this show (or show 0 episodes).

### 3. User only marks episodes one by one (never clicks "Watched" on the show)

- Each "Mark episode watched" only inserts into `watched_episodes`.
- **When** the user marks the **last missing episode** (so 100% of episodes are now in `watched_episodes`):
  - **Then** add the show to `watched_items` (and increment watched count).
- Result: Once they’ve marked every episode, the series automatically becomes "Watched" and appears in Watched count/list.

### 4. User unmarks episodes

- "Watched" is only valid when 100% of episodes are marked.
- **When** the user unmarks an episode so the show is **no longer** 100% complete:
  - Remove the show from `watched_items` and decrement watched count.
- Result: Show stays in Series progress / Continue watching with a "Next" episode, but is no longer in the Watched list/count until they’re 100% again.

## Summary

| Action | Effect on watched_items | Effect on watched_episodes |
|--------|-------------------------|---------------------------|
| Add show to Watched | Insert row | Insert **all** episodes (from TMDB) |
| Remove show from Watched | Delete row | Delete **all** for this show |
| Mark episode watched (first or any) | **Insert** row if not present | Insert one episode |
| Unmark episode | **No change** (show stays in Watched) | Delete one episode |

So: **the series is "Watched" as soon as the user has marked at least one episode, and it stays in Watched** (even if they later unmark all episodes). The only way to remove from Watched is to untoggle "Watched" on the show page. The TV tracking list (Series progress) shows every show they have episode progress on, with actual "X episodes watched" and "Y seasons completed".

---

## Backfilling existing "Watched" TV shows

Users who marked TV shows as Watched **before** episode tracking was implemented have those shows in `watched_items` but no rows in `watched_episodes`. To sync them:

1. **SQL function** `backfill_watched_episodes_for_show(p_user_id uuid, p_show_id text, p_episodes jsonb)`  
   Inserts a list of `{season_number, episode_number}` into `watched_episodes` for that user/show. Uses `ON CONFLICT DO NOTHING`. Returns the number of rows inserted. The episode list must come from TMDB (SQL cannot call external APIs).

2. **API** `POST /api/backfill-watched-episodes`  
   For the **current user**, finds all TV shows in `watched_items`, fetches each show’s seasons/episodes from TMDB, and calls the SQL function for each. Safe to run multiple times. Response: `{ shows_backfilled, episodes_inserted }`.

**How to run the backfill**

- **Per user:** Have each user call the API once (e.g. from a "Sync episode progress" button in settings, or trigger it when they open Series progress).
- **One-time bulk:** As an admin, call the API once per user (e.g. script that logs in as each user and POSTs, or a server script using service role to select all users with TV in `watched_items` and for each call the same TMDB + RPC logic).
