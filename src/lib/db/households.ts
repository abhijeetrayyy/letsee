/**
 * Who you live with (migration 124; docs/IDEAS_2026-10.md §4.4). Your rows
 * only — RLS shows nobody else, them included. It changes your own screens:
 * the diary sheet suggests them as who was there, and a series page shows
 * where they are. Read in the browser; one small read, cached by SWR under
 * `["household", me]`.
 */
import { supabase } from "@/utils/supabase/client";
import type { RoomPerson } from "@/lib/db/rooms";

export async function fetchHousehold(me: string): Promise<RoomPerson[]> {
  const { data: rows } = await supabase.from("households").select("other_id").eq("user_id", me);
  const ids = (rows ?? []).map((r) => r.other_id as string);
  if (!ids.length) return [];
  const { data: people } = await supabase.from("users").select("id, username, avatar_url").in("id", ids).is("deleted_at", null);
  return (people ?? []).filter((p) => p.username).map((p) => ({ id: p.id as string, username: p.username as string, avatarUrl: (p.avatar_url as string | null) ?? null }));
}

export async function setHousehold(me: string, other: string, on: boolean): Promise<boolean> {
  const { error } = on
    ? await supabase.from("households").upsert({ user_id: me, other_id: other }, { onConflict: "user_id,other_id", ignoreDuplicates: true })
    : await supabase.from("households").delete().eq("user_id", me).eq("other_id", other);
  if (error) console.error("setHousehold:", error);
  return !error;
}

/** Their marked episodes of one show — under their profile's visibility, like any of their episodes. */
export async function fetchTheirEpisodes(userId: string, showId: string): Promise<Set<string>> {
  const { data } = await supabase.from("watched_episodes").select("season_number, episode_number").eq("user_id", userId).eq("show_id", showId).gt("season_number", 0);
  return new Set((data ?? []).map((r) => `${r.season_number}:${r.episode_number}`));
}
