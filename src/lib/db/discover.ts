/**
 * Finding people on letsee (People → Find people): the reads behind each
 * shelf, all in the browser under the viewer's own RLS, a couple of queries
 * per shelf — never one per person.
 *
 * Nobody you already follow, nobody you've blocked or who blocked you, and
 * nobody whose account is closed: every read of `users` filters `deleted_at`,
 * and the row is hidden from everyone else besides (082).
 */
import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";
import { getPosterUrl } from "@/utils/imageUrl";

export type Candidate = {
  id: string;
  username: string;
  avatarUrl: string | null;
  /** Why they're here, in a few words: "Followed by jojo", "Joined this week". */
  reason: string | null;
};

/** People followed by people you follow, introduced by who: "Followed by jojo and priya". */
export async function followedByYourPeople(me: string, exclude: Set<string>, limit = 6): Promise<Candidate[]> {
  const { data: mine } = await supabase.from("user_connections").select("followed_id").eq("follower_id", me);
  const myPeople = new Set((mine ?? []).map((r) => r.followed_id as string));
  if (!myPeople.size) return [];
  const { data: theirs } = await supabase
    .from("user_connections")
    .select("follower_id, followed_id")
    .in("follower_id", [...myPeople])
    .limit(2000);
  const via = new Map<string, string[]>();
  for (const r of theirs ?? []) {
    const id = r.followed_id as string;
    if (id === me || myPeople.has(id) || exclude.has(id)) continue;
    via.set(id, [...(via.get(id) ?? []), r.follower_id as string]);
  }
  // Most shared connections first; that order is never shown as a number.
  const ranked = [...via.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, limit * 2);
  if (!ranked.length) return [];
  const ids = new Set([...ranked.map(([id]) => id), ...ranked.flatMap(([, v]) => v.slice(0, 2))]);
  const [{ data: users }, blocked] = await Promise.all([
    supabase.from("users").select("id, username, avatar_url").in("id", [...ids]).is("deleted_at", null),
    getBlockedUserIds(supabase, me),
  ]);
  const byId = new Map((users ?? []).filter((u) => u.username && !blocked.has(u.id)).map((u) => [u.id as string, u]));
  return ranked
    .flatMap(([id, followers]) => {
      const u = byId.get(id);
      if (!u) return [];
      const names = followers.map((f) => byId.get(f)?.username).filter(Boolean).slice(0, 2) as string[];
      return [{ id, username: u.username as string, avatarUrl: u.avatar_url ?? null, reason: names.length ? `Followed by ${names.join(" and ")}` : null }];
    })
    .slice(0, limit);
}

/** The newest people here: someone who joined this week is easy to say hello to. */
export async function newOnLetsee(me: string, exclude: Set<string>, limit = 6): Promise<Candidate[]> {
  const [{ data: users }, blocked] = await Promise.all([
    supabase
      .from("users")
      .select("id, username, avatar_url, created_at")
      .not("username", "is", null)
      .is("deleted_at", null)
      .neq("id", me)
      .order("created_at", { ascending: false })
      .limit(limit + exclude.size + 6),
    getBlockedUserIds(supabase, me),
  ]);
  return (users ?? [])
    .filter((u) => !exclude.has(u.id) && !blocked.has(u.id))
    .slice(0, limit)
    .map((u) => ({ id: u.id, username: u.username as string, avatarUrl: u.avatar_url ?? null, reason: joined(u.created_at as string | null) }));
}

function joined(at: string | null, now = Date.now()): string | null {
  if (!at) return null;
  const days = (now - Date.parse(at)) / 864e5;
  if (days < 7) return "Joined this week";
  if (days < 31) return "Joined this month";
  return `Joined in ${new Date(at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
}

export type Details = {
  /** Their own line, when they've written one. */
  tagline: string | null;
  visibility: string;
  /** The four on their profile, when it's public: what they love, at a glance. */
  four: { image: string; name: string }[];
};

/** A line and the four for everyone on screen, in two reads. */
export async function detailsFor(ids: string[]): Promise<Map<string, Details>> {
  const out = new Map<string, Details>();
  if (!ids.length) return out;
  const [{ data: users }, { data: four }] = await Promise.all([
    supabase.from("users").select("id, tagline, visibility").in("id", ids),
    supabase.from("user_favorite_display").select("user_id, position, image_url, item_name").in("user_id", ids).order("position", { ascending: true }),
  ]);
  for (const u of users ?? []) {
    out.set(u.id as string, {
      tagline: (u.tagline as string | null)?.trim() || null,
      visibility: String(u.visibility ?? "public").toLowerCase(),
      four: [],
    });
  }
  for (const f of four ?? []) {
    const d = out.get(f.user_id as string);
    // A private profile's four stay on its profile, behind its own rules.
    if (!d || d.visibility !== "public" || !f.image_url) continue;
    // Older rows hold a TMDB path rather than an address.
    d.four.push({ image: getPosterUrl(f.image_url as string, "w154"), name: (f.item_name as string) ?? "" });
  }
  return out;
}
