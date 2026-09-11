/**
 * A month, remembered.
 *
 * Airbuds' pitch to students is "Wrapped, but every week"; Letterboxd's year
 * arrives once and is the strongest re-activation moment the product has. A
 * month is the honest middle: often enough to be a habit, rare enough to have
 * something in it. Same rules as the year — people and moments first, counts
 * last, nothing estimated (docs/WHY_PEOPLE_COME_BACK.md §9 Bet 6).
 *
 * Built from `viewings`, so a rewatch counts as a viewing and a companion is
 * a fact, not an inference from overlap.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type MonthFilm = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  score: number | null;
  watchedOn: string;
  companions: string[];
  rewatch: boolean;
};

export type MonthInReview = {
  /** yyyy-mm */
  month: string;
  label: string;
  username: string;
  avatarUrl: string | null;
  viewings: number;
  movies: number;
  shows: number;
  rewatches: number;
  daysWithSomething: number;
  /** The most-named companion this month. */
  watchedWith: { label: string; username: string | null; avatarUrl: string | null; count: number } | null;
  /** The viewing to remember: highest rated, ties broken by having company. */
  bestNight: MonthFilm | null;
  /** Up to four posters, best-rated first. */
  posters: MonthFilm[];
  sparse: boolean;
};

const SPARSE_THRESHOLD = 3;

export function monthBounds(month: string): { start: string; end: string; label: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const label = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { start: `${m[1]}-${m[2]}-01`, end: `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}`, label };
}

/** The previous calendar month as yyyy-mm, in the caller's clock. */
export function previousMonth(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type ViewingRow = {
  id: number;
  item_id: string;
  item_type: string;
  watched_on: string;
  rewatch: boolean;
  viewing_companions:
    | {
        companion_user_id: string | null;
        name: string | null;
        users: { username: string | null; avatar_url: string | null } | { username: string | null; avatar_url: string | null }[] | null;
      }[]
    | null;
};

export async function buildMonthInReview(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  avatarUrl: string | null,
  month: string,
): Promise<MonthInReview | null> {
  const bounds = monthBounds(month);
  if (!bounds) return null;

  const [viewingsRes, ratingsRes] = await Promise.all([
    supabase
      .from("viewings")
      .select(
        "id, item_id, item_type, watched_on, rewatch, viewing_companions!viewing_id(companion_user_id, name, users(username, avatar_url))",
      )
      .eq("user_id", userId)
      .gte("watched_on", bounds.start)
      .lte("watched_on", bounds.end)
      .order("watched_on", { ascending: true })
      .limit(500),
    supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", userId),
  ]);

  const rows = ((viewingsRes.data ?? []) as unknown as ViewingRow[]).map((v) => ({
    ...v,
    item_type: v.item_type === "tv" ? ("tv" as const) : ("movie" as const),
  }));

  const ids = [...new Set(rows.map((r) => r.item_id))];
  const titles = new Map<string, { name: string; image: string | null }>();
  if (ids.length) {
    const { data } = await supabase
      .from("user_media_status")
      .select("item_id, item_type, item_name, image_url")
      .eq("user_id", userId)
      .in("item_id", ids);
    for (const t of (data ?? []) as { item_id: string; item_type: string; item_name: string; image_url: string | null }[]) {
      titles.set(`${t.item_type}:${t.item_id}`, { name: t.item_name ?? "", image: t.image_url ?? null });
    }
  }
  const scores = new Map((ratingsRes.data ?? []).map((r) => [`${r.item_type}:${r.item_id}`, Number(r.score)]));

  const films: MonthFilm[] = rows.map((r) => {
    const key = `${r.item_type}:${r.item_id}`;
    const t = titles.get(key);
    return {
      itemId: r.item_id,
      itemType: r.item_type,
      itemName: t?.name ?? "",
      imageUrl: t?.image ?? null,
      score: scores.get(key) ?? null,
      watchedOn: r.watched_on,
      rewatch: r.rewatch,
      companions: (r.viewing_companions ?? [])
        .map((c) => {
          const u = Array.isArray(c.users) ? c.users[0] : c.users;
          return u?.username ?? c.name ?? "";
        })
        .filter(Boolean),
    };
  });

  const keys = new Set(films.map((f) => `${f.itemType}:${f.itemId}`));
  const movies = [...keys].filter((k) => k.startsWith("movie:")).length;
  const shows = [...keys].filter((k) => k.startsWith("tv:")).length;

  const companions = new Map<string, { label: string; username: string | null; avatarUrl: string | null; count: number }>();
  for (const r of rows) {
    for (const c of r.viewing_companions ?? []) {
      const u = Array.isArray(c.users) ? c.users[0] : c.users;
      const key = c.companion_user_id ? `u:${c.companion_user_id}` : `n:${(c.name ?? "").trim().toLowerCase()}`;
      if (key === "n:") continue;
      const e = companions.get(key) ?? {
        label: u?.username ?? c.name ?? "",
        username: u?.username ?? null,
        avatarUrl: u?.avatar_url ?? null,
        count: 0,
      };
      e.count += 1;
      companions.set(key, e);
    }
  }
  const watchedWith = [...companions.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  const rated = films.filter((f) => f.itemName);
  const bestNight =
    rated
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.companions.length - a.companions.length)[0] ?? null;

  const posters = rated
    .filter((f, i, arr) => arr.findIndex((x) => x.itemId === f.itemId && x.itemType === f.itemType) === i)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 4);

  return {
    month,
    label: bounds.label,
    username,
    avatarUrl,
    viewings: films.length,
    movies,
    shows,
    rewatches: films.filter((f) => f.rewatch).length,
    daysWithSomething: new Set(films.map((f) => f.watchedOn)).size,
    watchedWith,
    bestNight,
    posters,
    sparse: films.length < SPARSE_THRESHOLD,
  };
}
