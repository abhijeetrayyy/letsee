import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import { parseRouteId, titlePath } from "@/utils/urls";
import { seriesCast } from "@/utils/title/tvCast";
import { seriesCrew } from "@/utils/title/tvCrew";
import { getSeriesPeople } from "@/utils/title/seriesPeople";
import type { Metadata } from "next";
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

interface PageProps {
  params: Promise<{ id: string }>;
}


async function getShowDetails(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/tv/${id}`,
    "TV show details",
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
 * `aggregate_credits`, not `credits`, and the gap is the whole reason this
 * function changed: measured live, Breaking Bad's `/credits` returns **8** cast
 * and 27 crew against **348** and 91 here. This is the page called "Cast &
 * Crew" — the one a reader opens precisely because the row on the detail page
 * was a summary — and it was showing a twentieth of the people while the detail
 * page beside it already showed more.
 *
 * The eight were not even the top eight. `credits` has no notion of how much of
 * a show anyone is in, so a one-episode guest sits beside the lead. Every
 * aggregate entry carries `total_episode_count`, which is what "main cast"
 * means for television and cannot be derived from billing order.
 *
 * Both are fetched. The page falls back to the stub for the handful of shows
 * TMDB holds no aggregate for.
 *
 * No cap on the cast here, unlike the twenty on the detail page's row. This
 * page is the place the full list is supposed to live — capping it would
 * reproduce the exact fault it exists to fix. Crew stays capped per
 * department, because ninety directors would otherwise bury the composer.
 *
 * Reduced before caching, as on the detail page: SVU's raw aggregate is 2.6MB,
 * over Next's data-cache limit, so fetched directly it was never cached and was
 * downloaded twice per render.
 */
async function getShowPeople(id: string) {
  return getSeriesPeople(id, {
    castLimit: Number.MAX_SAFE_INTEGER,
    crewPerDepartment: 12,
    revalidate: 86400,
  });
}

async function getShowCreditFallback(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/tv/${id}/credits?language=en-US`,
    "TV show credits",
    {
      // Top level, not `next: { revalidate }`. tmdbFetchJson reads it here and
      // ignores the nested form, so these calls were running `no-store` — which
      // was invisible until the page became static and Next refused to serve a
      // prerender that re-fetched on every request.
      revalidate: 86400,
    }
  );
}


/** Same idea as the movie cast page: name the people the page is about. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const rawId = (await params).id;
  const numericId = parseRouteId(rawId);
  if (!numericId) {
    return { title: "Cast & Crew", description: "Cast and crew information" };
  }

  const [showResult, peopleResult] = await Promise.all([
    getShowDetails(numericId),
    getShowPeople(numericId),
  ]);
  const show = showResult.data;
  if (!show?.name) {
    return {
      title: "Cast & Crew",
      description: showResult.error || "Cast and crew information",
    };
  }

  // The same ranked list the page body shows, so the names in the description
  // are the ones highest up the page rather than TMDB's billing order.
  const cast = (peopleResult.data?.cast ?? []).slice(0, 6);
  const creators: any[] = show.created_by ?? [];
  const leads = cast.map((c) => c.name);

  const title = `${show.name} — Cast & Crew`;
  const description = leads.length
    ? `Full cast and crew for ${show.name}${
        creators.length ? `, created by ${creators.map((c) => c.name).join(" & ")}` : ""
      }. Starring ${leads.join(", ")}.`
    : `Full cast and crew for ${show.name}.`;

  const canonical = `${titlePath("tv", numericId, show.name)}/cast`;
  const image = show.poster_path
    ? `https://image.tmdb.org/t/p/w780${show.poster_path}`
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

async function page({ params }: PageProps) {
  const rawId = (await params).id;
  const numericId = parseRouteId(rawId);
  if (!numericId) {
    return notFound();
  }

  const [showResult, peopleResult, stubResult] = await Promise.all([
    getShowDetails(numericId),
    getShowPeople(numericId),
    getShowCreditFallback(numericId),
  ]);

  const errors = [showResult.error, peopleResult.error].filter(
    Boolean
  ) as string[];

  if (!showResult.data || !peopleResult.data) {
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

  const show = showResult.data;
  const people = peopleResult.data;
  const cast = people.cast.length
    ? people.cast
    : seriesCast(undefined, stubResult.data?.cast, Number.MAX_SAFE_INTEGER);
  const crew = people.crew.length ? people.crew : seriesCrew(undefined, stubResult.data?.crew);
  return (
    <div className="min-h-screen bg-page">
      <CreditsHero
        mediaType="tv"
        id={show.id}
        title={show.name}
        posterPath={show.poster_path}
        backdropPath={show.backdrop_path}
        adult={show.adult}
      />
      <CreditsDirectory cast={cast} crew={crew} />
    </div>
  );
}

export default page;
