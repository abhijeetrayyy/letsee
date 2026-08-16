import { tmdbFetchJson } from "./tmdb";

const KEY = process.env.TMDB_API_KEY;
const BASE = "https://api.themoviedb.org/3";
const HOUR = { revalidate: 3600 } as const;

/**
 * Home used to fan out to thirteen TMDB endpoints on every render — trending,
 * weekly top, anime series, anime films, Bollywood, and five genre
 * collections — to fill nine carousels nobody was deciding anything from.
 *
 * Those carousels are gone. Browsing by genre lives at /app/moviebygenre and
 * /app/tvbygenre, reached through GenreExplorer, which is the same content one
 * click further away and without the cost on every home render.
 *
 * What's left is the two trending calls the hero and the single trending row
 * need, plus the two genre lists GenreExplorer renders its links from.
 */
export interface HomeContent {
  trending: any[];
  trendingTv: any[];
  movieGenres: { id: number; name: string }[];
  tvGenres: { id: number; name: string }[];
}

export interface HomeData {
  content: HomeContent;
  errors: string[];
}

export async function getHomeContent(): Promise<HomeData> {
  if (!KEY) return { content: emptyContent(), errors: ["TMDB API key missing"] };

  const [movieGenres, tvGenres, trending, trendingTv] = await Promise.all([
    tmdbFetchJson(`${BASE}/genre/movie/list?api_key=${KEY}`, "Movie genres", HOUR),
    tmdbFetchJson(`${BASE}/genre/tv/list?api_key=${KEY}`, "TV genres", HOUR),
    tmdbFetchJson(`${BASE}/trending/all/day?api_key=${KEY}`, "Trending", HOUR),
    tmdbFetchJson(`${BASE}/trending/tv/day?api_key=${KEY}`, "Trending TV", HOUR),
  ]);

  const errors = [movieGenres, tvGenres, trending, trendingTv]
    .map((r) => r.error)
    .filter(Boolean) as string[];

  return {
    content: {
      trending: (trending.data as any)?.results ?? [],
      trendingTv: (trendingTv.data as any)?.results ?? [],
      movieGenres: (movieGenres.data as any)?.genres ?? [],
      tvGenres: (tvGenres.data as any)?.genres ?? [],
    },
    errors,
  };
}

function emptyContent(): HomeContent {
  return { trending: [], trendingTv: [], movieGenres: [], tvGenres: [] };
}
