/**
 * Lists, read in the browser under the viewer's own RLS (docs/design/PAGES.md
 * §6, lists). `user_lists_select_collaborator` (050) already decides which
 * lists a viewer may see — public, their own, or ones they help keep — so
 * every read here is a plain query and costs no server work.
 */
import { supabase } from "@/utils/supabase/client";
import type { RoomPerson } from "@/lib/db/rooms";

export type ListCard = {
  id: number;
  name: string;
  description: string | null;
  visibility: string;
  owner: RoomPerson | null;
  count: number;
  /** Up to four posters, in list order, for the mosaic. */
  posters: (string | null)[];
  likes: number;
  updatedAt: string;
};

type ListRow = { id: number; name: string; description: string | null; visibility: string; user_id: string; updated_at: string };

const COLUMNS = "id, name, description, visibility, user_id, updated_at";

/** Counts, four posters and likes for a set of lists: three queries, whatever the number of lists. */
async function enrich(rows: ListRow[]): Promise<ListCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const ownerIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: items }, { data: likes }, { data: owners }] = await Promise.all([
    supabase.from("user_list_items").select("list_id, image_url, position").in("list_id", ids).order("position", { ascending: true }).limit(5000),
    supabase.from("reactions").select("target_id").eq("target_type", "list").in("target_id", ids),
    supabase.from("users").select("id, username, avatar_url").in("id", ownerIds),
  ]);
  const count = new Map<number, number>();
  const posters = new Map<number, (string | null)[]>();
  for (const it of items ?? []) {
    count.set(it.list_id, (count.get(it.list_id) ?? 0) + 1);
    const p = posters.get(it.list_id) ?? [];
    if (p.length < 4) p.push(it.image_url);
    posters.set(it.list_id, p);
  }
  const likeCount = new Map<number, number>();
  for (const l of likes ?? []) likeCount.set(l.target_id, (likeCount.get(l.target_id) ?? 0) + 1);
  const byId = new Map((owners ?? []).filter((u) => u.username).map((u) => [u.id, { id: u.id, username: u.username as string, avatarUrl: u.avatar_url }]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    visibility: r.visibility,
    owner: byId.get(r.user_id) ?? null,
    count: count.get(r.id) ?? 0,
    posters: posters.get(r.id) ?? [],
    likes: likeCount.get(r.id) ?? 0,
    updatedAt: r.updated_at,
  }));
}

/** Yours: the lists you made and the ones you help keep. */
export async function fetchMyLists(me: string): Promise<ListCard[]> {
  const [{ data: own }, { data: shared }] = await Promise.all([
    supabase.from("user_lists").select(COLUMNS).eq("user_id", me).order("updated_at", { ascending: false }).limit(60),
    supabase.from("user_list_collaborators").select("list_id").eq("user_id", me).limit(60),
  ]);
  const sharedIds = (shared ?? []).map((s) => s.list_id).filter((id) => !(own ?? []).some((o) => o.id === id));
  const { data: collab } = sharedIds.length ? await supabase.from("user_lists").select(COLUMNS).in("id", sharedIds) : { data: [] };
  const rows = [...(own ?? []), ...(collab ?? [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) as ListRow[];
  return enrich(rows);
}

/** Lists made by these people that you are allowed to see, newest first. */
export async function fetchListsBy(userIds: string[], limit = 24): Promise<ListCard[]> {
  if (!userIds.length) return [];
  const { data } = await supabase.from("user_lists").select(COLUMNS).in("user_id", userIds).order("updated_at", { ascending: false }).limit(limit);
  return enrich((data ?? []) as ListRow[]);
}

/** Popular: public lists, most saved first, then the most recently touched. */
export async function fetchPopularLists(limit = 24): Promise<ListCard[]> {
  const { data } = await supabase.from("user_lists").select(COLUMNS).eq("visibility", "public").order("updated_at", { ascending: false }).limit(60);
  const cards = await enrich((data ?? []) as ListRow[]);
  return cards
    .filter((c) => c.count > 0)
    .sort((a, b) => b.likes - a.likes || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}
