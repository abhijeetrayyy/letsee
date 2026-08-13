export type TasteProfile = {
  topGenres: {
    genre: string;
    /** Rating-based affinity, or null when there aren't enough ratings to
        claim one. Never conflate "unrated" with "rated average" — 67 watched
        Action titles and no ratings used to render as a red "Action 0". */
    affinity: number | null;
    count: number;
    /** How many of those watched titles carry a rating. */
    ratedCount: number;
  }[];
  loves: string[];
  avoids: string[];
  ratesHighest: string | null;
  totalGenresExplored: number;
};

/** Shrinkage constant: ratings needed before an affinity carries full weight. */
const MIN_RATINGS_FOR_AFFINITY = 3;

export function computeTasteSummary(
  watchedWithGenres: { genres?: string[] | null; item_type?: string }[],
  ratings: { item_id: string; item_type: string; score: number }[],
): TasteProfile {
  const genreCounts: Record<string, number> = {};
  const genreScores: Record<string, { total: number; count: number }> = {};
  const ratingMap = new Map(ratings.map((r) => [`${r.item_type}:${r.item_id}`, r.score]));

  for (const item of watchedWithGenres) {
    if (!Array.isArray(item.genres)) continue;
    for (const g of item.genres) {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    }
  }

  for (const item of watchedWithGenres) {
    if (!Array.isArray(item.genres)) continue;
    const key = `${item.item_type}:${(item as any).item_id}`;
    const score = ratingMap.get(key);
    if (score === undefined) continue;
    for (const g of item.genres) {
      if (!genreScores[g]) genreScores[g] = { total: 0, count: 0 };
      genreScores[g].total += score;
      genreScores[g].count++;
    }
  }

  const entries = Object.entries(genreCounts)
    .map(([genre, count]) => {
      const scoreData = genreScores[genre];
      const ratedCount = scoreData?.count ?? 0;
      const avgRating = ratedCount > 0 ? scoreData!.total / ratedCount : null;
      // A single 8/10 is not evidence of a strong preference. Pull the score
      // toward neutral until enough ratings back it up, so one rating can't
      // sit next to a genre with ten and claim the same confidence.
      const shrink = ratedCount / (ratedCount + MIN_RATINGS_FOR_AFFINITY);
      const normScore = avgRating !== null ? ((avgRating - 5.5) / 4.5) * shrink : null;
      return {
        genre,
        count,
        ratedCount,
        affinity: normScore !== null ? Math.round(normScore * 100) : null,
        avgRating,
      };
    })
    .sort((a, b) => b.count - a.count);

  const loves = entries
    .filter((e) => e.affinity !== null && e.affinity > 20)
    .slice(0, 3)
    .map((e) => e.genre);

  const avoids = entries
    .filter((e) => e.affinity !== null && e.affinity < -20)
    .slice(0, 2)
    .map((e) => e.genre);

  const highestRated = entries
    .filter((e) => e.avgRating !== null && e.count >= 2)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0]?.genre ?? null;

  return {
    topGenres: entries.slice(0, 6).map((e) => ({
      genre: e.genre, affinity: e.affinity, count: e.count, ratedCount: e.ratedCount,
    })),
    loves,
    avoids,
    ratesHighest: highestRated,
    totalGenresExplored: entries.length,
  };
}

export type TasteInsight = {
  summary: string;
  topGenres: string[];
  watchingStyle: string;
  recommendation: string;
  totalWatched: number;
  avgRating: number | null;
};

/**
 * Builds the natural-language "taste profile" summary shown on a user's
 * profile. Pure function over an already-computed TasteProfile so callers
 * that already have watched_items/user_ratings loaded (the profile page,
 * the ai-summary API route) don't need to re-query to get this text.
 */
export function buildTasteInsight(
  username: string,
  tasteProfile: TasteProfile,
  totalWatched: number,
  avgRating: number | null,
): TasteInsight {
  if (totalWatched === 0) {
    return {
      summary: "No watched items yet to analyze.",
      topGenres: [],
      watchingStyle: "",
      recommendation: "",
      totalWatched: 0,
      avgRating: null,
    };
  }

  const topGenreNames = tasteProfile.topGenres.slice(0, 4).map((g) => g.genre);
  const roundedAvg = avgRating !== null ? Math.round(avgRating * 10) / 10 : null;

  let summary = "";
  let watchingStyle = "";

  if (topGenreNames.length >= 2) {
    summary = `${username} loves ${topGenreNames[0]} and ${topGenreNames[1]}`;
  } else if (topGenreNames.length === 1) {
    summary = `${username} is a ${topGenreNames[0]} fan`;
  } else {
    summary = `${username} has an eclectic taste`;
  }

  if (totalWatched >= 100) {
    summary += ` with over ${totalWatched} titles watched`;
    watchingStyle = totalWatched >= 500 ? "A true cinephile" : "An active watcher";
  } else if (totalWatched >= 20) {
    summary += ` across ${totalWatched} titles`;
    watchingStyle = "Building their film journey";
  } else {
    summary += ` — just getting started`;
    watchingStyle = "Early explorer";
  }

  if (roundedAvg !== null) {
    summary += `. Average rating: ${roundedAvg}/10`;
  }

  if (tasteProfile.totalGenresExplored >= 10) {
    summary += `. Explored ${tasteProfile.totalGenresExplored} genres`;
  }

  summary += ".";

  const recommendation = topGenreNames.length > 0
    ? `If you like their ${topGenreNames[0]} picks, check out what else they've watched.`
    : "";

  return {
    summary,
    topGenres: topGenreNames,
    watchingStyle,
    recommendation,
    totalWatched,
    avgRating: roundedAvg,
  };
}
