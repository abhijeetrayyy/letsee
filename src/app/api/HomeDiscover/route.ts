import { createClient } from "@/utils/supabase/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { buildGenreVector, cosineSimilarity } from "@/utils/genreVector";

interface User {
  id: string;
  username: string;
  about?: string;
  avatar_url?: string | null;
  watched_count: number;
  favorites_count: number;
  watchlist_count: number;
  followsYou: boolean;
}

const POOL_SIZE = 40;
const RESULT_LIMIT = 12;

export async function GET(request: Request) {
  const supabase = await createClient();
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonError("User isn't logged in", 401);
    }
    const viewerId = user.id;

    const selectWithAvatar =
      "id, username, about, avatar_url, user_cout_stats (watched_count, favorites_count, watchlist_count)";
    const selectWithoutAvatar =
      "id, username, about, user_cout_stats (watched_count, favorites_count, watchlist_count)";

    let result = await supabase
      .from("users")
      .select(selectWithAvatar)
      .eq("visibility", "public")
      .not("username", "is", null)
      .neq("username", "")
      .neq("id", viewerId)
      .order("updated_at", { ascending: false })
      .limit(POOL_SIZE);

    if (result.error && (result.error.message?.includes("avatar_url") || result.error.code === "42703")) {
      const fallback = await supabase
        .from("users")
        .select(selectWithoutAvatar)
        .eq("visibility", "public")
        .not("username", "is", null)
        .neq("username", "")
        .neq("id", viewerId)
        .order("updated_at", { ascending: false })
        .limit(POOL_SIZE);
      result = { data: fallback.data, error: fallback.error } as typeof result;
    }

    if (result.error || !result.data) {
      console.error("Error fetching users:", result.error);
      return jsonError("Error fetching users", 500);
    }

    let pool = result.data as Record<string, unknown>[];
    const poolIds = pool.map((row) => String(row.id));

    const [{ data: followedRows }, { data: followsMeRows }, { data: blockedRows }] = await Promise.all([
      supabase.from("user_connections").select("followed_id").eq("follower_id", viewerId).in("followed_id", poolIds),
      supabase.from("user_connections").select("follower_id").eq("followed_id", viewerId).in("follower_id", poolIds),
      supabase.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
    ]);

    const alreadyFollowed = new Set((followedRows ?? []).map((r) => r.followed_id));
    const followsYouSet = new Set((followsMeRows ?? []).map((r) => r.follower_id));
    const blockedIds = new Set<string>();
    for (const b of blockedRows ?? []) {
      if (b.blocker_id === viewerId) blockedIds.add(b.blocked_id);
      if (b.blocked_id === viewerId) blockedIds.add(b.blocker_id);
    }
    pool = pool.filter((row) => !alreadyFollowed.has(String(row.id)) && !blockedIds.has(String(row.id)));

    // Re-rank by shared taste when the viewer has watched/favorited enough to have a genre vector.
    // New users with nothing watched yet fall back to the pure-recency order already applied above.
    if (pool.length > 0) {
      const [{ data: viewerWatched }, { data: viewerFavs }] = await Promise.all([
        supabase.from("watched_items").select("genres").eq("user_id", viewerId),
        supabase.from("favorite_items").select("genres").eq("user_id", viewerId),
      ]);
      const viewerVector = buildGenreVector([...(viewerWatched ?? []), ...(viewerFavs ?? [])]);

      if (Object.keys(viewerVector).length > 0) {
        const remainingIds = pool.map((row) => String(row.id));
        const [{ data: poolWatched }, { data: poolFavs }] = await Promise.all([
          supabase.from("watched_items").select("user_id, genres").in("user_id", remainingIds),
          supabase.from("favorite_items").select("user_id, genres").in("user_id", remainingIds),
        ]);
        const itemsByUser = new Map<string, { genres?: string[] | null }[]>();
        for (const item of [...(poolWatched ?? []), ...(poolFavs ?? [])]) {
          if (!itemsByUser.has(item.user_id)) itemsByUser.set(item.user_id, []);
          itemsByUser.get(item.user_id)!.push(item);
        }
        const similarityById = new Map<string, number>();
        for (const row of pool) {
          const id = String(row.id);
          similarityById.set(id, cosineSimilarity(viewerVector, buildGenreVector(itemsByUser.get(id) ?? [])));
        }
        pool = [...pool].sort(
          (a, b) => (similarityById.get(String(b.id)) ?? 0) - (similarityById.get(String(a.id)) ?? 0)
        );
      }
    }

    const users: User[] = pool.slice(0, RESULT_LIMIT).map((row) => {
      const stats = (row.user_cout_stats as Record<string, number>) || {};
      const avatarUrl = "avatar_url" in row && row.avatar_url != null ? String(row.avatar_url) : null;
      const id = String(row.id);
      return {
        id,
        username: String(row.username ?? ""),
        about: row.about != null ? String(row.about) : "",
        avatar_url: avatarUrl,
        watched_count: Number(stats.watched_count) || 0,
        favorites_count: Number(stats.favorites_count) || 0,
        watchlist_count: Number(stats.watchlist_count) || 0,
        followsYou: followsYouSet.has(id),
      };
    });

    return jsonSuccess({ users });
  } catch (error) {
    console.error("API Error:", error);
    return jsonError("Internal Server Error", 500);
  }
}
