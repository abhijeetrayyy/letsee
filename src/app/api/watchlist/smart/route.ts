import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SmartItem = {
  id: number;
  itemId: string;
  itemName: string;
  itemType: string;
  imageUrl: string | null;
  genres: string[] | null;
  addedAt: string;
  predictedRating: number;
  reason: string;
};

type GenreProfile = Record<string, { weight: number; sampleCount: number }>;

function buildGenreProfile(
  ratings: { item_id: string; item_type: string; score: number }[],
  watched: { item_id: string; item_type: string; genres?: string[] | null }[],
): GenreProfile {
  const watchedGenres = new Map<string, string[]>();
  for (const w of watched) {
    if (Array.isArray(w.genres)) {
      watchedGenres.set(`${w.item_type}:${w.item_id}`, w.genres);
    }
  }

  const profile: GenreProfile = {};

  for (const r of ratings) {
    const key = `${r.item_type}:${r.item_id}`;
    const genres = watchedGenres.get(key);
    if (!genres) continue;

    const normalizedScore = (r.score - 5.5) / 4.5;
    for (const genre of genres) {
      if (!profile[genre]) profile[genre] = { weight: 0, sampleCount: 0 };
      profile[genre].weight += normalizedScore;
      profile[genre].sampleCount++;
    }
  }

  for (const key of Object.keys(profile)) {
    if (profile[key].sampleCount > 0) {
      profile[key].weight /= profile[key].sampleCount;
    }
  }

  return profile;
}

function predictRating(
  itemGenres: string[] | null,
  profile: GenreProfile,
): { rating: number; reason: string } {
  if (!itemGenres || itemGenres.length === 0) {
    return { rating: 5.5, reason: "No genre data" };
  }

  const scored = itemGenres.map((g) => {
    const entry = profile[g];
    if (!entry) return { genre: g, score: 0, known: false };
    return { genre: g, score: entry.weight, known: true };
  });

  const known = scored.filter((s) => s.known);
  if (known.length === 0) {
    return { rating: 5.5, reason: "New genres" };
  }

  const avgScore = known.reduce((s, x) => s + x.score, 0) / known.length;
  const predicted = Math.round((5.5 + avgScore * 2) * 10) / 10;
  const clamped = Math.max(1, Math.min(10, predicted));

  const topGenre = known.sort((a, b) => b.score - a.score)[0];
  const reason = topGenre.score > 0.3
    ? `Strong match: ${topGenre.genre}`
    : topGenre.score < -0.3
      ? `Weak match: ${topGenre.genre}`
      : `Average match: ${topGenre.genre}`;

  return { rating: clamped, reason };
}

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = auth.user.id;

  try {
    const [watchlistResult, ratingsResult, watchedResult] = await Promise.all([
      supabase
        .from("user_watchlist")
        .select("id, item_id, item_name, item_type, image_url, genres, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_ratings")
        .select("item_id, item_type, score")
        .eq("user_id", userId),
      supabase
        .from("watched_items")
        .select("item_id, item_type, genres")
        .eq("user_id", userId),
    ]);

    const watchlist = watchlistResult.data ?? [];
    const ratings = ratingsResult.data ?? [];
    const watched = watchedResult.data ?? [];

    if (watchlist.length === 0) {
      return NextResponse.json({ items: [], note: "Your watchlist is empty." });
    }

    const profile = buildGenreProfile(ratings, watched);

    const scored: SmartItem[] = watchlist.map((item) => {
      const { rating, reason } = predictRating(item.genres, profile);
      return {
        id: item.id,
        itemId: item.item_id,
        itemName: item.item_name,
        itemType: item.item_type,
        imageUrl: item.image_url,
        genres: item.genres,
        addedAt: item.created_at,
        predictedRating: rating,
        reason,
      };
    });

    scored.sort((a, b) => b.predictedRating - a.predictedRating);

    const topGenres = Object.entries(profile)
      .filter(([, v]) => v.sampleCount >= 2)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 5)
      .map(([genre, v]) => ({
        genre,
        affinity: Math.round(v.weight * 100),
        sampleCount: v.sampleCount,
      }));

    return NextResponse.json({
      items: scored,
      tasteProfile: topGenres,
      total: scored.length,
    });
  } catch (err) {
    console.error("Smart watchlist error:", err);
    return NextResponse.json({ error: "Failed to analyze watchlist." }, { status: 500 });
  }
}
