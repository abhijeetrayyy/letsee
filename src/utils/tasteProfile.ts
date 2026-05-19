export type TasteProfile = {
  topGenres: { genre: string; affinity: number; count: number }[];
  loves: string[];
  avoids: string[];
  ratesHighest: string | null;
  totalGenresExplored: number;
};

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
      const avgRating = scoreData ? scoreData.total / scoreData.count : null;
      const normScore = avgRating !== null ? (avgRating - 5.5) / 4.5 : 0;
      return { genre, count, affinity: Math.round(normScore * 100), avgRating };
    })
    .sort((a, b) => b.count - a.count);

  const loves = entries
    .filter((e) => e.affinity > 20)
    .slice(0, 3)
    .map((e) => e.genre);

  const avoids = entries
    .filter((e) => e.affinity < -20)
    .slice(0, 2)
    .map((e) => e.genre);

  const highestRated = entries
    .filter((e) => e.avgRating !== null && e.count >= 2)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0]?.genre ?? null;

  return {
    topGenres: entries.slice(0, 6).map((e) => ({
      genre: e.genre, affinity: e.affinity, count: e.count,
    })),
    loves,
    avoids,
    ratesHighest: highestRated,
    totalGenresExplored: entries.length,
  };
}
