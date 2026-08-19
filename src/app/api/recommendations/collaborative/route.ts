import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { buildGenreVector, topGenresFromVector } from "@/utils/genreVector";
import { getTasteMatches, buildIcebreaker } from "@/utils/tasteMatch";

export const dynamic = "force-dynamic";

const MAX_SIMILAR_USERS = 20;
const MAX_RECOMMENDATIONS = 15;
const MIN_RATING_SCORE = 7;

export async function GET() {
  const supabase = await createClient();
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError("Not authenticated", 401);
  }

  try {
    const [userWatched, userFavs] = await Promise.all([
      supabase.from("watched_items").select("item_id, item_type, genres, item_name").eq("user_id", userId),
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

    // Neighbours come from the rarity-weighted title-overlap engine (one
    // indexed query in Postgres) rather than pulling every user's library into
    // Node and running genre cosine over it.
    const matches = await getTasteMatches(supabase, userId, MAX_SIMILAR_USERS);

    if (matches.length === 0) {
      return NextResponse.json({ recommendations: [], similarUsers: [], userTopGenres, note: "No similar users found yet." });
    }

    const topUserIds = matches.map((m) => m.userId);

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

    // Merge match evidence with each user's top genres (genres are secondary
    // colour now — the shared-title evidence is the headline).
    const detailedUsers = matches
      .map((m) => {
        const items = userItemsMap.get(m.userId) ?? [];
        const matchTopGenres = topGenresFromVector(buildGenreVector(items), 3);
        const prof = profileMap.get(m.userId);
        const top = m.sharedTitles[0];
        return {
          user_id: m.userId,
          username: m.username ?? prof?.username ?? null,
          avatar_url: m.avatarUrl ?? prof?.avatar_url ?? null,
          topGenres: matchTopGenres,
          sharedCount: m.sharedCount,
          sharedTitles: m.sharedTitles,
          matchedItemCount: items.filter((i) => Array.isArray(i.genres) && i.genres.length > 0).length,
          // Falls back to a shared genre when there's no shared title at all.
          icebreaker: top
            ? m.icebreaker
            : buildIcebreaker(
                [],
                0,
                userTopGenres.find((g) =>
                  matchTopGenres.some((mg) => mg.toLowerCase() === g.toLowerCase()),
                ),
              ),
          sharedItem: top
            ? { itemId: top.itemId, itemType: top.itemType, name: top.name }
            : null,
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
