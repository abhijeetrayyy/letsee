import Link from "@components/ui/AppLink";
import React from "react";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import { parseRouteId, titlePath, personPath } from "@/utils/urls";
import { seriesCast } from "@/utils/title/tvCast";
import { seriesCrew } from "@/utils/title/tvCrew";
import type { Metadata } from "next";

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
    `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}`,
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
 * Both are fetched. `seriesCast` and `seriesCrew` fall back to the stub for the
 * handful of shows TMDB holds no aggregate for.
 */
async function getShowCredit(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/tv/${id}/aggregate_credits?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
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

async function getShowCreditFallback(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/tv/${id}/credits?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
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

  const [showResult, creditsResult] = await Promise.all([
    getShowDetails(numericId),
    getShowCredit(numericId),
  ]);
  const show = showResult.data;
  if (!show?.name) {
    return {
      title: "Cast & Crew",
      description: showResult.error || "Cast and crew information",
    };
  }

  // Through the same helper the page body uses, so the names in the description
  // are the ones highest up the page rather than TMDB's billing order.
  const cast = seriesCast(creditsResult.data, undefined, 6);
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

  const [showResult, creditsResult, stubResult] = await Promise.all([
    getShowDetails(numericId),
    getShowCredit(numericId),
    getShowCreditFallback(numericId),
  ]);

  const errors = [showResult.error, creditsResult.error].filter(
    Boolean
  ) as string[];

  if (!showResult.data || !creditsResult.data) {
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

  const show = showResult.data;
  /**
   * No cap on the cast here, unlike the twenty on the detail page's row. This
   * page is the place the full list is supposed to live — capping it would
   * reproduce the exact fault it exists to fix. Crew stays capped per
   * department, because ninety directors would otherwise bury the composer.
   */
  const cast = seriesCast(creditsResult.data, stubResult.data?.cast, Number.MAX_SAFE_INTEGER);
  const crew = seriesCrew(creditsResult.data, stubResult.data?.crew, 12);
  return (
    <div>
      <div className="relative w-full flex flex-col  overflow-y-clip justify-center items-center min-h-[590px]">
        <div className="absolute w-full  h-full overflow-hidden">
          <div
            className="absolute inset-0 z-10 bg-linear-to-r from-surface-900 via-transparent to-surface-900"
            style={{
              background:
                "linear-gradient(to left,  #171717, transparent 60%, #171717, #171717)",
            }}
          ></div>
          <div
            className="absolute inset-0 z-10 bg-linear-to-l from-surface-900 via-transparent to-surface-900"
            style={{
              background:
                "linear-gradient(to right,  #171717, transparent 60%, #171717, #171717)",
            }}
          ></div>
          <img loading="lazy" decoding="async"
            className="object-cover max-w-[2100px] w-full h-full  m-auto opacity-20"
            src={`${
              show.backdrop_path && !show.adult
                ? `https://image.tmdb.org/t/p/w300${show.backdrop_path}`
                : "/backgroundjpeg.webp"
            }`}
            width={300}
            height={300}
            alt=""
          />
        </div>

        <div className="z-10 relative flex flex-row gap-5 py-3 px-6 w-full max-w-6xl">
          <div className="flex-1">
            <img loading="lazy" decoding="async"
              className="min-h-[500px] rounded-md"
              src={
                show.adult
                  ? "/pixeled.webp"
                  : `https://image.tmdb.org/t/p/w342${show.poster_path}`
              }
              alt={show.name}
            />
          </div>
          <div className="flex-2">
            <h1 className="text-4xl font-bold mb-4">
              {" "}
              {show?.adult && (
                <span className="text-sm px-3 py-1 rounded-md m-2 bg-red-600 text-white z-20">
                  Adult
                </span>
              )}
              <Link
                className="hover:text-surface-200 hover:underline"
                href={titlePath("tv", show.id, show.name)}
              >
                <h1 className="text-xl font-bold">{show.name}</h1>
              </Link>
            </h1>

            <div className="text-5xl font-bold my-3">Cast &amp; Crew</div>
            {/* <div className="mb-4  text-gray-400">
              <span>Staring: </span>
              {cast?.slice(0, 5).map((item: any, index: number) =>
                cast?.slice(0, 5).length - 1 > index ? (
                  <Link
                    key={item.id}
                    className={
                      " inline-block hover:underline  px-1 whitespace-nowrap"
                    }
                    href={`/app/person/${item.id}`}
                  >
                    {item.name},
                  </Link>
                ) : (
                  <Link
                    key={item.id}
                    className={
                      " inline-block hover:underline px-1 whitespace-nowrap"
                    }
                    href={`/app/person/${item.id}`}
                  >
                    {item.name}
                  </Link>
                )
              )}
            </div> */}
          </div>
        </div>
      </div>
      <div className="mx-auto my-3 w-full max-w-6xl px-4 pb-16">
        {cast.length > 0 && (
          <>
            <div className="mb-4 flex items-baseline gap-2">
              <div className="h-5 w-1 rounded-full bg-brand-500" />
              <div>
                <h2 className="text-lg font-bold text-white">Cast</h2>
                {/* The count is the point of this page now. It used to say 8. */}
                <p className="text-xs text-surface-500">{cast.length} across the series</p>
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
                    {item.episodeCount > 0 && (
                      /* What `credits` could never tell you, and the only honest
                         way to read a 348-name list: who was actually in it. */
                      <p className="mt-0.5 text-[11px] tabular-nums text-surface-500">
                        {item.episodeCount} episode{item.episodeCount === 1 ? "" : "s"}
                      </p>
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
              {crew.map((item) => (
                <Link
                  className="group flex flex-col items-center"
                  key={`${item.id}-${item.job ?? item.department ?? ""}`}
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
  );
}

export default page;
