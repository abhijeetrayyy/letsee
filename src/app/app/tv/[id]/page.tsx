import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import TvDetailClient from "./TvDetailClient";
import { Suspense } from "react";
import RelatedStream from "@components/detail/RelatedStream";
import { seriesCast } from "@/utils/title/tvCast";
import { seriesCrew } from "@/utils/title/tvCrew";
import { Countrydata } from "@/staticData/countryName";
import { parseRouteId } from "@/utils/urls";
import { pickLogoEntry } from "@/utils/title/logo";
import { absoluteUrl } from "@/utils/siteUrl";
import { titlePath } from "@/utils/urls";
import JsonLd from "@components/seo/JsonLd";
import { tvSeriesLd, breadcrumbLd } from "@/utils/structuredData";
import { shareImage } from "@/utils/shareImage";

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
export const revalidate = 86400;

/** Empty on purpose — see the movie page: this is what enables ISR. */
export async function generateStaticParams() {
  return [];
}

type PageProps = { params: Promise<{ id: string }> };


/**
 * Ten appended keys, well inside the twenty-remote-call cap append_to_response
 * enforces with a 400.
 *
 * `external_ids` is back on this list, and the round trip is worth recording.
 * It was dropped once for being fetched, handed to the client and read by
 * nothing — correct at the time. It returns because something now reads it: a
 * series payload carries no `imdb_id` of its own, and this is the only way to
 * offer the IMDb link that films have had for free all along.
 *
 * Watch providers cannot be appended at all — TMDB serves them
 * from `watch/providers`, with a slash, which append rejects — so Availability
 * fetches them itself, keyed on the reader's region so switching regions
 * actually changes the answer.
 *
 * `aggregate_credits` is the one key that earns its cost twice over: a series'
 * `credits.cast` is a stub, eight people for Breaking Bad against 348 here.
 * `images` carries the logo artwork the hero prints as its heading.
 */
async function getShow(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,images,recommendations,similar,keywords,content_ratings,aggregate_credits,reviews,external_ids`,
    "TV detail",
    {
      // Six hours, not a day: a running series carries `next_episode_to_air`,
      // which is the one fact here with a clock on it. Ten minutes was far
      // shorter than anything on this page actually changes, and it was capping
      // the whole page's cache at ten minutes.
      revalidate: 21600,
    }
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseRouteId(id);
  if (!numericId) return { title: "TV Show Not Found" };
  const result = await getShow(numericId);
  const show = result.data;
  if (!show) return { title: "TV Show Not Found" };

  const year = show.first_air_date ? String(show.first_air_date).slice(0, 4) : null;
  const title = year ? `${show.name} (${year})` : show.name;
  const description =
    (show.tagline && String(show.tagline).trim()) ||
    (show.overview ? String(show.overview).slice(0, 200) : "") ||
    `Where to watch ${show.name}, episode by episode, and what people thought.`;
  const canonical = absoluteUrl(titlePath("tv", show.id, show.name));
  const share = shareImage(show.backdrop_path, show.poster_path, show.name);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "video.tv_show",
      title,
      description,
      url: canonical,
      images: share.images,
    },
    twitter: {
      card: share.card,
      title,
      description,
      images: share.urls,
    },
  };
}

export default async function TvPage({ params }: PageProps) {
  const { id } = await params;
  const numericId = parseRouteId(id);
  if (!numericId) return notFound();

  const result = await getShow(numericId);
  const show = result.data;
  if (!show) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950 text-surface-300 p-4">
        <p>TV show data unavailable. Try refreshing.</p>
      </div>
    );
  }

  const credits = show.credits ?? { cast: [], crew: [] };
  // Series-level `credits.cast` is a stub — 8 people for Breaking Bad against
  // 348 in aggregate_credits, with no notion of how much of the show anyone is
  // actually in. Reduced to 20 here so the 143KB payload never reaches the
  // browser.
  const cast = seriesCast(show.aggregate_credits, credits.cast);
  // `credits.crew` is the same stub — zero rows on Grey's Anatomy against 247
  // in aggregate_credits, which is why the Crew section used to be missing
  // entirely on the longest-running show tested.
  const crew = seriesCrew(show.aggregate_credits, credits.crew);
  const videos = show.videos?.results ?? [];
  // Same trim as the movie page: MediaGallery reads `file_path` and nothing
  // else, and TMDB ships seven other fields per image.
  const justPath = (i: any) => ({ file_path: i.file_path });
  const backdrops = (show.images?.backdrops ?? []).map(justPath);
  const posters = (show.images?.posters ?? []).map(justPath);
  const keywords = show.keywords?.results ?? show.keywords?.keywords ?? [];
  const contentRatings = show.content_ratings?.results ?? [];
  const reviews = show.reviews?.results ?? [];

  const createdBy = show.created_by ?? [];
  const seasons = (show.seasons ?? []).filter((s: any) => s.name !== "Specials");
  const countryNames = (show.origin_country ?? []).flatMap((c: string) =>
    Countrydata.filter((item: any) => item.iso_3166_1 === c).map((i: any) => i.english_name)
  );

  const trailer = videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube")
    ?? videos.find((v: any) => v.site === "YouTube");

  /**
   * Every appended blob is already extracted into a prop of its own above, so
   * shipping the raw object to the browser sends each of them a second time —
   * and `aggregate_credits` alone is 348 people the client has no use for once
   * `seriesCast` has ranked twenty of them. Only `images.logos` survives the
   * trim, because the hero reads it; backdrops and posters travel as their own
   * props and would otherwise be duplicated too.
   */
  const { images, ...base } = show;
  const showForClient = {
    ...base,
    credits: undefined,
    videos: undefined,
    recommendations: undefined,
    similar: undefined,
    keywords: undefined,
    content_ratings: undefined,
    aggregate_credits: undefined,
    reviews: undefined,
    // One logo, chosen here. TMDB returns every language's wordmark — 61 for
    // The Matrix — and the client used to receive all of them so `pickLogo`
    // could throw sixty away. Selecting server-side is safe precisely because
    // that function is deterministic: one candidate, same answer.
    images: { logos: [pickLogoEntry(images)].filter(Boolean) },
  };

  // One ranked section replacing the two rails. `created_by` stands in for the
  // director here: series-level `credits.crew` lists one Directing entry out of
  // fifty, because who directed an episode is not a fact about the show.
  const relatedArgs = {
    id: Number(numericId),
    mediaType: "tv",
    title: show.name,
    keywords,
    people: createdBy.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })),
    collection: null,
    recommendations: show.recommendations?.results ?? [],
    similar: show.similar?.results ?? [],
  } as const;

  return (
    <>
      <JsonLd
        data={[
          tvSeriesLd(show),
          breadcrumbLd([
            { name: "TV", path: "/app/browse?type=tv" },
            { name: show.name, path: titlePath("tv", show.id, show.name) },
          ]),
        ]}
      />
    <div className="bg-surface-950 min-h-screen">
      <TvDetailClient
        show={showForClient}
        credits={{ crew }}
        cast={cast}
        trailer={trailer}
        videos={videos}
        contentRatings={contentRatings}
        backdrops={backdrops}
        posters={posters}
        keywords={keywords}
        seasons={seasons}
        createdBy={createdBy}
        countryNames={countryNames}
        reviews={reviews}
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        {/* Streamed: getRelated is 2.1–5.4s cold and sits at the bottom
            of the page. Nothing above it should wait. */}
        <Suspense fallback={null}>
          <RelatedStream {...relatedArgs} />
        </Suspense>
      </div>
    </div>
    </>
  );
}
