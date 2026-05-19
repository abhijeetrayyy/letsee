import { createClient } from "@/utils/supabase/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_RESULTS = 12;

type ItemInfo = {
  id: string;
  mediaType: "movie" | "tv";
  genres: { id: number; name: string }[];
  voteAverage: number;
};

function buildWeightedGenrePreference(
  items: { genres?: string[] | null }[],
  ratings: { item_id: string; item_type: string; score: number }[],
): Record<string, number> {
  const ratingMap = new Map(ratings.map((r) => [`${r.item_type}:${r.item_id}`, r.score]));
  const weights: Record<string, { total: number; count: number }> = {};

  for (const item of items) {
    if (!Array.isArray(item.genres)) continue;
    const key = `${(item as any).item_type}:${(item as any).item_id}`;
    const ratingScore = ratingMap.get(key);
    const scoreWeight = ratingScore !== undefined ? (ratingScore - 5) / 5 : 0.2;

    for (const genre of item.genres) {
      if (!weights[genre]) weights[genre] = { total: 0, count: 0 };
      weights[genre].total += scoreWeight;
      weights[genre].count++;
    }
  }

  const result: Record<string, number> = {};
  for (const [genre, data] of Object.entries(weights)) {
    result[genre] = data.count > 0 ? data.total / data.count : 0;
  }
  return result;
}

function scoreItemForUser(
  genreNames: string[],
  genreNamesToIds: Record<string, number>,
  userPreference: Record<string, number>,
  currentItemGenres: number[],
): { score: number; matchReason: string } {
  let totalScore = 0;
  let matchedCount = 0;
  let bestMatch = "";

  for (const genreName of genreNames) {
    const weight = userPreference[genreName];
    if (weight !== undefined) {
      totalScore += weight;
      matchedCount++;
      if (!bestMatch || weight > (userPreference[bestMatch] ?? 0)) {
        bestMatch = genreName;
      }
    }
  }

  if (matchedCount === 0) return { score: 0, matchReason: "" };

  const avgScore = totalScore / matchedCount;
  const matchQuality = matchedCount / Math.max(genreNames.length, 1);
  const combined = (avgScore + matchQuality) / 2;

  const currentGenreNames = currentItemGenres
    .map((id) => Object.entries(genreNamesToIds).find(([, v]) => v === id)?.[0])
    .filter(Boolean);
  const sharedWithCurrent = currentGenreNames.filter((g) => genreNames.includes(g ?? "")).length;
  const currentBonus = currentGenreNames.length > 0 ? sharedWithCurrent / currentGenreNames.length : 0;

  return {
    score: Math.round((combined * 0.7 + currentBonus * 0.3) * 100),
    matchReason: bestMatch ? `Matches your taste in ${bestMatch}` : "Similar genres",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const mediaType = searchParams.get("mediaType") as "movie" | "tv" | null;

  if (!itemId || !mediaType) {
    return NextResponse.json({ error: "itemId and mediaType required" }, { status: 400 });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY missing" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const endpoint = mediaType === "movie" ? "movie" : "tv";
    const currentUrl = `${TMDB_BASE}/${endpoint}/${itemId}?api_key=${apiKey}&language=en-US&append_to_response=recommendations,similar`;
    const currentData = await serverFetchJson<{
      genres?: { id: number; name: string }[];
      recommendations?: { results?: any[] };
      similar?: { results?: any[] };
      vote_average?: number;
    }>(currentUrl);

    if (!currentData) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const currentGenres = (currentData.genres ?? []).map((g) => g.id);

    const [watchedRes, favRes, ratingsRes] = await Promise.all([
      supabase.from("watched_items").select("item_id, item_type, genres").eq("user_id", userId).neq("item_id", itemId),
      supabase.from("favorite_items").select("item_id, item_type, genres").eq("user_id", userId).neq("item_id", itemId),
      supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", userId),
    ]);

    const consumedIds = new Set<string>();
    for (const item of [...(watchedRes.data ?? []), ...(favRes.data ?? [])]) {
      consumedIds.add(`${item.item_type}:${item.item_id}`);
    }
    consumedIds.add(`${mediaType}:${itemId}`);

    const userPreference = buildWeightedGenrePreference(
      [...(watchedRes.data ?? []), ...(favRes.data ?? [])],
      ratingsRes.data ?? [],
    );

    const genreNamesToIds: Record<string, number> = {};
    for (const g of currentData.genres ?? []) {
      genreNamesToIds[g.name] = g.id;
    }

    const candidates = [
      ...(currentData.recommendations?.results ?? []),
      ...(currentData.similar?.results ?? []),
    ];

    const seen = new Set<string>();
    const scored: { item: any; score: number; reason: string }[] = [];

    for (const item of candidates) {
      const itemMediaType = item.media_type ?? mediaType;
      const key = `${itemMediaType}:${item.id}`;
      if (seen.has(key) || consumedIds.has(key)) continue;
      seen.add(key);

      const itemGenreNames = (item.genre_ids as number[] ?? [])
        .map((id: number) => Object.entries(genreNamesToIds).find(([, v]) => v === id)?.[0])
        .filter(Boolean);

      const { score, matchReason } = scoreItemForUser(
        itemGenreNames as string[],
        genreNamesToIds,
        userPreference,
        currentGenres,
      );

      if (score > 0) {
        scored.push({ item, score, reason: matchReason });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const results = scored.slice(0, MAX_RESULTS).map((s) => ({
      id: String(s.item.id),
      title: s.item.title ?? s.item.name ?? "Unknown",
      mediaType: s.item.media_type ?? mediaType,
      posterUrl: s.item.poster_path ? `https://image.tmdb.org/t/p/w500${s.item.poster_path}` : null,
      year: (s.item.release_date ?? s.item.first_air_date ?? "").substring(0, 4),
      voteAverage: s.item.vote_average ?? 0,
      matchScore: s.score,
      matchReason: s.reason,
    }));

    return NextResponse.json({ results, total: results.length });
  } catch (err) {
    console.error("Because you watched error:", err);
    return NextResponse.json({ error: "Failed to get recommendations" }, { status: 500 });
  }
}
