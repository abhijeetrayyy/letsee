import { createClient } from "@/utils/supabase/server";
import BarChart from "./BarChart";

// Define types
type GenreCounts = Record<string, number>;
type GenreStat = [string, number];

// Fetch genre statistics for a user
async function getUserGenreStatistics(userId: string): Promise<GenreCounts> {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("watched_items")
    .select("genres")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching user items:", error);
    return {};
  }

  const genreCounts: GenreCounts = {};

  items?.forEach((item) => {
    if (Array.isArray(item.genres)) {
      item.genres.forEach((genre: string) => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    }
  });

  return genreCounts;
}

// Get top N genres
function getTopGenres(genreCounts: GenreCounts, topN: number = 5): GenreStat[] {
  return Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
}

// Main component
export default async function StatisticsGenre({
  userId,
  username,
}: {
  userId?: any;
  username?: any;
}) {
  const genreCounts = await getUserGenreStatistics(userId);
  const topGenres = getTopGenres(genreCounts);

  // Prepare data for the chart
  const chartData = {
    labels: topGenres.map(([genre]) => genre),
    values: topGenres.map(([, count]) => count),
  };

  return (
    <div className="flex flex-col w-full">
      <h2 className="text-lg font-bold text-white tracking-tight mb-4">
        @{username} top genres
      </h2>
      {topGenres.length > 0 ? (
        <div className="w-full h-80">
          <BarChart data={chartData} />
        </div>
      ) : (
        <p className="text-neutral-500 text-sm py-8 text-center">No genres yet. Watch titles to see your top genres.</p>
      )}
    </div>
  );
}
