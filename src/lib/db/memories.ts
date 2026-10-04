/**
 * "A year ago today you and Priya watched Past Lives." (docs/design/RETHINK.md
 * §3d, "A memory".)
 *
 * Resurfacing a positive logged memory improves momentary mood with one of
 * the largest effects in the whole literature (Konrad et al. 2016, d ≈ 1.15);
 * resurfacing a negative one while happy makes it worse. So this filters by
 * valence — a rating of 7 or above, a rewatch, or somebody being there — and
 * never shows the film you hated on this day in 2021.
 */
import { supabase } from "@/utils/supabase/client";
import { titleMetaFor } from "@/utils/viewings";

type Row = {
  id: number;
  item_id: string;
  item_type: string;
  watched_on: string;
  rewatch: boolean;
  viewing_companions:
    | { companion_user_id: string | null; name: string | null; users: { username: string | null } | { username: string | null }[] | null }[]
    | null;
};

export type Memory = {
  id: number;
  itemId: string;
  itemType: "movie" | "tv";
  name: string;
  image: string | null;
  yearsAgo: number;
  companions: string[];
  rewatch: boolean;
};

function mmdd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function fetchMemories(userId: string, today = new Date()): Promise<Memory[]> {
  const key = mmdd(today);
  const thisYear = today.getFullYear();

  // Every prior year on this month-day. Cheap: the user's own rows, indexed
  // by (user_id, watched_on), and the filter is client-side over what is
  // usually a handful of matches per date.
  const dates: string[] = [];
  for (let y = thisYear - 1; y >= thisYear - 15; y--) dates.push(`${y}-${key}`);
  const { data: viewingRows } = await supabase
    .from("viewings")
    .select("id, item_id, item_type, watched_on, rewatch, viewing_companions!viewing_id(companion_user_id, name, users(username))")
    .eq("user_id", userId)
    .in("watched_on", dates)
    .order("watched_on", { ascending: false })
    .limit(20);
  const rows = (viewingRows ?? []) as unknown as Row[];
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.item_id))];
  // Scoped to the handful of titles above, not the whole ratings table.
  const [{ data: ratings }, names] = await Promise.all([
    supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", userId).in("item_id", ids),
    titleMetaFor(supabase, userId, ids),
  ]);
  const scores = new Map((ratings ?? []).map((r) => [`${r.item_type}:${r.item_id}`, Number(r.score)]));
  const memories: Memory[] = rows
    .map((r) => {
      const k = `${r.item_type}:${r.item_id}`;
      const score = scores.get(k) ?? null;
      const companions = (r.viewing_companions ?? [])
        .map((c) => {
          const u = Array.isArray(c.users) ? c.users[0] : c.users;
          return u?.username ?? c.name ?? "";
        })
        .filter(Boolean);
      const positive = (score !== null && score >= 7) || r.rewatch || companions.length > 0;
      return positive
        ? {
            id: r.id,
            itemId: r.item_id,
            itemType: r.item_type === "tv" ? ("tv" as const) : ("movie" as const),
            name: names.get(k)?.name ?? "",
            image: names.get(k)?.image ?? null,
            yearsAgo: thisYear - Number(r.watched_on.slice(0, 4)),
            companions,
            rewatch: r.rewatch,
          }
        : null;
    })
    .filter((m): m is Memory => !!m && !!m.name)
    .slice(0, 3);
  return memories;
}
