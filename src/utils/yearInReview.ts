/**
 * A year, counted — and, since 095, remembered.
 *
 * ── On the numbers ──────────────────────────────────────────────────────────
 * There is no "hours watched" here, and there must not be. 054_remove_hours.sql
 * removed that stat and dropped every runtime column behind it, on the grounds
 * that a total nobody can verify is worse than no total. A year-in-review card
 * is exactly where the temptation to reintroduce a big impressive fabricated
 * number is strongest, so: counts of rows the user actually created, and
 * nothing else.
 *
 * ── On dates ────────────────────────────────────────────────────────────────
 * The year is sliced on `viewings.watched_on` — one row per time something was
 * watched (095). Before that it was sliced on `watched_items.watched_at`, which
 * is now a projection of the most recent viewing, so the two agree for anyone
 * who never rewatches and the viewing is right for everyone else: a film seen
 * in March and again in December counts once as a film and once as a rewatch.
 *
 * ── On order ────────────────────────────────────────────────────────────────
 * People and moments first, counts last. Reminiscing on positive memories
 * lifts mood; a Wrapped-style count invites performing for the number
 * (docs/WHY_PEOPLE_COME_BACK.md §6). So the first line on the card names
 * somebody you watched with, and the total is the last thing on it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type YearFilm = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  score: number | null;
};

export type SharedWith = {
  username: string;
  avatarUrl: string | null;
  count: number;
  /** One title they both watched, so the line has something concrete in it. */
  exampleTitle: string | null;
};

export type WatchedWith = {
  /** null for a name that is not on letsee. */
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  count: number;
  exampleTitle: string | null;
};

export type YearInReview = {
  year: number;
  username: string;
  avatarUrl: string | null;
  /** Films and shows watched, counted separately — never summed into "titles". */
  movies: number;
  shows: number;
  episodes: number;
  ratingsGiven: number;
  reviewsWritten: number;
  /** Viewings marked as a rewatch. A comfort film counts every time. */
  rewatches: number;
  /** The rewatched title with the most viewings this year, if any. */
  comfortWatch: YearFilm | null;
  /** Highest rated, for the poster grid. */
  topRated: YearFilm[];
  /** Up to twelve, best-rated first: what Edit before you share chooses from. */
  posterPool: YearFilm[];
  topGenres: { genre: string; count: number }[];
  busiestMonth: { month: string; count: number } | null;
  /** Who they watched with most, from the viewings themselves. */
  watchedWith: WatchedWith[];
  /** The follow-graph overlap, kept from before: who watched the same things. */
  sharedWith: SharedWith | null;
  /** True when there is too little here to be worth a card. */
  sparse: boolean;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Below this a card is a series of zeroes, which nobody wants to look at. */
const SPARSE_THRESHOLD = 3;

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

export async function buildYearInReview(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  avatarUrl: string | null,
  year: number,
): Promise<YearInReview> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const startTs = `${year}-01-01T00:00:00.000Z`;
  const endTs = `${year + 1}-01-01T00:00:00.000Z`;

  const [viewingsRes, episodesRes, episodeShowsRes, ratingsRes, notesRes] = await Promise.all([
    supabase
      .from("viewings")
      .select(
        "id, item_id, item_type, watched_on, rewatch, viewing_companions!viewing_id(companion_user_id, name, users(username, avatar_url))",
      )
      .eq("user_id", userId)
      .gte("watched_on", start)
      .lte("watched_on", end)
      .order("watched_on", { ascending: true })
      .limit(2000),
    supabase
      .from("watched_episodes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("season_number", 0)
      .gte("watched_at", startTs)
      .lt("watched_at", endTs),
    // The shows those episodes belong to. A series you were part-way through
    // all year has no viewing (a viewing is "finished it"), and a year of 300
    // episodes that reads "0 shows" is not a year anyone recognises.
    supabase
      .from("watched_episodes")
      .select("show_id")
      .eq("user_id", userId)
      .gt("season_number", 0)
      .gte("watched_at", startTs)
      .lt("watched_at", endTs)
      .limit(5000),
    supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", userId),
    supabase.rpc("my_diary_notes"),
  ]);

  const viewings = ((viewingsRes.data ?? []) as unknown as ViewingRow[]).map((v) => ({
    ...v,
    item_type: v.item_type === "tv" ? ("tv" as const) : ("movie" as const),
  }));

  // Names, posters and genres for every title watched this year — the
  // viewings, plus every series an episode was ticked on.
  const episodeShowKeys = [...new Set(((episodeShowsRes.data ?? []) as { show_id: string | number }[]).map((r) => `tv:${r.show_id}`))];
  const titleKeys = [...new Set([...viewings.map((v) => `${v.item_type}:${v.item_id}`), ...episodeShowKeys])];
  const titleIds = [...new Set(titleKeys.map((k) => k.slice(k.indexOf(":") + 1)))];
  const titles = new Map<string, { name: string; image: string | null; genres: string[] }>();
  if (titleIds.length) {
    const { data } = await supabase
      .from("user_media_status")
      .select("item_id, item_type, item_name, image_url, genres")
      .eq("user_id", userId)
      .in("item_id", titleIds.slice(0, 1000));
    for (const t of (data ?? []) as { item_id: string; item_type: string; item_name: string; image_url: string | null; genres: string[] | null }[]) {
      titles.set(`${t.item_type}:${t.item_id}`, {
        name: t.item_name ?? "",
        image: t.image_url ?? null,
        genres: Array.isArray(t.genres) ? t.genres.filter((g): g is string => typeof g === "string") : [],
      });
    }
  }

  const scoreByKey = new Map(
    (ratingsRes.data ?? []).map((r) => [`${r.item_type}:${r.item_id}`, Number(r.score)]),
  );

  const movies = titleKeys.filter((k) => k.startsWith("movie:")).length;
  const shows = titleKeys.filter((k) => k.startsWith("tv:")).length;

  const noteKeys = new Set(
    ((notesRes.data ?? []) as { item_id: string; item_type: string }[]).map(
      (n) => `${n.item_type}:${n.item_id}`,
    ),
  );
  const reviewsWritten = titleKeys.filter((k) => noteKeys.has(k)).length;
  // Ratings counted for *this year's* titles, not all-time — the card is about
  // the year, and an all-time total sitting among year figures reads as a lie.
  const ratingsGiven = titleKeys.filter((k) => scoreByKey.has(k)).length;

  const rewatches = viewings.filter((v) => v.rewatch).length;

  // The comfort watch: the title rewatched most this year.
  const rewatchCounts = new Map<string, number>();
  for (const v of viewings) if (v.rewatch) rewatchCounts.set(`${v.item_type}:${v.item_id}`, (rewatchCounts.get(`${v.item_type}:${v.item_id}`) ?? 0) + 1);
  const comfortKey = [...rewatchCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const toFilm = (key: string): YearFilm => {
    const [itemType, itemId] = key.split(":") as ["movie" | "tv", string];
    const t = titles.get(key);
    return { itemId, itemType, itemName: t?.name ?? "", imageUrl: t?.image ?? null, score: scoreByKey.get(key) ?? null };
  };
  const comfortWatch = comfortKey && titles.get(comfortKey)?.name ? toFilm(comfortKey) : null;

  // Twelve to choose from when editing the card before sharing; the card
  // starts with the first four.
  const posterPool: YearFilm[] = titleKeys
    .map(toFilm)
    .filter((f) => f.score !== null && f.itemName)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 12);
  const topRated = posterPool.slice(0, 4);

  const genreCounts = new Map<string, number>();
  for (const k of titleKeys) {
    for (const g of titles.get(k)?.genres ?? []) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  }
  const topGenres = [...genreCounts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const monthCounts = new Array(12).fill(0);
  for (const v of viewings) {
    const month = Number(v.watched_on.slice(5, 7)) - 1;
    if (month >= 0 && month < 12) monthCounts[month] += 1;
  }
  const peak = monthCounts.reduce((best, n, i) => (n > monthCounts[best] ? i : best), 0);
  const busiestMonth =
    monthCounts[peak] > 0 ? { month: MONTHS[peak], count: monthCounts[peak] } : null;

  // Who was there. Grouped by person; a name that is not on letsee still counts.
  const companions = new Map<string, WatchedWith>();
  for (const v of viewings) {
    for (const c of v.viewing_companions ?? []) {
      const u = Array.isArray(c.users) ? c.users[0] : c.users;
      const key = c.companion_user_id ? `u:${c.companion_user_id}` : `n:${(c.name ?? "").trim().toLowerCase()}`;
      if (key === "n:") continue;
      const e = companions.get(key) ?? {
        username: u?.username ?? null,
        name: c.companion_user_id ? null : c.name,
        avatarUrl: u?.avatar_url ?? null,
        count: 0,
        exampleTitle: null,
      };
      e.count += 1;
      e.exampleTitle ??= titles.get(`${v.item_type}:${v.item_id}`)?.name || null;
      companions.set(key, e);
    }
  }
  const watchedWith = [...companions.values()].sort((a, b) => b.count - a.count).slice(0, 3);

  const sharedWith = await findSharedWith(supabase, userId, titleIds, startTs, endTs);

  return {
    year,
    username,
    avatarUrl,
    movies,
    shows,
    episodes: episodesRes.count ?? 0,
    ratingsGiven,
    reviewsWritten,
    rewatches,
    comfortWatch,
    topRated,
    posterPool,
    topGenres,
    busiestMonth,
    watchedWith,
    sharedWith,
    sparse: movies + shows < SPARSE_THRESHOLD,
  };
}

/**
 * The person you overlapped with most this year.
 *
 * This is the line that makes the card worth posting, because it names someone
 * else — "you and @priya watched 14 of the same films" is a message to Priya,
 * not a statistic about you. Restricted to people the user follows: overlap
 * with a stranger is trivia, overlap with a friend is a conversation.
 */
async function findSharedWith(
  supabase: SupabaseClient,
  userId: string,
  itemIds: string[],
  start: string,
  end: string,
): Promise<SharedWith | null> {
  if (itemIds.length === 0) return null;

  const { data: connections } = await supabase
    .from("user_connections")
    .select("followed_id")
    .eq("follower_id", userId);

  const followedIds = (connections ?? []).map((c) => c.followed_id as string);
  if (followedIds.length === 0) return null;

  // Bounded so a decade-long library doesn't build a query the size of a book.
  const ids = itemIds.slice(0, 400);

  const { data: theirs } = await supabase
    .from("watched_items")
    .select("user_id, item_id, item_name")
    .in("user_id", followedIds)
    .in("item_id", ids)
    .eq("is_watched", true)
    .gte("watched_at", start)
    .lt("watched_at", end);

  if (!theirs || theirs.length === 0) return null;

  const byUser = new Map<string, { count: number; example: string | null }>();
  for (const row of theirs) {
    const entry = byUser.get(row.user_id as string) ?? { count: 0, example: null };
    entry.count += 1;
    entry.example ??= (row.item_name as string) || null;
    byUser.set(row.user_id as string, entry);
  }

  const [topUserId, top] = [...byUser.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (!topUserId || top.count === 0) return null;

  const { data: person } = await supabase
    .from("users")
    .select("username, avatar_url")
    .eq("id", topUserId)
    .maybeSingle();

  if (!person?.username) return null;

  return {
    username: person.username as string,
    avatarUrl: (person.avatar_url as string) ?? null,
    count: top.count,
    exampleTitle: top.example,
  };
}
