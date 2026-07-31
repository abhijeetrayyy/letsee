import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchTmdb } from "@/utils/tmdbClient";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

/** GET /api/movieReel/watchlist — movies from user's watchlist that have trailers (for reels) */
export async function GET() {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return NextResponse.json({ error: "User isn't logged in", movies: [], totalPages: 1 }, { status: 401 });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured", movies: [], totalPages: 1 }, { status: 500 });
  }

  const { data: watchlist } = await supabase
    .from("user_media_status")
    .select("item_id")
    .eq("user_id", user.user.id)
    .eq("item_type", "movie")
    .eq("status", "watchlist")
    .limit(30);

  const movieIds = (watchlist ?? []).map((r) => r.item_id).filter(Boolean);
  if (movieIds.length === 0) {
    return jsonSuccess({ movies: [], totalPages: 1 });
  }

  const moviesWithDetails: any[] = [];
  for (let i = 0; i < movieIds.length; i++) {
    try {
      const res = await fetchTmdb(
        `https://api.themoviedb.org/3/movie/${movieIds[i]}?api_key=${apiKey}&append_to_response=videos,external_ids`
      );
      if (!res.ok) continue;
      const movieData = await res.json();
      const trailer = movieData.videos?.results?.find(
        (v: any) => v.type === "Trailer" && v.site === "YouTube"
      );
      if (!trailer) continue;
      moviesWithDetails.push({
        id: movieData.id,
        title: movieData.title,
        trailer: `https://www.youtube.com/embed/${trailer.key}`,
        poster_path: movieData.poster_path,
        genres: movieData.genres?.map((g: any) => g.name) || [],
        imdb_id: movieData.external_ids?.imdb_id,
        adult: movieData.adult ?? false,
      });
    } catch {
      // skip
    }
  }

  return jsonSuccess({ movies: moviesWithDetails, totalPages: 1 });
}
