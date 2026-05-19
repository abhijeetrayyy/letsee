import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_SIMILAR_USERS = 20;
const MAX_RECOMMENDATIONS = 15;
const MIN_RATING_SCORE = 7;

type GenreVector = Record<string, number>;

function cosineSimilarity(a: GenreVector, b: GenreVector): number {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const key of allKeys) {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function buildGenreVector(items: { genres?: string[] | null }[]): GenreVector {
  const vec: GenreVector = {};
  for (const item of items) {
    if (Array.isArray(item.genres)) {
      for (const g of item.genres) {
        vec[g] = (vec[g] ?? 0) + 1;
      }
    }
  }
  if (Object.keys(vec).length === 0) return {};
  const mag = Math.sqrt(Object.values(vec).reduce((s, v) => s + v * v, 0));
  for (const key of Object.keys(vec)) {
    vec[key] /= mag;
  }
  return vec;
}

function topGenresFromVector(vec: GenreVector, count: number): string[] {
  return Object.entries(vec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([g]) => g);
}

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = auth.user.id;

  try {
    const [userWatched, userFavs] = await Promise.all([
      supabase.from("watched_items").select("item_id, item_type, genres").eq("user_id", userId),
      supabase.from("favorite_items").select("item_id, item_type, genres").eq("user_id", userId),
    ]);

    const consumedIds = new Set<string>();
    for (const item of [...(userWatched.data ?? []), ...(userFavs.data ?? [])]) {
      consumedIds.add(`${item.item_type}:${item.item_id}`);
    }

    const userVector = buildGenreVector([...(userWatched.data ?? []), ...(userFavs.data ?? [])]);
    if (Object.keys(userVector).length === 0) {
      return NextResponse.json({ recommendations: [], similarUsers: [], note: "Watch or favorite items to get collaborative recommendations." });
    }

    const userTopGenres = topGenresFromVector(userVector, 4);

    const otherUserIds = await supabase
      .from("watched_items")
      .select("user_id")
      .neq("user_id", userId)
      .limit(500);

    if (!otherUserIds.data?.length) {
      return NextResponse.json({ recommendations: [], similarUsers: [], note: "Not enough user data for collaborative filtering yet." });
    }

    const userIds = [...new Set(otherUserIds.data.map((r) => r.user_id))].slice(0, 200);

    const batchSize = 50;
    const similarities: { userId: string; similarity: number }[] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const [batchWatched, batchFavs] = await Promise.all([
        supabase.from("watched_items").select("user_id, genres").in("user_id", batch),
        supabase.from("favorite_items").select("user_id, genres").in("user_id", batch),
      ]);

      const userItemsMap = new Map<string, { genres?: string[] | null }[]>();
      for (const item of [...(batchWatched.data ?? []), ...(batchFavs.data ?? [])]) {
        if (!userItemsMap.has(item.user_id)) userItemsMap.set(item.user_id, []);
        userItemsMap.get(item.user_id)!.push(item);
      }

      for (const uid of batch) {
        const items = userItemsMap.get(uid) ?? [];
        const otherVec = buildGenreVector(items);
        const sim = cosineSimilarity(userVector, otherVec);
        if (sim > 0.15) {
          similarities.push({ userId: uid, similarity: sim });
        }
      }
    }

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topUsers = similarities.slice(0, MAX_SIMILAR_USERS);

    if (topUsers.length === 0) {
      return NextResponse.json({ recommendations: [], similarUsers: [], userTopGenres, note: "No similar users found yet." });
    }

    const topUserIds = topUsers.map((u) => u.userId);

    const [ratingsResult, watchedResult, profilesResult] = await Promise.all([
      supabase
        .from("user_ratings")
        .select("user_id, item_id, item_type, score, created_at")
        .in("user_id", topUserIds)
        .gte("score", MIN_RATING_SCORE),
      supabase
        .from("watched_items")
        .select("user_id, item_id, item_name, item_type, image_url, genres")
        .in("user_id", topUserIds),
      supabase
        .from("profiles")
        .select("id, avatar_url, display_name")
        .in("id", topUserIds),
    ]);

    // Build a map of userId -> profile
    const profileMap = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));

    // Build similar user info with top genres
    const userItemsMap = new Map<string, { genres?: string[] | null }[]>();
    for (const item of watchedResult.data ?? []) {
      if (!userItemsMap.has(item.user_id)) userItemsMap.set(item.user_id, []);
      userItemsMap.get(item.user_id)!.push(item);
    }

    // Merge similarity info with user top genres
    const detailedUsers = topUsers.map((u) => {
      const items = userItemsMap.get(u.userId) ?? [];
      const vec = buildGenreVector(items);
      const prof = profileMap.get(u.userId);
      return {
        similarity: Math.round(u.similarity * 100),
        avatarUrl: prof?.avatar_url ?? null,
        displayName: prof?.display_name ?? null,
        topGenres: topGenresFromVector(vec, 3),
        matchedItemCount: items.filter((i) => Array.isArray(i.genres) && i.genres.length > 0).length,
      };
    });

    // Aggregate item scores with genres and recency
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const itemScores = new Map<string, {
      score: number; count: number; name: string;
      imageUrl: string | null; itemType: string;
      genres: string[]; recentCount: number;
    }>();

    for (const rating of ratingsResult.data ?? []) {
      const key = `${rating.item_type}:${rating.item_id}`;
      if (consumedIds.has(key)) continue;

      if (!itemScores.has(key)) {
        const watched = (watchedResult.data ?? []).find(
          (w) => w.item_id === rating.item_id && w.item_type === rating.item_type
        );
        itemScores.set(key, {
          score: 0, count: 0,
          name: watched?.item_name ?? rating.item_id,
          imageUrl: watched?.image_url ?? null,
          itemType: rating.item_type,
          genres: (watched?.genres ?? []) as string[],
          recentCount: 0,
        });
      }
      const entry = itemScores.get(key)!;
      entry.score += rating.score;
      entry.count++;
      if (rating.created_at && rating.created_at >= ninetyDaysAgo) {
        entry.recentCount++;
      }
    }

    // Helper: find match tags — intersection of item genres with user's top genres
    function computeMatchTags(itemGenres: string[]): string[] {
      const matches: string[] = [];
      for (const g of itemGenres) {
        if (userTopGenres.some((utg) => utg.toLowerCase() === g.toLowerCase())) {
          matches.push(g);
        }
      }
      return matches.slice(0, 2);
    }

    const recommendations = [...itemScores.entries()]
      .map(([key, entry]) => {
        // Recency boost: recent ratings add 10% score bonus
        const recentRatio = entry.count > 0 ? entry.recentCount / entry.count : 0;
        const recencyBonus = 1 + recentRatio * 0.15;
        const adjustedScore = (entry.score / entry.count) * recencyBonus;

        return {
          itemId: key.split(":")[1],
          itemType: entry.itemType,
          name: entry.name,
          imageUrl: entry.imageUrl,
          avgScore: Math.round((entry.score / entry.count) * 10) / 10,
          adjustedScore: Math.round(adjustedScore * 10) / 10,
          userCount: entry.count,
          recentUserCount: entry.recentCount,
          matchTags: computeMatchTags(entry.genres),
          isRecent: entry.recentCount > 0,
        };
      })
      .sort((a, b) => {
        if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
        return b.userCount - a.userCount;
      })
      .slice(0, MAX_RECOMMENDATIONS);

    const note = recommendations.length > 0
      ? undefined
      : "Found similar users, but no new recommendations to surface.";

    return NextResponse.json({ recommendations, similarUsers: detailedUsers, userTopGenres, note });
  } catch (err) {
    console.error("Collaborative filtering error:", err);
    return NextResponse.json({ error: "Failed to compute collaborative recommendations." }, { status: 500 });
  }
}
