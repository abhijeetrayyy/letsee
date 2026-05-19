import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import MediaCard from "@/components/cards/MediaCard";
import { ArrowLeft, Filter, Star, Clock, Film, Tv, Sparkles, Trash2, Check } from "lucide-react";

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

type TasteProfile = {
  genre: string;
  affinity: number;
  sampleCount: number;
}[];

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [watchlistResult, ratingsResult, watchedResult] = await Promise.all([
    supabase.from("user_watchlist").select("id, item_id, item_name, item_type, image_url, genres, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", user.id),
    supabase.from("watched_items").select("item_id, item_type, genres").eq("user_id", user.id),
  ]);

  const watchlist = watchlistResult.data ?? [];
  const ratings = ratingsResult.data ?? [];
  const watched = watchedResult.data ?? [];

  // Build genre profile
  const watchedGenres = new Map<string, string[]>();
  for (const w of watched) {
    if (Array.isArray(w.genres)) watchedGenres.set(`${w.item_type}:${w.item_id}`, w.genres);
  }
  const profile: Record<string, { weight: number; sampleCount: number }> = {};
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
    if (profile[key].sampleCount > 0) profile[key].weight /= profile[key].sampleCount;
  }

  // Score items
  const scoredItems = watchlist.map((item) => {
    const itemGenres = item.genres as string[] | null;
    if (!itemGenres || itemGenres.length === 0) return { ...item, predictedRating: 5.5, reason: "No genre data" };
    const known = itemGenres.map((g) => {
      const entry = profile[g];
      return entry ? { genre: g, score: entry.weight, known: true } : { genre: g, score: 0, known: false };
    }).filter((s) => s.known);
    if (known.length === 0) return { ...item, predictedRating: 5.5, reason: "New genres" };
    const avgScore = known.reduce((s, x) => s + x.score, 0) / known.length;
    const predicted = Math.round((5.5 + avgScore * 2) * 10) / 10;
    const clamped = Math.max(1, Math.min(10, predicted));
    const topGenre = known.sort((a, b) => b.score - a.score)[0];
    const reason = topGenre.score > 0.3 ? `Strong match: ${topGenre.genre}` : topGenre.score < -0.3 ? `Weak match: ${topGenre.genre}` : `Average match: ${topGenre.genre}`;
    return { ...item, predictedRating: clamped, reason };
  });

  // Stats
  const movieCount = watchlist.filter((i) => i.item_type === "movie").length;
  const tvCount = watchlist.filter((i) => i.item_type === "tv").length;
  const allGenres = watchlist.flatMap((i) => (i.genres as string[]) || []).filter(Boolean);
  const genreCounts: Record<string, number> = {};
  for (const g of allGenres) genreCounts[g] = (genreCounts[g] || 0) + 1;
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Taste profile
  const topGenres = Object.entries(profile)
    .filter(([, v]) => v.sampleCount >= 2)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 5)
    .map(([genre, v]) => ({ genre, affinity: Math.round(v.weight * 100), sampleCount: v.sampleCount }));

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-surface-950" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <Link href="/app" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-brand-400 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white">My Watchlist</h1>
          <p className="text-surface-400 mt-2">{watchlist.length} titles waiting to be watched</p>

          {/* Stats */}
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="pill-glass text-sm flex items-center gap-1">
              <Film className="w-3.5 h-3.5" /> {movieCount} movies
            </span>
            <span className="pill-glass text-sm flex items-center gap-1">
              <Tv className="w-3.5 h-3.5" /> {tvCount} shows
            </span>
            {topGenre && (
              <span className="pill-glass text-sm flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-accent-gold" /> Top: {topGenre}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Client Watchlist Component */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <WatchlistClient
          initialItems={scoredItems}
          topGenres={topGenres}
        />
      </div>
    </div>
  );
}

function WatchlistClient({ initialItems, topGenres }: { initialItems: any[]; topGenres: any[] }) {
  return (
    <div>
      {/* Taste Profile */}
      {topGenres.length > 0 && (
        <div className="glass-card rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">Your Taste Profile</h2>
              <p className="text-sm text-surface-500 mt-0.5">Based on your ratings</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {topGenres.map((g: any) => (
              <span key={g.genre} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${g.affinity > 0 ? "bg-brand-500/15 text-brand-400 border border-brand-500/25" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                {g.genre} {g.affinity > 0 ? "+" : ""}{g.affinity}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      {initialItems.length === 0 ? (
        <div className="text-center py-20">
          <Film className="w-16 h-16 text-surface-700 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Your watchlist is empty</h2>
          <p className="text-surface-400 mb-6">Start adding movies and shows you want to watch.</p>
          <Link href="/app/search" className="btn-primary">
            Browse Content
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {initialItems.map((item: any) => (
            <MediaCard
              key={item.id}
              id={item.itemId}
              title={item.itemName}
              mediaType={item.itemType === "tv" ? "tv" : "movie"}
              posterPath={item.imageUrl}
              genres={item.genres}
              typeLabel={item.itemType}
              year={item.addedAt ? String(new Date(item.addedAt).getFullYear()) : undefined}
              subtitle={`${item.reason} · ${item.predictedRating}/10`}
              className="w-full max-w-[10rem] sm:max-w-[11rem]"
            />
          ))}
        </div>
      )}
    </div>
  );
}
