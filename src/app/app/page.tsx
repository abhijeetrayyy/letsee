import SearchForm from "@/components/homeDiscover/client/seachForm";
import DiscoverUsers from "@components/home/DiscoverUser";
import OpenAiReco from "@components/ai/openaiReco";
import Link from "next/link";
import WeeklyTop from "@components/clientComponent/weeklyTop";
import Tvtop from "@components/clientComponent/topTv";
import HomeVideo from "@components/home/videoReel";
import MovieGenre from "@components/scroll/movieGenre";
import TvGenre from "@components/scroll/tvGenre";
import HomeContentTile from "@components/movie/homeContentTile";
import { tmdbFetchJson } from "@/utils/tmdb";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const REVALIDATE_HOUR = 3600; // 1 hour ISR for home sections

export default async function Home() {
  const [
    genreResult,
    tvGenreResult,
    trendingResult,
    trendingTvResult,
    romanceResult,
    actionResult,
    bollywoodResult,
  ] = await Promise.all([
    tmdbFetchJson<{ genres: any[] }>(
      `https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}`,
      "Movie genres",
      { revalidate: REVALIDATE_HOUR }
    ),
    tmdbFetchJson<{ genres: any[] }>(
      `https://api.themoviedb.org/3/genre/tv/list?api_key=${TMDB_API_KEY}&language=en-US`,
      "TV genres",
      { revalidate: REVALIDATE_HOUR }
    ),
    tmdbFetchJson<{ results: any[] }>(
      `https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}`,
      "Trending",
      { revalidate: REVALIDATE_HOUR }
    ),
    tmdbFetchJson<{ results: any[] }>(
      `https://api.themoviedb.org/3/trending/tv/day?api_key=${TMDB_API_KEY}`,
      "Trending TV",
      { revalidate: REVALIDATE_HOUR }
    ),
    tmdbFetchJson<{ results: any[] }>(
      `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=10749`,
      "Romance",
      { revalidate: REVALIDATE_HOUR }
    ),
    tmdbFetchJson<{ results: any[] }>(
      `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28`,
      "Action",
      { revalidate: REVALIDATE_HOUR }
    ),
    tmdbFetchJson<{ results: any[] }>(
      `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_keywords=315446&page=1`,
      "Bollywood",
      { revalidate: REVALIDATE_HOUR }
    ),
  ]);

  const errors = [
    genreResult.error,
    tvGenreResult.error,
    trendingResult.error,
    trendingTvResult.error,
    romanceResult.error,
    actionResult.error,
    bollywoodResult.error,
  ].filter(Boolean) as string[];

  const genre = genreResult.data ?? { genres: [] };
  const tvGenres = tvGenreResult.data ?? { genres: [] };
  const data = trendingResult.data ?? { results: [] };
  const TrendingTv = trendingTvResult.data ?? { results: [] };
  const RomanceData = romanceResult.data ?? { results: [] };
  const ActionData = actionResult.data ?? { results: [] };
  const BollywoodData = bollywoodResult.data ?? { results: [] };

  return (
    <>
      <HomeVideo />

      <div className="mt-10 flex flex-col gap-8 max-w-[1920px] w-full m-auto">
        {/* <div className="flex flex-col text-center items-center gap-3 my-10">
          <h1 className="text-3xl font-bold">Your Personal Recommendation</h1>
          <p>
            Favorite List + Watched List with{" "}
            <span className="text-blue-700">AI</span>
          </p>
          <div className="mt-1">
            <OpenAiReco />
          </div>
        </div> */}
        {errors.length > 0 && (
          <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
            <p className="font-semibold">Some data could not be loaded.</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-200">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-amber-200">
              This usually happens when the TMDB API is unavailable or the
              network drops. Try refreshing in a moment.
            </p>
          </div>
        )}
        <div className="w-full">
          <SearchForm />
        </div>
        <div className="">
          <DiscoverUsers />
        </div>
        <div className="w-full">
          <h2 className="text-2xl my-4 font-bold">Bollywood</h2>
          <HomeContentTile type={"movie"} data={BollywoodData} />
        </div>
        <div className="w-full my-4 mb-4">
          <h1 className="text-lg font-semibold my-4">Movie Genres</h1>
          <MovieGenre genre={genre.genres} />
        </div>
        <div className="">
          <h2 className="text-2xl my-4 font-bold">Weekly Top 20</h2>
          <HomeContentTile type={"mix"} data={data} />
        </div>
        <div className="w-full">
          <h1 className="text-lg font-semibold mb-2">TV Show Genres</h1>
          <TvGenre tvGenres={tvGenres.genres} />
        </div>
        <div className="w-full">
          <h2 className="text-2xl my-4 font-bold">Trending TV Shows</h2>
          <HomeContentTile type={"tv"} data={TrendingTv} />
        </div>
        <div className="w-full">
          <h2 className="text-2xl my-4 font-bold">Romance</h2>
          <HomeContentTile type={"movie"} data={RomanceData} />
        </div>
        <div className="w-full">
          <h2 className="text-2xl my-4 font-bold">Action</h2>
          <HomeContentTile type={"movie"} data={ActionData} />
        </div>
      </div>
    </>
  );
}
