import { GenreList } from "@/staticData/genreList";
import { createClient } from "@/utils/supabase/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_MOVIES_FOR_GENRES = 15;
const MAX_RECOMMENDATIONS = 15;
const FALLBACK_GENRES = "10749,18"; // Romance, Drama

type TmdbMovie = {
  id: number;
  title?: string;
  poster_path?: string | null;
  genre_ids?: number[];
};

type DiscoverResult = { results?: TmdbMovie[]; total_pages?: number };

function getGenreName(id: number): string | null {
  const g = GenreList.genres.find((x: { id: number }) => x.id === id);
  return g ? (g as { name: string }).name : null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json(
      { error: "You must be logged in to get personal recommendations." },
      { status: 401 }
    );
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY is missing on the server." },
      { status: 500 }
    );
  }

  const userId = auth.user.id;

  try {
    const [favRes, watchedRes] = await Promise.all([
      supabase
        .from("favorite_items")
        .select("item_id")
        .eq("user_id", userId)
        .eq("item_type", "movie"),
      supabase
        .from("watched_items")
        .select("item_id")
        .eq("user_id", userId)
        .eq("item_type", "movie"),
    ]);

    const favIds = new Set(
      (favRes.data ?? []).map((r: { item_id: string }) => r.item_id)
    );
    const watchedIds = new Set(
      (watchedRes.data ?? []).map((r: { item_id: string }) => r.item_id)
    );
    const excludeIds = new Set([...favIds, ...watchedIds]);
    const allIds = Array.from(excludeIds).slice(0, MAX_MOVIES_FOR_GENRES);

    let topGenreIds: number[] = [];

    if (allIds.length > 0) {
      const movieDetails = await Promise.all(
        allIds.map((id) =>
          serverFetchJson<TmdbMovie>(
            `${TMDB_BASE}/movie/${id}?api_key=${apiKey}&language=en-US`
          ).catch(() => null)
        )
      );

      const genreCounts: Record<number, number> = {};
      for (const movie of movieDetails) {
        if (movie?.genre_ids) {
          for (const gid of movie.genre_ids) {
            genreCounts[gid] = (genreCounts[gid] ?? 0) + 1;
          }
        }
      }
      topGenreIds = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([id]) => parseInt(id, 10));
    }

    const genreParam =
      topGenreIds.length > 0
        ? topGenreIds.join(",")
        : FALLBACK_GENRES;

    const results: TmdbMovie[] = [];
    for (let page = 1; page <= 2; page++) {
      const url = `${TMDB_BASE}/discover/movie?api_key=${apiKey}&language=en-US&with_genres=${genreParam}&sort_by=popularity.desc&vote_count.gte=50&page=${page}`;
      const data = await serverFetchJson<DiscoverResult>(url, {
        retries: 2,
      });
      const list = data.results ?? [];
      for (const m of list) {
        if (results.length >= MAX_RECOMMENDATIONS * 2) break;
        if (!excludeIds.has(String(m.id))) results.push(m);
      }
    }

    const trimmed = results.slice(0, MAX_RECOMMENDATIONS);
    const payload = trimmed.map((m) => ({
      name: m.title ?? "Unknown",
      poster_url: m.poster_path
        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
        : null,
      id: String(m.id),
      genres: (m.genre_ids ?? [])
        .map(getGenreName)
        .filter((n): n is string => n != null),
    }));

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Personal recommendations error:", err);
    return NextResponse.json(
      { error: "Failed to load personal recommendations." },
      { status: 500 }
    );
  }
}
