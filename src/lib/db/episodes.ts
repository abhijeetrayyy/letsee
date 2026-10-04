/**
 * Which of your people have watched which episodes of one show, for the
 * faces on episode rows (docs/design/SYSTEM.md §8, `EpisodeRow`).
 *
 * In the browser, under the viewer's own RLS: `watched_episodes` rows are
 * readable only where the person's profile is visible to you (migration 073),
 * so a private diary contributes nothing here without any check of ours. One
 * query per show, scoped to a season when the page is one.
 */
import { supabase } from "@/utils/supabase/client";
import type { RoomPerson } from "@/lib/db/rooms";

export async function peopleOnEpisodes(people: RoomPerson[], showId: string, season?: number): Promise<Map<string, RoomPerson[]>> {
  const out = new Map<string, RoomPerson[]>();
  if (!people.length) return out;
  const byId = new Map(people.map((p) => [p.id, p]));
  let req = supabase
    .from("watched_episodes")
    .select("user_id, season_number, episode_number")
    .eq("show_id", showId)
    .in("user_id", [...byId.keys()])
    .gt("season_number", 0)
    .limit(5000);
  if (season != null) req = req.eq("season_number", season);
  const { data } = await req;
  for (const r of data ?? []) {
    const p = byId.get(r.user_id);
    if (!p) continue;
    const k = `${r.season_number}:${r.episode_number}`;
    const list = out.get(k) ?? [];
    if (!list.some((x) => x.id === p.id)) list.push(p);
    out.set(k, list);
  }
  return out;
}
