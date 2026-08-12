import type { createClient } from "@/utils/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type SharedTitle = {
  itemId: string;
  itemType: "movie" | "tv";
  name: string;
  /** IDF weight — higher means rarer in the community. */
  rarity: number;
  /** How many users have engaged with this title. */
  viewers: number;
  /** Total users with any tracked title, for "2 of only 12" phrasing. */
  totalUsers: number;
};

export type TasteMatch = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  about: string | null;
  /**
   * Ranking signal only — DO NOT render as a percentage. It's a cosine over
   * rarity-weighted libraries, so a 250-title user vs a 4-title user scores
   * ~0.01 even when the overlap is meaningful. Show `sharedTitles` instead;
   * the evidence is the product, the number is noise.
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

function normalizeTitles(raw: unknown): SharedTitle[] {
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
 */
export function buildIcebreaker(
  sharedTitles: SharedTitle[],
  sharedCount: number,
  fallbackGenre?: string | null,
): string {
  const top = sharedTitles[0];

  if (top) {
    const ratio = top.totalUsers > 0 ? top.viewers / top.totalUsers : 1;
    const isRare = top.viewers <= 3 || ratio <= 0.15;

    if (top.viewers === 2) {
      return `Only the two of you here have seen ${top.name}.`;
    }
    if (isRare) {
      return `You're 2 of only ${top.viewers} people here who've seen ${top.name}.`;
    }
    if (sharedCount >= 5) {
      return `You've both seen ${sharedCount} of the same titles, including ${top.name}.`;
    }
    return `You both watched ${top.name}.`;
  }

  if (fallbackGenre) return `You're both into ${fallbackGenre}.`;
  return "You have similar taste in movies & TV — say hi!";
}

/**
 * People who share your taste, ranked by rarity-weighted title overlap.
 * Excludes blocked users and non-public profiles (enforced inside the RPC).
 */
export async function getTasteMatches(
  supabase: SupabaseClient,
  userId: string,
  limit = 10,
): Promise<TasteMatch[]> {
  const { data, error } = await supabase.rpc("taste_matches", {
    p_user: userId,
    p_limit: limit,
  });

  if (error) {
    console.error("getTasteMatches:", error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
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

/** Taste overlap between two specific people (profile page). */
export async function getPairwiseCompatibility(
  supabase: SupabaseClient,
  userA: string,
  userB: string,
): Promise<PairwiseCompatibility> {
  const empty: PairwiseCompatibility = {
    score: 0,
    sharedCount: 0,
    sharedTitles: [],
    icebreaker: buildIcebreaker([], 0),
  };

  const { data, error } = await supabase.rpc("taste_compatibility", {
    p_a: userA,
    p_b: userB,
  });

  if (error) {
    console.error("getPairwiseCompatibility:", error);
    return empty;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return empty;

  const sharedTitles = normalizeTitles(row.top_shared);
  const sharedCount = Number(row.shared_count ?? 0);
  return {
    score: Number(row.score ?? 0),
    sharedCount,
    sharedTitles,
    icebreaker: buildIcebreaker(sharedTitles, sharedCount),
  };
}
