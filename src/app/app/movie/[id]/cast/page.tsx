import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { parseRouteId, personPath, titlePath } from "@/utils/urls";

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


type MovieWithCredits = MovieDetails & { credits?: CreditResponse };

/** Single TMDB call: movie details + credits (2 → 1). */
async function getMovieWithCredits(id: string) {
  return tmdbFetchJson<MovieWithCredits>(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits`,
    "Movie cast",
    { next: { revalidate: 3600 } }
  );
}

/**
 * "who played X in Y" is a search this page can actually win, and it could not
 * while the description was the phrase "Cast and crew information for Y" — a
 * sentence containing none of the names the page is about. Now the top-billed
 * names are in the description, which is both better for search and more
 * useful to a person deciding whether to click.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const rawId = (await params).id;
  const numericId = parseRouteId(rawId);
  if (!numericId) {
    return { title: "Cast & Crew", description: "Cast and crew information" };
  }
  const movieResult = await getMovieWithCredits(numericId);
  const movie = movieResult.data;

  if (!movie?.title) {
    return {
      title: "Cast & Crew",
      description: movieResult.error || "Cast and crew information",
    };
  }

  const cast = movie.credits?.cast ?? [];
  const directors = (movie.credits?.crew ?? []).filter(
    (c: any) => c.job === "Director",
  );
  const leads = cast.slice(0, 6).map((c) => c.name);

  const title = `${movie.title} — Cast & Crew`;
  const description = leads.length
    ? `Full cast and crew for ${movie.title}${
        directors.length ? `, directed by ${directors.map((d: any) => d.name).join(" & ")}` : ""
      }. Starring ${leads.join(", ")}${cast.length > leads.length ? ` and ${cast.length - leads.length} more` : ""}.`
    : `Full cast and crew for ${movie.title}.`;

  const canonical = `${titlePath("movie", numericId, movie.title)}/cast`;
  const image = movie.poster_path
    ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
    : null;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      images: image ? [{ url: image, width: 780, height: 1170, alt: title }] : [],
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : [] },
  };
}

export default async function Page({ params }: PageProps) {
  const rawId = (await params).id;
  const numericId = parseRouteId(rawId);
  if (!numericId) {
    return notFound();
  }

  const movieResult = await getMovieWithCredits(numericId);

  if (!movieResult.data || !movieResult.data.credits) {
    const errors = [movieResult.error].filter(Boolean) as string[];
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900 text-surface-200 p-4">
        <div className="max-w-xl text-center">
          <p className="text-lg font-semibold">Cast data unavailable.</p>
          {errors.length > 0 && (
            <ul className="mt-3 text-sm text-amber-200 list-disc list-inside">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-surface-400">
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
          <p className="text-surface-400 text-sm animate-pulse">Loading cast…</p>
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
                className="hover:text-surface-200 hover:underline"
                href={titlePath("movie", movie.id, movie.title)}
              >
                <h1 className="text-xl font-bold">{movie.title}</h1>
              </Link>
              <span className="text-4xl font-bold mt-10 block">
                Cast &amp; Crew
              </span>
            </div>
          </div>
        </div>

        {/* Same shape as the series cast page, because they are the same page
            for two media types and had drifted into two different designs —
            this one still carried indigo borders and a "Cast ~ Crew" heading
            from before the palette existed. */}
        <div className="mx-auto my-3 w-full max-w-6xl px-4 pb-16">
          {cast.length > 0 && (
            <>
              <div className="mb-4 flex items-baseline gap-2">
                <div className="h-5 w-1 rounded-full bg-brand-500" />
                <div>
                  <h2 className="text-lg font-bold text-white">Cast</h2>
                  <p className="text-xs text-surface-500">{cast.length} people</p>
                </div>
              </div>
              <div className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cast.map((item) => (
                  <Link
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-surface-800/50 bg-surface-900/30 p-2.5 transition-colors hover:border-brand-500/40 hover:bg-surface-800/40"
                    href={personPath(item.id, item.name)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="size-14 shrink-0 rounded-lg object-cover"
                      src={
                        item.profile_path
                          ? `https://image.tmdb.org/t/p/w185${item.profile_path}`
                          : "/avatar.svg"
                      }
                      alt=""
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.name}</p>
                      {item.character && (
                        <p className="truncate text-xs text-surface-400">{item.character}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {crew.length > 0 && (
            <>
              <div className="mb-4 flex items-baseline gap-2">
                <div className="h-5 w-1 rounded-full bg-brand-500" />
                <div>
                  <h2 className="text-lg font-bold text-white">Crew</h2>
                  <p className="text-xs text-surface-500">{crew.length} people</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {crew.map((item: any, index: number) => (
                  <Link
                    className="group flex flex-col items-center"
                    key={`${item.id}-${item.job ?? ""}-${index}`}
                    href={personPath(item.id, item.name)}
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="size-full object-cover transition-opacity group-hover:opacity-80"
                        src={
                          item.profile_path
                            ? `https://image.tmdb.org/t/p/w342${item.profile_path}`
                            : "/avatar.svg"
                        }
                        alt={item.name}
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-2 text-center text-sm text-white">{item.name}</p>
                    <p className="text-center text-xs text-surface-500">
                      {item.job || item.department}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Suspense>
  );
}
