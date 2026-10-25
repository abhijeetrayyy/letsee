import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import { parseRouteId, titlePath } from "@/utils/urls";
import CreditsHero from "@components/detail/CreditsHero";
import CreditsDirectory from "@components/detail/CreditsDirectory";

/** Impersonal HTML; see the movie page for why this is cached. */
/**
 * A day, not an hour.
 *
 * Raised from 3600 after the deployment pause, and the reason it is safe is
 * that this cached HTML holds almost nothing that changes: TMDB facts, the
 * credits, the structured data. Everything live on the page — who is here,
 * your rating, watch providers, the takes — is fetched by the client after
 * hydration and is never part of what gets cached.
 *
 * So the trade is 24x fewer renders against a TMDB fact being at most a day
 * old, and TMDB facts do not change hourly. A deploy invalidates the whole
 * cache anyway, so the staleness window only ever runs from the last deploy.
 */
/**
 * A week. This is TMDB data about a finished thing — a cast list, a runtime, a
 * release year — and it does not change on any cadence a person would notice.
 *
 * The number is a write frequency, not a freshness setting. Every time this
 * window expires and the page is requested again, Vercel bills another ISR
 * write unit. At 24h a page somebody visits weekly costs 7 writes a week; at
 * 7d it costs 1. That difference was invisible next to crawler traffic and is
 * most of the remaining bill without it.
 *
 * Redeploy to purge if TMDB corrects something and the wait is too long.
 */
export const revalidate = 604800;

/** Empty on purpose — see the movie page: this is what enables ISR. */
export async function generateStaticParams() {
  return [];
}

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
    `https://api.themoviedb.org/3/movie/${id}?append_to_response=credits`,
    "Movie cast",
    {
      // Top level, not `next: { revalidate }`. tmdbFetchJson reads it here and
      // ignores the nested form, so these calls were running `no-store` — which
      // was invisible until the page became static and Next refused to serve a
      // prerender that re-fetched on every request.
      revalidate: 86400,
    }
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
      <div className="min-h-screen flex items-center justify-center bg-raised text-ink-200 p-4">
        <div className="max-w-sheet text-center">
          <p className="text-lg font-semibold">Cast data unavailable.</p>
          {errors.length > 0 && (
            <ul className="mt-3 text-sm text-ink-100 list-disc list-inside">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-ink-400">
            Try refreshing in a moment.
          </p>
        </div>
      </div>
    );
  }

  const movie = movieResult.data;
  const { cast, crew } = movieResult.data.credits!;

  return (
    <div className="min-h-screen bg-page">
      <CreditsHero
        mediaType="movie"
        id={movie.id}
        title={movie.title}
        posterPath={movie.poster_path}
        backdropPath={movie.backdrop_path}
        adult={movie.adult}
      />
      <CreditsDirectory cast={cast} crew={crew} />
    </div>
  );
}
