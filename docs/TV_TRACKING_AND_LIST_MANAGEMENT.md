# TV Show Tracking & List Management

Research from **MyAnimeList (MAL)** and **AniList**, plus recommendations for Let's See: TV episode tracking when new seasons/episodes air, profile TV management, and extra options (e.g. watch status, default “Watching”).

---

## 1. How MyAnimeList & AniList Manage Lists

### MyAnimeList (myanimelist.net)

- **Watch status (5 categories)**  
  - **Currently Watching** – actively watching  
  - **Completed** – finished  
  - **On Hold** – paused temporarily  
  - **Dropped** – stopped before finishing  
  - **Plan to Watch** – intend to watch later  

- **Per-title data**  
  - Title, type (TV, Movie, OVA, etc.)  
  - **Episode progress**: “episodes watched / total episodes”  
  - Score/rating, custom tags, notes  

- **Episode progress**  
  - “Episodes seen” counter with a “+” to increment (sequential).  
  - No built-in way to mark *specific* non-sequential episodes (e.g. skip fillers); users use notes or workarounds.  

- **New seasons / new episodes**  
  - “Seasonal Anime” surfaces what’s airing/upcoming.  
  - Progress is per series; when a new season exists, total episodes can increase and users update progress as they watch.  

- **Stats**  
  - Total episodes watched, “days spent watching”, mean score.  

### AniList (anilist.co)

- **List status (6 options)**  
  - **CURRENT** – currently watching  
  - **PLANNING** – plan to watch  
  - **COMPLETED** – finished  
  - **DROPPED** – stopped  
  - **PAUSED** – paused  
  - **REPEATING** – re-watching  

- **Episode progress**  
  - Progress (e.g. 12/24) and optional rewatch count.  

- **API**  
  - `MediaListStatus` and `MediaList` expose status + progress for integrations.  

### Takeaways for Let's See

- **Watch status** (Watching / Completed / On Hold / Dropped / Plan to Watch) is central to how users organize and filter TV.  
- **Episode-level progress** (which episodes watched) is already in place in your app; MAL/AniList often use a simple “episodes seen” number; you have finer granularity.  
- **“Default” behavior**: many users expect new adds to go to “Watching” by default.  
- **Profile list management**: users expect to **edit** progress (add/remove episodes, mark seasons) and **change status** from the profile TV section.

---

## 2. When a Show Gets New Seasons or More Episodes

### Current behavior in your app

- **Seasons/episodes source**: Profile TV progress and “next episode” use **live TMDB data** via `getTvShowWithSeasons(showId)` (cached ~5 min).  
- So when TMDB adds:  
  - a **new season**, or  
  - **more episodes** to an existing season,  
  the next time progress is computed (e.g. profile Series progress, Continue watching), the app already sees the new season/episode list.

**Effect:**

- **New season added**  
  - User had “All caught up” → after TMDB adds S4, the same show will show “Next: S4 E1” (or first unwatched in S4). No DB change needed; your logic already finds “first unwatched” across all seasons from TMDB.  

- **More episodes in current season**  
  - e.g. User was at S3 E10 and S3 had 10 episodes; TMDB updates to 12. Next unwatched becomes S3 E11. Again, no schema change; you recompute from `watched_episodes` + current TMDB seasons.  

So **no extra “migration” or special handling is required** for new seasons/episodes: your design (store only `user_id, show_id, season_number, episode_number` and always derive totals/next from TMDB) already handles it.

**Optional improvement:**  
- Short in-app note or tooltip in Series progress: “Progress uses the latest season data; new seasons appear automatically.”  
- Optionally surface “New season available” (e.g. compare last_watched_episode to TMDB’s latest season) for “Continue watching” or profile.

---

## 3. Episode & Season Management on the Profile (TV Section)

Today, the profile **Series progress** section is **read-only**: it shows seasons done, episodes watched, and “Next / status” with a link to the show or next episode. There is no way to:

- Change which episodes are marked watched (e.g. remove one by mistake).  
- Mark a season “incomplete” (e.g. unmark a full season).  
- Set a **watch status** (Watching / Completed / On Hold / Dropped / Plan to Watch).

Recommended additions:

### 3.1 Edit progress (episode/season management)

- **Per row (per show)**  
  - **“Edit progress”** (or “Manage”) → opens a modal/drawer similar to `MarkTVWatchedModal`: list seasons/episodes, checkboxes for watched, with options to “Mark season complete” / “Unmark season” / “Mark all up to Sx Ey”.  
- **Actions**  
  - Add/remove watched episodes (call existing or new API that writes to `watched_episodes`).  
  - Optional: “Remove all progress for this show” (delete from `watched_episodes` for that user/show; optionally also remove from `watched_items` or just leave it as “Plan to watch” if you add status).

This gives **episode and season management** directly from the profile TV tracking section.

### 3.2 Watch status for TV (Watching / Completed / On Hold / Dropped / Plan to Watch)

- **Data model**  
  - Add a **TV list status** per user per show. Options:  
    - **Option A**: New table `user_tv_list` (or `tv_watch_status`): `user_id`, `show_id`, `status` enum (`watching` | `completed` | `on_hold` | `dropped` | `plan_to_watch`), `updated_at`.  
    - **Option B**: Add column to `watched_items`: e.g. `tv_status text` (only meaningful when `item_type = 'tv'`).  
  - **Default when user adds a TV show to “Watched”** (or marks first episode): set status to **Watching**. When they mark “complete series” or all episodes, set to **Completed**.  

- **Profile TV section**  
  - Show a **status** badge per show (Watching / Completed / On Hold / Dropped / Plan to Watch).  
  - **“Change status”** dropdown or menu per row → update status via API.  
  - Optional: Filter the list by status (e.g. “Show only Watching”).  

- **“Set as default”**  
  - In **settings** (or profile/account): “When I add a TV show, mark as: **Watching** (default) / Plan to watch / …”. Store in `users` (e.g. `default_tv_status`) or in a small preferences table.  
  - When user adds a show (first episode or “complete series”), use this default if no explicit status is chosen.

This aligns with MAL/AniList and gives users **more options for TV shows** and a clear “watching by default” behavior.

---

## 4. Feature Summary & Suggested Order

| Feature | Description | Effort |
|--------|-------------|--------|
| **New seasons / more episodes** | Already handled by using TMDB; optional UX note or “New season” hint. | Low |
| **TV watch status** | Add status (Watching, Completed, On Hold, Dropped, Plan to Watch) per show; DB + API + UI. | Medium |
| **Default status for new TV** | “When I add a TV show, set status to: Watching” (or Plan to watch); store in user prefs. | Low (after status exists) |
| **Profile: Edit progress** | “Edit progress” per show in Series progress → modal to add/remove watched episodes (and optionally mark/unmark seasons). | Medium |
| **Profile: Change status** | Per-row “Change status” in Series progress; filter by status. | Low (after status exists) |

Suggested order:

1. **TV watch status** (schema + API + basic UI on TV detail and “Mark as watched” flow).  
2. **Default “Watching” (or configurable)** when adding a TV show.  
3. **Profile TV section**: show status, “Change status,” then “Edit progress” (episode/season management).

---

## 5. DB Sketch for TV Watch Status (optional reference)

```sql
-- Example: optional table for TV list status (if not stored on watched_items)
create table if not exists public.user_tv_list (
  user_id uuid not null references public.users(id) on delete cascade,
  show_id text not null,
  status text not null check (status in ('watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch')),
  updated_at timestamptz not null default now(),
  primary key (user_id, show_id)
);

-- Or add column to users for default TV status
-- alter table public.users add column default_tv_status text default 'watching';
```

---

## 6. References

- MyAnimeList: list categories, episode progress, seasonal anime.  
- AniList: `MediaListStatus` (CURRENT, PLANNING, COMPLETED, DROPPED, PAUSED, REPEATING).  
- Your app: `watched_episodes`, `watched_items`, `getTvShowWithSeasons`, Profile “Series progress” and Continue watching.

Implementing **TV watch status**, **default “Watching”**, and **profile episode/season management** will bring Let's See close to how MAL/AniList serve users while keeping your stronger per-episode tracking.
