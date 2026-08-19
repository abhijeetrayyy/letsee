/**
 * A year, counted.
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
 * watched_items.watched_at is the diary date. For a Letterboxd import it's the
 * real date they watched it; for something marked here it defaults to the
 * moment they marked it. That's the best available answer and it's honest for
 * both cases, so it's what the year is sliced on.
 */

import type { createClient } from "@/utils/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

export type YearInReview = {
  year: number;
  username: string;
  avatarUrl: string | null;
  /** Films and shows marked watched, counted separately — never summed into "titles". */
  movies: number;
  shows: number;
  episodes: number;
  ratingsGiven: number;
  reviewsWritten: number;
  /** Highest rated, for the poster grid. */
  topRated: YearFilm[];
  topGenres: { genre: string; count: number }[];
  busiestMonth: { month: string; count: number } | null;
  /** The share hook — the one line no other app can produce. */
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

export async function buildYearInReview(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  avatarUrl: string | null,
  year: number,
): Promise<YearInReview> {
  const start = `${year}-01-01T00:00:00.000Z`;
  const end = `${year + 1}-01-01T00:00:00.000Z`;

  const [watchedRes, episodesRes, ratingsRes, notesRes] = await Promise.all([
    supabase
      .from("watched_items")
      // No `review_text`: 076 revoked SELECT on it, and this only ever needed
      // to know WHICH titles carry a note, not what any of them says. That
      // count comes from my_diary_notes() below.
      .select("item_id, item_type, item_name, image_url, genres, watched_at")
      .eq("user_id", userId)
      .eq("is_watched", true)
      .gte("watched_at", start)
      .lt("watched_at", end),
    supabase
      .from("watched_episodes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("season_number", 0)
      .gte("watched_at", start)
      .lt("watched_at", end),
    supabase.from("user_ratings").select("item_id, score").eq("user_id", userId),
    supabase.rpc("my_diary_notes"),
  ]);

  const watched = watchedRes.data ?? [];
  const scoreByItem = new Map(
    (ratingsRes.data ?? []).map((r) => [String(r.item_id), Number(r.score)]),
  );

  const movies = watched.filter((w) => w.item_type === "movie").length;
  const shows = watched.filter((w) => w.item_type === "tv").length;
  // Keyed `type:id`, so a film and a series sharing a TMDB id are not conflated
  // — the same reason every other map in this codebase carries the type.
  const noteKeys = new Set(
    ((notesRes.data ?? []) as { item_id: string; item_type: string }[]).map(
      (n) => `${n.item_type}:${n.item_id}`,
    ),
  );
  const reviewsWritten = watched.filter((w) =>
    noteKeys.has(`${w.item_type}:${w.item_id}`),
  ).length;

  // Ratings counted for *this year's* films, not all-time — the card is about
  // the year, and an all-time total sitting among year figures reads as a lie.
  const ratingsGiven = watched.filter((w) => scoreByItem.has(String(w.item_id))).length;

  const topRated: YearFilm[] = watched
    .map((w) => ({
      itemId: String(w.item_id),
      itemType: (w.item_type === "tv" ? "tv" : "movie") as "movie" | "tv",
      itemName: w.item_name ?? "",
      imageUrl: w.image_url ?? null,
      score: scoreByItem.get(String(w.item_id)) ?? null,
    }))
    .filter((f) => f.score !== null && f.itemName)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 4);

  const genreCounts = new Map<string, number>();
  for (const w of watched) {
    if (!Array.isArray(w.genres)) continue;
    for (const g of w.genres) {
      if (typeof g === "string" && g) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }
  const topGenres = [...genreCounts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const monthCounts = new Array(12).fill(0);
  for (const w of watched) {
    if (!w.watched_at) continue;
    const month = new Date(w.watched_at as string).getUTCMonth();
    if (month >= 0 && month < 12) monthCounts[month] += 1;
  }
  const peak = monthCounts.reduce((best, n, i) => (n > monthCounts[best] ? i : best), 0);
  const busiestMonth =
    monthCounts[peak] > 0 ? { month: MONTHS[peak], count: monthCounts[peak] } : null;

  const sharedWith = await findSharedWith(
    supabase,
    userId,
    watched.map((w) => String(w.item_id)),
    start,
    end,
  );

  return {
    year,
    username,
    avatarUrl,
    movies,
    shows,
    episodes: episodesRes.count ?? 0,
    ratingsGiven,
    reviewsWritten,
    topRated,
    topGenres,
    busiestMonth,
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
