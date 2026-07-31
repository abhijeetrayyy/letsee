import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { buildGenreVector, cosineSimilarity, topGenresFromVector } from "@/utils/genreVector";

export const dynamic = "force-dynamic";

const MAX_SIMILAR_USERS = 20;
const MAX_RECOMMENDATIONS = 15;
const MIN_RATING_SCORE = 7;

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return jsonError("Not authenticated", 401);
  }

  const userId = auth.user.id;

  try {
    const [userWatched, userFavs, viewerRatings] = await Promise.all([
      supabase.from("watched_items").select("item_id, item_type, genres, item_name").eq("user_id", userId),
      supabase.from("favorite_items").select("item_id, item_type, genres").eq("user_id", userId),
      supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", userId).gte("score", MIN_RATING_SCORE),
    ]);

    const consumedIds = new Set<string>();
    for (const item of [...(userWatched.data ?? []), ...(userFavs.data ?? [])]) {
      consumedIds.add(`${item.item_type}:${item.item_id}`);
    }

    const viewerItemNames = new Map<string, string>();
    for (const item of userWatched.data ?? []) {
      viewerItemNames.set(`${item.item_type}:${item.item_id}`, item.item_name);
    }
    const viewerTopRatedKeys = new Set(
      (viewerRatings.data ?? []).map((r) => `${r.item_type}:${r.item_id}`)
    );

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
        .from("users")
        .select("id, username, avatar_url")
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

    // Per-matched-user top-rated items (>= MIN_RATING_SCORE), keyed by user_id -> Map(itemKey -> {name, score})
    const matchTopRatedByUser = new Map<string, Map<string, { name: string; score: number }>>();
    for (const rating of ratingsResult.data ?? []) {
      const key = `${rating.item_type}:${rating.item_id}`;
      const watched = (watchedResult.data ?? []).find(
        (w) => w.item_id === rating.item_id && w.item_type === rating.item_type && w.user_id === rating.user_id
      );
      if (!matchTopRatedByUser.has(rating.user_id)) matchTopRatedByUser.set(rating.user_id, new Map());
      matchTopRatedByUser.get(rating.user_id)!.set(key, {
        name: watched?.item_name ?? rating.item_id,
        score: rating.score,
      });
    }

    function buildIcebreaker(matchUserId: string, matchTopGenres: string[]): {
      icebreaker: string;
      sharedItem: { itemId: string; itemType: "movie" | "tv"; name: string } | null;
    } {
      const matchRated = matchTopRatedByUser.get(matchUserId);
      if (matchRated) {
        let best: { key: string; name: string; combined: number } | null = null;
        for (const key of viewerTopRatedKeys) {
          const matchEntry = matchRated.get(key);
          if (!matchEntry) continue;
          if (!best || matchEntry.score > best.combined) {
            best = { key, name: matchEntry.name, combined: matchEntry.score };
          }
        }
        if (best) {
          const [itemType, itemId] = best.key.split(":");
          const name = viewerItemNames.get(best.key) || best.name;
          return {
            icebreaker: `You both loved ${name}`,
            sharedItem: { itemId, itemType: itemType === "tv" ? "tv" : "movie", name },
          };
        }
      }

      const sharedGenre = userTopGenres.find((g) =>
        matchTopGenres.some((mg) => mg.toLowerCase() === g.toLowerCase())
      );
      if (sharedGenre) {
        return { icebreaker: `You're both into ${sharedGenre}`, sharedItem: null };
      }

      return { icebreaker: "You have similar taste in movies & TV — say hi!", sharedItem: null };
    }

    // Merge similarity info with user top genres
    const detailedUsers = topUsers
      .map((u) => {
        const items = userItemsMap.get(u.userId) ?? [];
        const vec = buildGenreVector(items);
        const prof = profileMap.get(u.userId);
        const matchTopGenres = topGenresFromVector(vec, 3);
        const { icebreaker, sharedItem } = buildIcebreaker(u.userId, matchTopGenres);
        return {
          user_id: u.userId,
          username: prof?.username ?? null,
          avatar_url: prof?.avatar_url ?? null,
          matchScore: u.similarity,
          topGenres: matchTopGenres,
          matchedItemCount: items.filter((i) => Array.isArray(i.genres) && i.genres.length > 0).length,
          icebreaker,
          sharedItem,
        };
      })
      .filter((u) => u.username);

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
    return jsonError("Failed to compute collaborative recommendations.", 500);
  }
}
