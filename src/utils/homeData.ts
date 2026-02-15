/**
 * Server-side home page data: one place for all section fetches.
 * Carefully chosen TMDB endpoints with sort_by and vote_count for quality.
 * Each section is independent so one failure doesn't break others.
 */

import { tmdbFetchJson } from "./tmdb";

const REVALIDATE_HOUR = 3600;
const KEY = process.env.TMDB_API_KEY;

export type HomeSections = {
  movieGenres: { genres: { id: number; name: string }[] };
  tvGenres: { genres: { id: number; name: string }[] };
  weeklyTop: { results: any[] };
  trendingTv: { results: any[] };
  animeSeries: { results: any[] };
  animeFilms: { results: any[] };
  romance: { results: any[] };
  action: { results: any[] };
  bollywood: { results: any[] };
  crime: { results: any[] };
  thriller: { results: any[] };
  darkZones: { results: any[] };
  horror: { results: any[] };
};

export type HomeDataResult = {
  sections: Partial<HomeSections>;
  errors: string[];
};

const emptyGenres = { genres: [] };
const emptyResults = { results: [] };

export async function getHomeSections(): Promise<HomeDataResult> {
  if (!KEY) {
    return { sections: {}, errors: ["TMDB API key is missing."] };
  }

  const base = "https://api.themoviedb.org/3";
  const opts = { revalidate: REVALIDATE_HOUR } as const;

  const [
    movieGenres,
    tvGenres,
    weeklyTop,
    trendingTv,
    animeSeries,
    animeFilms,
    romance,
    action,
    bollywood,
    crime,
    thriller,
    darkZones,
    horror,
  ] = await Promise.all([
    tmdbFetchJson<{ genres: any[] }>(
      `${base}/genre/movie/list?api_key=${KEY}&language=en-US`,
      "Movie genres",
      opts
    ),
    tmdbFetchJson<{ genres: any[] }>(
      `${base}/genre/tv/list?api_key=${KEY}&language=en-US`,
      "TV genres",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/trending/all/week?api_key=${KEY}&language=en-US`,
      "Weekly top",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/trending/tv/day?api_key=${KEY}&language=en-US`,
      "Trending TV",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/discover/tv?api_key=${KEY}&language=en-US&with_keywords=210024&sort_by=popularity.desc&vote_count.gte=50&page=1`,
      "Anime series (TMDB keyword: anime)",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/discover/movie?api_key=${KEY}&language=en-US&with_genres=16&with_original_language=ja&sort_by=popularity.desc&vote_count.gte=50&page=1`,
      "Anime films (Animation + Japanese)",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/discover/movie?api_key=${KEY}&language=en-US&with_genres=10749&sort_by=popularity.desc&vote_count.gte=100&page=1`,
      "Romance",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/discover/movie?api_key=${KEY}&language=en-US&with_genres=28&sort_by=popularity.desc&vote_count.gte=100&page=1`,
      "Action",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/discover/movie?api_key=${KEY}&language=en-US&with_original_language=hi&primary_release_date.gte=2015-01-01&sort_by=popularity.desc&vote_count.gte=20&page=1`,
      "Bollywood",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/discover/movie?api_key=${KEY}&language=en-US&with_genres=80&sort_by=popularity.desc&vote_count.gte=100&page=1`,
      "Crime",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/discover/movie?api_key=${KEY}&language=en-US&with_genres=53&sort_by=popularity.desc&vote_count.gte=100&page=1`,
      "Thriller",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/discover/movie?api_key=${KEY}&language=en-US&with_genres=27&sort_by=popularity.desc&vote_count.gte=100&page=1`,
      "Dark zones (Horror)",
      opts
    ),
    tmdbFetchJson<{ results: any[] }>(
      `${base}/discover/movie?api_key=${KEY}&language=en-US&with_genres=27&sort_by=popularity.desc&vote_count.gte=100&page=2`,
      "Horror",
      opts
    ),
  ]);

  const errors = [
    movieGenres.error,
    tvGenres.error,
    weeklyTop.error,
    trendingTv.error,
    animeSeries.error,
    animeFilms.error,
    romance.error,
    action.error,
    bollywood.error,
    crime.error,
    thriller.error,
    darkZones.error,
    horror.error,
  ].filter(Boolean) as string[];

  const sections: Partial<HomeSections> = {
    movieGenres: movieGenres.data ?? emptyGenres,
    tvGenres: tvGenres.data ?? emptyGenres,
    weeklyTop: weeklyTop.data ?? emptyResults,
    trendingTv: trendingTv.data ?? emptyResults,
    animeSeries: animeSeries.data ?? emptyResults,
    animeFilms: animeFilms.data ?? emptyResults,
    romance: romance.data ?? emptyResults,
    action: action.data ?? emptyResults,
    bollywood: bollywood.data ?? emptyResults,
    crime: crime.data ?? emptyResults,
    thriller: thriller.data ?? emptyResults,
    darkZones: darkZones.data ?? emptyResults,
    horror: horror.data ?? emptyResults,
  };

  return { sections, errors };
}
