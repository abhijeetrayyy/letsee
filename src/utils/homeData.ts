import { tmdbFetchJson } from "./tmdb";

const KEY = process.env.TMDB_API_KEY;
const BASE = "https://api.themoviedb.org/3";
const HOUR = { revalidate: 3600 } as const;

export interface HomeContent {
  trending: any[];
  trendingTv: any[];
  weeklyTop: any[];
  movieGenres: { id: number; name: string }[];
  tvGenres: { id: number; name: string }[];
  animeSeries: any[];
  animeFilms: any[];
  bollywood: any[];
  collections: {
    romance: any[];
    action: any[];
    crime: any[];
    thriller: any[];
    horror: any[];
  };
}

export interface HomeData {
  content: HomeContent;
  errors: string[];
}

export async function getHomeContent(): Promise<HomeData> {
  if (!KEY) return { content: emptyContent(), errors: ["TMDB API key missing"] };

  const [movieGenres, tvGenres, trending, trendingTv, weeklyTop, animeSeries, animeFilms, bollywood,
    romance, action, crime, thriller, horror] = await Promise.all([
    tmdbFetchJson(`${BASE}/genre/movie/list?api_key=${KEY}`, "Movie genres", HOUR),
    tmdbFetchJson(`${BASE}/genre/tv/list?api_key=${KEY}`, "TV genres", HOUR),
    tmdbFetchJson(`${BASE}/trending/all/day?api_key=${KEY}`, "Trending", HOUR),
    tmdbFetchJson(`${BASE}/trending/tv/day?api_key=${KEY}`, "Trending TV", HOUR),
    tmdbFetchJson(`${BASE}/trending/all/week?api_key=${KEY}`, "Weekly top", HOUR),
    tmdbFetchJson(`${BASE}/discover/tv?api_key=${KEY}&with_keywords=210024&sort_by=popularity.desc&vote_count.gte=50`, "Anime series", HOUR),
    tmdbFetchJson(`${BASE}/discover/movie?api_key=${KEY}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&vote_count.gte=50`, "Anime films", HOUR),
    tmdbFetchJson(`${BASE}/discover/movie?api_key=${KEY}&with_original_language=hi&primary_release_date.gte=2015-01-01&sort_by=popularity.desc&vote_count.gte=20`, "Bollywood", HOUR),
    tmdbFetchJson(`${BASE}/discover/movie?api_key=${KEY}&with_genres=10749&sort_by=popularity.desc&vote_count.gte=100`, "Romance", HOUR),
    tmdbFetchJson(`${BASE}/discover/movie?api_key=${KEY}&with_genres=28&sort_by=popularity.desc&vote_count.gte=100`, "Action", HOUR),
    tmdbFetchJson(`${BASE}/discover/movie?api_key=${KEY}&with_genres=80&sort_by=popularity.desc&vote_count.gte=100`, "Crime", HOUR),
    tmdbFetchJson(`${BASE}/discover/movie?api_key=${KEY}&with_genres=53&sort_by=popularity.desc&vote_count.gte=100`, "Thriller", HOUR),
    tmdbFetchJson(`${BASE}/discover/movie?api_key=${KEY}&with_genres=27&sort_by=popularity.desc&vote_count.gte=100`, "Horror", HOUR),
  ]);

  const errors = [movieGenres, tvGenres, trending, trendingTv, weeklyTop, animeSeries, animeFilms, bollywood,
    romance, action, crime, thriller, horror]
    .map(r => r.error)
    .filter(Boolean) as string[];

  return {
    content: {
      trending: (trending.data as any)?.results ?? [],
      trendingTv: (trendingTv.data as any)?.results ?? [],
      weeklyTop: (weeklyTop.data as any)?.results ?? [],
      movieGenres: (movieGenres.data as any)?.genres ?? [],
      tvGenres: (tvGenres.data as any)?.genres ?? [],
      animeSeries: (animeSeries.data as any)?.results ?? [],
      animeFilms: (animeFilms.data as any)?.results ?? [],
      bollywood: (bollywood.data as any)?.results ?? [],
      collections: {
        romance: (romance.data as any)?.results ?? [],
        action: (action.data as any)?.results ?? [],
        crime: (crime.data as any)?.results ?? [],
        thriller: (thriller.data as any)?.results ?? [],
        horror: (horror.data as any)?.results ?? [],
      },
    },
    errors,
  };
}

function emptyContent(): HomeContent {
  return {
    trending: [], trendingTv: [], weeklyTop: [], movieGenres: [], tvGenres: [],
    animeSeries: [], animeFilms: [], bollywood: [],
    collections: { romance: [], action: [], crime: [], thriller: [], horror: [] },
  };
}
