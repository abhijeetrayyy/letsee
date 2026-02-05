import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// Types
type PageProps = {
  params: params;
};

type params = Promise<{ id: string }>;

interface MovieDetails {
  id: number;
  title: string;
  backdrop_path: string;
  poster_path: string;
  adult: boolean;
}

interface CastMember {
  id: number;
  name: string;
  profile_path: string | null;
  character: string;
}

interface CrewMember {
  id: number;
  name: string;
  profile_path: string | null;
  department: string;
}

interface CreditResponse {
  cast: CastMember[];
  crew: CrewMember[];
}

const getNumericId = (value: string) => {
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
};

type MovieWithCredits = MovieDetails & { credits?: CreditResponse };

/** Single TMDB call: movie details + credits (2 → 1). */
async function getMovieWithCredits(id: string) {
  return tmdbFetchJson<MovieWithCredits>(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits`,
    "Movie cast",
    { next: { revalidate: 3600 } }
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const rawId = (await params).id;
  const numericId = getNumericId(rawId);
  if (!numericId) {
    return {
      title: "Cast & Crew",
      description: "Cast and crew information",
    };
  }
  const movieResult = await getMovieWithCredits(numericId);
  const movie = movieResult.data;

  return {
    title: movie?.title ? `${movie.title} - Cast & Crew` : "Cast & Crew",
    description:
      movie?.title
        ? `Cast and crew information for ${movie.title}`
        : movieResult.error || "Cast and crew information",
  };
}

export default async function Page({ params }: PageProps) {
  const rawId = (await params).id;
  const numericId = getNumericId(rawId);
  if (!numericId) {
    return notFound();
  }

  const movieResult = await getMovieWithCredits(numericId);

  if (!movieResult.data || !movieResult.data.credits) {
    const errors = [movieResult.error].filter(Boolean) as string[];
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-200 p-4">
        <div className="max-w-xl text-center">
          <p className="text-lg font-semibold">Cast data unavailable.</p>
          {errors.length > 0 && (
            <ul className="mt-3 text-sm text-amber-200 list-disc list-inside">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-neutral-400">
            Try refreshing in a moment.
          </p>
        </div>
      </div>
    );
  }

  const movie = movieResult.data;
  const { cast, crew } = movieResult.data.credits!;

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-3 min-h-[200px] p-8">
          <LoadingSpinner size="lg" className="border-t-white" />
          <p className="text-neutral-400 text-sm animate-pulse">Loading cast…</p>
        </div>
      }
    >
      <div>
        <div className="relative flex flex-col items-center justify-center w-full min-h-[550px] h-full">
          <div className="absolute w-full h-full overflow-hidden">
            <div
              className="absolute inset-0 z-10"
              style={{
                background:
                  "linear-gradient(to left, #171717, transparent 60%, #171717, #171717)",
              }}
            />
            <img
              className="object-cover max-w-[2100px] w-full h-full m-auto opacity-20"
              src={
                movie.backdrop_path && !movie.adult
                  ? `https://image.tmdb.org/t/p/w300${movie.backdrop_path}`
                  : "/backgroundjpeg.webp"
              }
              width={300}
              height={300}
              alt={`${movie.title} backdrop`}
            />
          </div>

          <div className="max-w-6xl w-full p-6 relative z-10 flex flex-col md:flex-row gap-5">
            <div className="flex-1">
              <img
                className="rounded-md object-cover h-full max-h-[500px]"
                src={
                  movie.poster_path && !movie.adult
                    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
                    : movie.adult
                    ? "/pixeled.webp"
                    : "/no-photo.webp"
                }
                width={500}
                height={500}
                alt={`${movie.title} poster`}
              />
            </div>
            <div className="flex-2 w-full">
              <Link
                className="hover:text-neutral-200 hover:underline"
                href={`/app/movie/${movie.id}-${movie.title
                  .trim()
                  .replace(/[^a-zA-Z0-9]/g, "-")
                  .toLowerCase()
                  .replace(/-+/g, "-")}`}
              >
                <h1 className="text-xl font-bold">{movie.title}</h1>
              </Link>
              <span className="text-4xl font-bold mt-10 block">
                Cast ~ Crew
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-5xl w-full m-auto my-3">
          <h2 className="text-2xl font-bold mb-4">Cast ~</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {cast.map((item, index: number) => (
              <Link
                key={index}
                className="border border-neutral-900 bg-neutral-800 py-2 px-2 rounded-md hover:border-indigo-600 transition-colors"
                href={`/app/person/${item.id}-${item.name
                  .trim()
                  .replace(/[^a-zA-Z0-9]/g, "-")
                  .toLowerCase()
                  .replace(/-+/g, "-")}`}
              >
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <img
                    className="max-w-[100px] object-cover rounded-md h-full"
                    src={
                      item.profile_path
                        ? `https://image.tmdb.org/t/p/w92${item.profile_path}`
                        : "/avatar.svg"
                    }
                    width={92}
                    height={138}
                    alt={item.name}
                  />
                  <div className="flex flex-row gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    <span>-</span>
                    <p>{item.character}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="max-w-5xl w-full m-auto my-3">
            {crew.length > 0 && <h2 className="my-3 mt-10">Prod. ~ Crew</h2>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {crew?.map((item: any, index: number) => (
                <Link
                  className="flex flex-col items-center justify-center hover:opacity-75"
                  key={index}
                  href={`/app/person/${item.id}-${item.name
                    .trim()
                    .replace(/[^a-zA-Z0-9]/g, "-")
                    .replace(/-+/g, "-")}`}
                >
                  <div>
                    <img
                      className="w-32  md:min-h-44 h-full object-cover rounded-md"
                      src={
                        item.profile_path
                          ? `https://image.tmdb.org/t/p/w92${item.profile_path}`
                          : "/avatar.svg"
                      }
                      alt=""
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h1 className="text-center">{item.name}</h1>{" "}
                    <p className="text-center text-xs flex flex-col gap-1">
                      {item.department}{" "}
                      <span className="font-bold">({item.job})</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
