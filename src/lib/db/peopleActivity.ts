/**
 * What your people logged lately, for Home (docs/design/RETHINK.md §3d):
 * their viewings this week and what they are part-way through.
 *
 * Only things people logged themselves — no "online", no "last seen". Read in
 * the browser; `viewings_select_profile_visible` and the matching policy on
 * `user_media_status` return rows only for profiles the viewer may see, so a
 * private friend simply contributes nothing.
 */
import { supabase } from "@/utils/supabase/client";

export type PersonViewing = {
  userId: string;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  watchedOn: string;
  at: string;
};

export type PersonWatching = {
  userId: string;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  at: string;
};

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function fetchPeopleActivity(ids: string[], days = 7): Promise<{ viewings: PersonViewing[]; watching: PersonWatching[] }> {
  if (!ids.length) return { viewings: [], watching: [] };
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [viewingRows, watchingRows] = await Promise.all([
    supabase
      .from("viewings")
      .select("user_id, item_id, item_type, watched_on, created_at")
      .in("user_id", ids)
      .gte("watched_on", isoDay(since))
      .order("watched_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => data ?? []),
    supabase
      .from("user_media_status")
      .select("user_id, item_id, item_type, item_name, image_url, updated_at")
      .in("user_id", ids)
      .eq("status", "watching")
      .gte("updated_at", new Date(Date.now() - 14 * 864e5).toISOString())
      .order("updated_at", { ascending: false })
      .limit(60)
      .then(({ data }) => data ?? []),
  ]);

  // Names and posters live on each person's library row for the title.
  const itemIds = [...new Set(viewingRows.map((v) => v.item_id))];
  const meta = new Map<string, { name: string; image: string | null }>();
  if (itemIds.length) {
    const { data } = await supabase
      .from("user_media_status")
      .select("user_id, item_id, item_type, item_name, image_url")
      .in("user_id", ids)
      .in("item_id", itemIds)
      .limit(1000);
    for (const m of data ?? []) {
      if (m.item_name) meta.set(`${m.user_id}:${m.item_type}:${m.item_id}`, { name: m.item_name, image: m.image_url });
    }
  }

  const viewings: PersonViewing[] = viewingRows
    .map((v) => {
      const type: "movie" | "tv" = v.item_type === "tv" ? "tv" : "movie";
      const m = meta.get(`${v.user_id}:${type}:${v.item_id}`);
      return m
        ? { userId: v.user_id, itemId: v.item_id, itemType: type, itemName: m.name, imageUrl: m.image, watchedOn: v.watched_on, at: v.created_at }
        : null;
    })
    .filter((v): v is PersonViewing => !!v);

  const watching: PersonWatching[] = watchingRows
    .filter((w) => w.item_name)
    .map((w) => ({
      userId: w.user_id,
      itemId: w.item_id,
      itemType: w.item_type === "tv" ? "tv" : "movie",
      itemName: w.item_name,
      imageUrl: w.image_url,
      at: w.updated_at,
    }));

  return { viewings, watching };
}
