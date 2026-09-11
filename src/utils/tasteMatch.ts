/**
 * Taste overlap — the evidence, and the sentence built from it.
 *
 * ── What changed in 093 ────────────────────────────────────────────────────
 * The two functions this module used to call, `taste_compatibility` and
 * `taste_matches`, each began by rebuilding the entire community from scratch:
 * a `count(DISTINCT user_id)` and a `GROUP BY item_id` over
 * `user_title_affinity`, which is itself a three-way UNION ALL over the whole
 * of `user_media_status`, `favorite_items` and `user_ratings`. Opening one
 * profile scanned three tables end to end to produce one number about two
 * people, and the people directory did it once per viewer against everybody.
 *
 * 093 splits that by how often each part actually changes — corpus and rarity
 * nightly, per-user norms on write, the pair cached on first read — so what
 * this module calls now is:
 *
 *   taste_pair_get(other)   one indexed row in the normal case
 *   my_taste_neighbours()   twenty rows, precomputed last night
 *
 * Both are pinned to `auth.uid()` inside the function rather than taking a
 * caller-supplied uuid. That is not decoration: 074 exists because the
 * predecessor took two uuids with no visibility test, so anyone holding the
 * anon key could read titles out of a private library. There is no parameter
 * here to point at a stranger.
 *
 * ── Typed against supabase-js, not against the server client ───────────────
 * Same reasoning as `@/utils/takes`: nothing in this file is server-only, so
 * deriving the type from `@/utils/supabase/server` would have meant the
 * browser could not call any of it and every read had to go through a Vercel
 * function whose whole contribution was holding a client of a different type.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SharedTitle = {
  itemId: string;
  itemType: "movie" | "tv";
  name: string;
  /** IDF weight — higher means rarer in the community. */
  rarity: number;
  /** How many people here have engaged with this title. */
  viewers: number;
  /** Everyone with any tracked title, for "2 of only 12" phrasing. */
  totalUsers: number;
};

export type TasteMatch = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  about: string | null;
  /**
   * Ranking signal only — DO NOT render as a percentage. It is a cosine over
   * rarity-weighted libraries, so a 250-title user against a 4-title user
   * scores ~0.01 even when the overlap is meaningful. Show `sharedTitles`
   * instead; the evidence is the product, the number is noise.
   */
  score: number;
  sharedCount: number;
  sharedTitles: SharedTitle[];
  icebreaker: string;
};

export type PairwiseCompatibility = {
  score: number;
  sharedCount: number;
  sharedTitles: SharedTitle[];
  icebreaker: string;
};

const EMPTY_PAIR: PairwiseCompatibility = {
  score: 0,
  sharedCount: 0,
  sharedTitles: [],
  icebreaker: "",
};

export function normalizeTitles(raw: unknown): SharedTitle[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      itemId: String(t.itemId ?? ""),
      itemType: t.itemType === "tv" ? ("tv" as const) : ("movie" as const),
      name: String(t.name ?? "").trim(),
      rarity: Number(t.rarity ?? 0),
      viewers: Number(t.viewers ?? 0),
      totalUsers: Number(t.totalUsers ?? 0),
    }))
    .filter((t) => t.name.length > 0);
}

/**
 * The sentence that gives someone a reason to say hello.
 *
 * Rarity is the whole point: "you both like Drama" is not a reason to talk to
 * a stranger, but "only the two of us here have seen this" is.
 *
 * Returns an empty string when there is no shared title to name. An earlier
 * version fell through to "You have similar taste — say hi!", which is a
 * sentence with no evidence in it, printed underneath a panel whose entire
 * argument is that evidence beats assertion. Nothing is better than that.
 */
export function buildIcebreaker(sharedTitles: SharedTitle[], sharedCount: number): string {
  const top = sharedTitles[0];
  if (!top) return "";

  const ratio = top.totalUsers > 0 ? top.viewers / top.totalUsers : 1;
  const isRare = top.viewers <= 3 || ratio <= 0.15;

  if (top.viewers === 2) return `Only the two of you here have seen ${top.name}.`;
  if (isRare) return `You're 2 of only ${top.viewers} people here who've seen ${top.name}.`;
  if (sharedCount >= 5) {
    return `You've both seen ${sharedCount} of the same titles, including ${top.name}.`;
  }
  return `You both watched ${top.name}.`;
}

/**
 * Taste overlap between the caller and one other person.
 *
 * The normal case is a single indexed row. On a first look — or on a cached
 * row that is both out of date and more than a week old — the function
 * computes it once, from the two libraries alone, and stores it.
 *
 * Zero rows is the answer for a profile the caller may not see, for a block in
 * either direction, and for two people with nothing in common. That is
 * deliberate and unchanged from 074: the caller cannot tell a refusal from an
 * absence, so the panel cannot be used to probe.
 */
export async function getPairwiseCompatibility(
  supabase: SupabaseClient,
  otherUserId: string,
): Promise<PairwiseCompatibility> {
  const { data, error } = await supabase.rpc("taste_pair_get", { p_other: otherUserId });

  if (error) {
    console.error("getPairwiseCompatibility:", error);
    return EMPTY_PAIR;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return EMPTY_PAIR;

  const sharedTitles = normalizeTitles(row.top_shared);
  const sharedCount = Number(row.shared_count ?? 0);
  return {
    score: Number(row.score ?? 0),
    sharedCount,
    sharedTitles,
    icebreaker: buildIcebreaker(sharedTitles, sharedCount),
  };
}

/**
 * People whose taste resembles the caller's, ranked by rarity-weighted title
 * overlap.
 *
 * Read from `taste_neighbours`, which the nightly job fills in — and only for
 * users whose library actually moved since the last run. Nobody is waiting on
 * this: a directory of people like you is not less true for having been
 * computed last night, and computing it per request meant scoring one person
 * against the whole database on a page load.
 */
export async function getTasteMatches(
  supabase: SupabaseClient,
  limit = 10,
): Promise<TasteMatch[]> {
  const { data, error } = await supabase.rpc("my_taste_neighbours", { p_limit: limit });

  if (error) {
    console.error("getTasteMatches:", error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const sharedTitles = normalizeTitles(row.top_shared);
    const sharedCount = Number(row.shared_count ?? 0);
    return {
      userId: String(row.user_id),
      username: String(row.username ?? "user"),
      avatarUrl: (row.avatar_url as string) ?? null,
      about: (row.about as string) ?? null,
      score: Number(row.score ?? 0),
      sharedCount,
      sharedTitles,
      icebreaker: buildIcebreaker(sharedTitles, sharedCount),
    };
  });
}
