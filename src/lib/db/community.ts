/**
 * What everyone on letsee has been watching, for Home's *On letsee lately*
 * and *Popular on letsee* — so Home is alive before you have people
 * of your own, and still shows the wider room once you do.
 *
 * Read in the browser under the viewer's own RLS: a viewing is readable only
 * where its person's profile is visible to you
 * (`viewings_select_profile_visible`), the same rule a profile's diary
 * follows, so a private account contributes nothing here. Blocked people and
 * you are left out. Titles only — no ratings, no words.
 */
import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";
import type { RoomPerson } from "@/lib/db/rooms";

export type CommunityLog = {
  id: number;
  person: RoomPerson;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  watchedOn: string;
  at: string;
};

export type CommunityTitle = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  people: RoomPerson[];
};

export async function fetchCommunity(me: string | null): Promise<{ lately: CommunityLog[]; popular: CommunityTitle[] }> {
  // Ninety days, not seven: letsee is small, and a week can hold one log. The
  // newest come first either way, so a busy week still shows only that week.
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const [{ data: rows }, blocked] = await Promise.all([
    supabase.from("viewings").select("id, user_id, item_id, item_type, watched_on, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(300),
    getBlockedUserIds(supabase, me),
  ]);
  const viewings = (rows ?? []).filter((v) => v.user_id !== me && !blocked.has(v.user_id));
  if (!viewings.length) return { lately: [], popular: [] };

  const userIds = [...new Set(viewings.map((v) => v.user_id))];
  const itemIds = [...new Set(viewings.map((v) => v.item_id))];
  const [{ data: users }, { data: meta }] = await Promise.all([
    supabase.from("users").select("id, username, avatar_url").in("id", userIds).is("deleted_at", null),
    supabase.from("user_media_status").select("user_id, item_id, item_type, item_name, image_url").in("user_id", userIds).in("item_id", itemIds).limit(2000),
  ]);
  const people = new Map((users ?? []).filter((u) => u.username).map((u) => [u.id, { id: u.id, username: u.username as string, avatarUrl: u.avatar_url as string | null }]));
  // Names and posters live on each person's own library row for the title.
  const titles = new Map<string, { name: string; image: string | null }>();
  for (const m of meta ?? []) {
    if (m.item_name && !titles.has(`${m.item_type}:${m.item_id}`)) titles.set(`${m.item_type}:${m.item_id}`, { name: m.item_name, image: m.image_url });
  }

  const lately: CommunityLog[] = [];
  const byTitle = new Map<string, CommunityTitle>();
  const seen = new Set<string>();
  for (const v of viewings) {
    const person = people.get(v.user_id);
    const type: "movie" | "tv" = v.item_type === "tv" ? "tv" : "movie";
    const key = `${type}:${v.item_id}`;
    const t = titles.get(key);
    if (!person || !t) continue;
    // One line per person and title: forty imports of one evening are not forty events.
    if (!seen.has(`${v.user_id}:${key}`)) {
      seen.add(`${v.user_id}:${key}`);
      lately.push({ id: v.id, person, itemId: v.item_id, itemType: type, itemName: t.name, imageUrl: t.image, watchedOn: v.watched_on, at: v.created_at });
    }
    const entry: CommunityTitle = byTitle.get(key) ?? { itemId: v.item_id, itemType: type, itemName: t.name, imageUrl: t.image, people: [] };
    if (!entry.people.some((p) => p.id === person.id)) entry.people.push(person);
    byTitle.set(key, entry);
  }

  // Popular means several different people, not one person's binge.
  const popular = [...byTitle.values()].filter((t) => t.people.length > 1).sort((a, b) => b.people.length - a.people.length).slice(0, 16);
  // A person shows up at most twice in a row of the feed, so one busy account can't fill it.
  const perPerson = new Map<string, number>();
  const spread = lately.filter((l) => {
    const n = (perPerson.get(l.person.id) ?? 0) + 1;
    perPerson.set(l.person.id, n);
    return n <= 2;
  });
  return { lately: spread.slice(0, 18), popular };
}
