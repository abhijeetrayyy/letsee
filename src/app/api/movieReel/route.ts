// app/api/movieReel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchTmdb } from "@/utils/tmdbClient";

const REEL_DISCOVER_REVALIDATE_SEC = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { keyword, genreId, page = 1 } = body;

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    let movieIds: number[];
    let totalPages: number;

    if (genreId != null && genreId !== "") {
      // Genre-based: discover by genre (throttled + cached 5 min)
      const discoverResponse = await fetchTmdb(
        `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${encodeURIComponent(String(genreId))}&page=${page}&include_video=true`,
        { revalidate: REEL_DISCOVER_REVALIDATE_SEC }
      );
      const discoverData = await discoverResponse.json();
      movieIds = (discoverData.results ?? []).map((m: any) => m.id);
      totalPages = discoverData.total_pages ?? 1;
    } else {
      if (!keyword) {
        return NextResponse.json({ error: "Missing keyword or genreId" }, { status: 400 });
      }
      // Step 1: Search for the keyword ID (throttled + cached 5 min)
      const keywordResponse = await fetchTmdb(
        `https://api.themoviedb.org/3/search/keyword?api_key=${apiKey}&query=${encodeURIComponent(
          keyword
        )}&page=1`,
        { revalidate: REEL_DISCOVER_REVALIDATE_SEC }
      );
      const keywordData = await keywordResponse.json();
      const keywordId = keywordData.results[0]?.id;

      if (!keywordId) {
        return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
      }

      // Step 2: Fetch movies for the specified page with discover (throttled + cached 5 min)
      const discoverResponse = await fetchTmdb(
        `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_keywords=${keywordId}&page=${page}&include_video=true`,
        { revalidate: REEL_DISCOVER_REVALIDATE_SEC }
      );
      const discoverData = await discoverResponse.json();
      movieIds = (discoverData.results ?? []).map((movie: any) => movie.id);
      totalPages = discoverData.total_pages ?? 1;
    }

    // Step 3: Fetch detailed movie info (throttled by central tmdbClient)
    const moviesWithDetails = await Promise.all(
      movieIds.map(async (id: number) => {
        const movieResponse = await fetchTmdb(
          `https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&append_to_response=videos,external_ids`
        );
        const movieData = await movieResponse.json();

        const trailer = movieData.videos?.results?.find(
          (v: any) => v.type === "Trailer" && v.site === "YouTube"
        );

        return {
          id: movieData.id,
          title: movieData.title,
          trailer: trailer
            ? `https://www.youtube.com/embed/${trailer.key}`
            : undefined,
          poster_path: movieData.poster_path,
          genres: movieData.genres?.map((g: any) => g.name) || [],
          imdb_id: movieData.external_ids?.imdb_id,
          adult: movieData.adult,
        };
      })
    );

    // Filter movies with trailers
    const filteredMovies = moviesWithDetails.filter((movie) => movie.trailer);

    return NextResponse.json(
      {
        movies: filteredMovies,
        totalPages: totalPages ?? 1,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
