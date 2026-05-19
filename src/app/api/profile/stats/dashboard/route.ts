import { createClient } from "@/utils/supabase/server";

type GenreStat = { genre: string; count: number; percentage: number };
type RatingStat = { score: number; count: number };
type YearStat = { year: number; count: number; movieCount: number; tvCount: number };
type MonthStat = { month: number; count: number; label: string };
type WeekdayStat = { day: string; count: number };
type StreakInfo = { current: number; longest: number };
type GenreRating = { genre: string; avgRating: number; count: number };
type TopItem = { itemId: string; name: string; itemType: string; score: number; imageUrl: string | null };
type YearReview = {
  moviesThisYear: number;
  tvThisYear: number;
  episodesThisYear: number;
  totalHoursThisYear: number;
  distinctGenresCount: number;
  topGenreThisYear: string | null;
  topRatedThisYear: TopItem[];
  mostWatchedMonth: string | null;
  mostWatchedDay: string | null;
  totalDaysWatched: number;
  currentYear: number;
};

type DashboardData = {
  overview: {
    watchedCount: number;
    favoriteCount: number;
    watchlistCount: number;
    watchingCount: number;
    episodesCount: number;
    totalHours: number;
    movieCount: number;
    tvCount: number;
  };
  genres: GenreStat[];
  ratingDistribution: RatingStat[];
  yearlyActivity: YearStat[];
  monthlyActivity: MonthStat[];
  weekdayDistribution: WeekdayStat[];
  streaks: StreakInfo;
  avgRatingPerGenre: GenreRating[];
  topRated: TopItem[];
  tvCompletion: { completed: number; total: number; rate: number } | null;
  yearInReview: YearReview | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return new Response(JSON.stringify({ error: "userId is required" }), { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === userId;

  try {
    const [
      watchedResult,
      favoritesResult,
      watchlistResult,
      ratingsResult,
      episodesResult,
      tvListResult,
      watchingResult,
    ] = await Promise.all([
      supabase.from("watched_items").select("id, item_id, item_name, item_type, genres, watched_at, is_watched").eq("user_id", userId),
      supabase.from("favorite_items").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("user_watchlist").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", userId),
      supabase.from("watched_episodes").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("user_tv_list").select("show_id, status").eq("user_id", userId),
      supabase.from("user_watchlist").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_watching", true),
    ]);

    const watchedItems = watchedResult.data ?? [];
    const ratings = ratingsResult.data ?? [];
    const tvList = tvListResult.data ?? [];
    const favoriteCount = favoritesResult.count ?? 0;
    const watchlistCount = watchlistResult.count ?? 0;
    const episodesCount = episodesResult.count ?? 0;
    const watchingCount = watchingResult.count ?? 0;

    const movieItems = watchedItems.filter((i) => i.item_type === "movie");
    const tvItems = watchedItems.filter((i) => i.item_type === "tv");

    const totalHours = Math.round(movieItems.length * 2 + (episodesCount || tvItems.length * 8) * 0.75);

    const genreCounts: Record<string, number> = {};
    watchedItems.forEach((item) => {
      if (Array.isArray(item.genres)) {
        item.genres.forEach((g: string) => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      }
    });
    const totalGenreEntries = Object.values(genreCounts).reduce((a, b) => a + b, 0);
    const genres: GenreStat[] = Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count, percentage: totalGenreEntries > 0 ? Math.round((count / totalGenreEntries) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    const ratingCounts: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) ratingCounts[i] = 0;
    ratings.forEach((r) => {
      if (r.score >= 1 && r.score <= 10) ratingCounts[r.score] = (ratingCounts[r.score] || 0) + 1;
    });
    const ratingDistribution: RatingStat[] = Object.entries(ratingCounts)
      .map(([score, count]) => ({ score: Number(score), count }))
      .sort((a, b) => a.score - b.score);

    const yearMap: Record<number, { count: number; movieCount: number; tvCount: number }> = {};
    watchedItems.forEach((item) => {
      if (item.watched_at) {
        const year = new Date(item.watched_at).getFullYear();
        if (!yearMap[year]) yearMap[year] = { count: 0, movieCount: 0, tvCount: 0 };
        yearMap[year].count++;
        if (item.item_type === "movie") yearMap[year].movieCount++;
        else yearMap[year].tvCount++;
      }
    });
    const yearlyActivity: YearStat[] = Object.entries(yearMap)
      .map(([year, d]) => ({ year: Number(year), ...d }))
      .sort((a, b) => a.year - b.year);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthMap: Record<number, number> = {};
    watchedItems.forEach((item) => {
      if (item.watched_at) {
        const d = new Date(item.watched_at);
        if (d.getFullYear() === currentYear) {
          const m = d.getMonth();
          monthMap[m] = (monthMap[m] || 0) + 1;
        }
      }
    });
    const monthlyActivity: MonthStat[] = Array.from({ length: currentMonth + 1 }, (_, i) => ({
      month: i + 1,
      count: monthMap[i] ?? 0,
      label: monthLabels[i],
    }));

    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdayMap: Record<number, number> = {};
    watchedItems.forEach((item) => {
      if (item.watched_at) {
        const day = new Date(item.watched_at).getDay();
        weekdayMap[day] = (weekdayMap[day] || 0) + 1;
      }
    });
    const weekdayDistribution: WeekdayStat[] = Array.from({ length: 7 }, (_, i) => ({
      day: weekdayLabels[i],
      count: weekdayMap[i] ?? 0,
    }));

    const dates = watchedItems
      .filter((i) => i.watched_at)
      .map((i) => new Date(i.watched_at).toISOString().split("T")[0])
      .sort();
    const uniqueDates = [...new Set(dates)];
    let current = 0;
    let longest = 0;
    let streak = 0;
    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) {
        streak = 1;
      } else {
        const diff = (new Date(uniqueDates[i]).getTime() - new Date(uniqueDates[i - 1]).getTime()) / 86400000;
        if (diff <= 2) {
          streak++;
        } else {
          longest = Math.max(longest, streak);
          streak = 1;
        }
      }
    }
    longest = Math.max(longest, streak);

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
      current = streak;
    } else {
      current = 0;
    }

    const genreRatingsMap: Record<string, { total: number; count: number }> = {};
    watchedItems.forEach((item) => {
      const itemRating = ratings.find((r) => r.item_id === item.item_id && r.item_type === item.item_type);
      if (itemRating && Array.isArray(item.genres)) {
        item.genres.forEach((g: string) => {
          if (!genreRatingsMap[g]) genreRatingsMap[g] = { total: 0, count: 0 };
          genreRatingsMap[g].total += itemRating.score;
          genreRatingsMap[g].count++;
        });
      }
    });
    const avgRatingPerGenre: GenreRating[] = Object.entries(genreRatingsMap)
      .map(([genre, d]) => ({ genre, avgRating: Math.round((d.total / d.count) * 10) / 10, count: d.count }))
      .sort((a, b) => b.avgRating - a.avgRating);

    const watchedMap = new Map(watchedItems.map((i) => [`${i.item_type}:${i.item_id}`, i]));
    const topRated: TopItem[] = ratings
      .filter((r) => {
        const key = `${r.item_type}:${r.item_id}`;
        const watched = watchedMap.get(key);
        return watched && (isOwner || true);
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((r) => {
        const key = `${r.item_type}:${r.item_id}`;
        const item = watchedMap.get(key);
        return {
          itemId: r.item_id,
          name: item?.item_name ?? r.item_id,
          itemType: r.item_type,
          score: r.score,
          imageUrl: null,
        };
      });

    let tvCompletion: DashboardData["tvCompletion"] = null;
    if (tvList.length > 0) {
      const completed = tvList.filter((t) => t.status === "completed").length;
      tvCompletion = { completed, total: tvList.length, rate: Math.round((completed / tvList.length) * 100) };
    }

    // Year in review (current year)
    const thisYear = new Date().getFullYear();
    const thisYearItems = watchedItems.filter((i) => {
      if (!i.watched_at) return false;
      return new Date(i.watched_at).getFullYear() === thisYear;
    });
    const thisYearMovies = thisYearItems.filter((i) => i.item_type === "movie");
    const thisYearTv = thisYearItems.filter((i) => i.item_type === "tv");
    const thisYearEpisodes = thisYearItems.length > 0 || true ? episodesCount : 0;

    const yearGenreCounts: Record<string, number> = {};
    thisYearItems.forEach((item) => {
      if (Array.isArray(item.genres)) {
        item.genres.forEach((g: string) => { yearGenreCounts[g] = (yearGenreCounts[g] || 0) + 1; });
      }
    });
    const topGenreThisYear = Object.entries(yearGenreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const yearMonthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const yearMonthMap: Record<number, number> = {};
    thisYearItems.forEach((item) => {
      if (item.watched_at) {
        const m = new Date(item.watched_at).getMonth();
        yearMonthMap[m] = (yearMonthMap[m] || 0) + 1;
      }
    });
    const bestMonthIdx = Object.entries(yearMonthMap).sort((a, b) => b[1] - a[1])[0]?.[0];
    const mostWatchedMonth = bestMonthIdx !== undefined ? yearMonthLabels[Number(bestMonthIdx)] : null;

    const yearWeekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const yearWeekdayMap: Record<number, number> = {};
    thisYearItems.forEach((item) => {
      if (item.watched_at) {
        const d = new Date(item.watched_at).getDay();
        yearWeekdayMap[d] = (yearWeekdayMap[d] || 0) + 1;
      }
    });
    const bestDayIdx = Object.entries(yearWeekdayMap).sort((a, b) => b[1] - a[1])[0]?.[0];
    const mostWatchedDay = bestDayIdx !== undefined ? yearWeekdayLabels[Number(bestDayIdx)] : null;

    const thisYearDates = [...new Set(thisYearItems.filter((i) => i.watched_at).map((i) => new Date(i.watched_at).toISOString().split("T")[0]))];

    const yearRatings = ratings.filter((r) => {
      const key = `${r.item_type}:${r.item_id}`;
      return thisYearItems.some((wi) => `${wi.item_type}:${wi.item_id}` === key);
    });
    const thisYearWatchedMap = new Map(thisYearItems.map((i) => [`${i.item_type}:${i.item_id}`, i]));
    const yearTopRated: TopItem[] = yearRatings
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => {
        const key = `${r.item_type}:${r.item_id}`;
        const item = thisYearWatchedMap.get(key);
        return {
          itemId: r.item_id, name: item?.item_name ?? r.item_id,
          itemType: r.item_type, score: r.score, imageUrl: null,
        };
      });

    const yearInReview: YearReview | null = thisYearItems.length > 0 ? {
      moviesThisYear: thisYearMovies.length,
      tvThisYear: thisYearTv.length,
      episodesThisYear: 0,
      totalHoursThisYear: Math.round(thisYearMovies.length * 2 + (thisYearTv.length * 8) * 0.75),
      distinctGenresCount: Object.keys(yearGenreCounts).length,
      topGenreThisYear,
      topRatedThisYear: yearTopRated,
      mostWatchedMonth,
      mostWatchedDay,
      totalDaysWatched: thisYearDates.length,
      currentYear: thisYear,
    } : null;

    const dashboard: DashboardData = {
      overview: {
        watchedCount: watchedItems.length,
        favoriteCount,
        watchlistCount,
        watchingCount,
        episodesCount,
        totalHours,
        movieCount: movieItems.length,
        tvCount: tvItems.length,
      },
      genres,
      ratingDistribution,
      yearlyActivity,
      monthlyActivity,
      weekdayDistribution,
      streaks: { current, longest },
      avgRatingPerGenre,
      topRated,
      tvCompletion,
      yearInReview,
    };

    return new Response(JSON.stringify({ data: dashboard }));
  } catch (err) {
    console.error("Dashboard error:", err);
    return new Response(JSON.stringify({ error: "Failed to load dashboard data" }), { status: 500 });
  }
}
