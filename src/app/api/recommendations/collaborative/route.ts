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
      return NextResponse.json({ recommendations: [], note: "Watch or favorite items to get collaborative recommendations." });
    }

    const otherUserIds = await supabase
      .from("watched_items")
      .select("user_id")
      .neq("user_id", userId)
      .limit(500);

    if (!otherUserIds.data?.length) {
      return NextResponse.json({ recommendations: [], note: "Not enough user data for collaborative filtering yet." });
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
      return NextResponse.json({ recommendations: [], note: "No similar users found yet." });
    }

    const topUserIds = topUsers.map((u) => u.userId);

    const { data: similarRatings } = await supabase
      .from("user_ratings")
      .select("user_id, item_id, item_type, score")
      .in("user_id", topUserIds)
      .gte("score", MIN_RATING_SCORE);

    const { data: similarWatched } = await supabase
      .from("watched_items")
      .select("user_id, item_id, item_name, item_type, image_url")
      .in("user_id", topUserIds);

    const itemScores = new Map<string, { score: number; count: number; name: string; imageUrl: string | null; itemType: string }>();
    for (const rating of similarRatings ?? []) {
      const key = `${rating.item_type}:${rating.item_id}`;
      if (consumedIds.has(key)) continue;
      if (!itemScores.has(key)) {
        const watched = (similarWatched ?? []).find(
          (w) => w.item_id === rating.item_id && w.item_type === rating.item_type
        );
        itemScores.set(key, { score: 0, count: 0, name: watched?.item_name ?? rating.item_id, imageUrl: watched?.image_url ?? null, itemType: rating.item_type });
      }
      const entry = itemScores.get(key)!;
      entry.score += rating.score;
      entry.count++;
    }

    const recommendations = [...itemScores.entries()]
      .map(([key, entry]) => ({
        itemId: key.split(":")[1],
        itemType: entry.itemType,
        name: entry.name,
        imageUrl: entry.imageUrl,
        avgScore: Math.round((entry.score / entry.count) * 10) / 10,
        userCount: entry.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, MAX_RECOMMENDATIONS);

    const note = recommendations.length > 0
      ? undefined
      : "Found similar users, but no new recommendations to surface.";
    const sourceUsers = topUsers.slice(0, 5).map((u) => ({
      userId: u.userId,
      similarity: Math.round(u.similarity * 100),
    }));

    return NextResponse.json({ recommendations, sourceUsers, note });
  } catch (err) {
    console.error("Collaborative filtering error:", err);
    return NextResponse.json({ error: "Failed to compute collaborative recommendations." }, { status: 500 });
  }
}
