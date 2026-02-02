import MovieGenre from "@components/scroll/movieGenre";
import { tmdbFetchJson } from "@/utils/tmdb";
import { GenreList } from "@/staticData/genreList";

type GenreList = {
  genres: { id: number; name: string }[];
};

async function page({ children }: { children: React.ReactNode }) {
  const result = await tmdbFetchJson<GenreList>(
    `https://api.themoviedb.org/3/genre/movie/list?api_key=${process.env.TMDB_API_KEY}`,
    "Movie genre list",
    { next: { revalidate: 3600 } }
  );
  const genrelist = result.data?.genres ?? GenreList.genres;
  const isFallback = !result.data;
  return (
    <div>
      <div className="w-full max-w-7xl my-3 m-auto">
        <h1 className="text-lg font-semibold mb-2">Movie&apos;s Genre</h1>
        {result.error && (
          <p className="text-sm text-amber-200">{result.error}</p>
        )}
        {isFallback && (
          <p className="text-xs text-neutral-400">
            Showing cached genre list.
          </p>
        )}
        <MovieGenre genre={genrelist} />
      </div>
      <div>{children}</div>
    </div>
  );
}

export default page;
