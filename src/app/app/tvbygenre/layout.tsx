import TvGenre from "@components/scroll/tvGenre";
import { tmdbFetchJson } from "@/utils/tmdb";

const REVALIDATE_DAY = 86400;

async function page({ children }: { children: React.ReactNode }) {
  const result = await tmdbFetchJson<{ genres: { id: number; name: string }[] }>(
    `https://api.themoviedb.org/3/genre/tv/list?api_key=${process.env.TMDB_API_KEY}`,
    "TV genre list",
    { revalidate: REVALIDATE_DAY }
  );
  const genrelist = result.data?.genres ?? [];

  return (
    <div>
      <div className="w-full max-w-7xl my-3 m-auto">
        <h1 className="text-lg font-semibold mb-2">TV Show&apos;s Genre</h1>
        <TvGenre tvGenres={genrelist} />
      </div>
      <div>{children}</div>
    </div>
  );
}

export default page;
