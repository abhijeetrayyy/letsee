import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import TvDetailClient from "./TvDetailClient";
import { Suspense } from "react";
import RelatedStream from "@components/detail/RelatedStream";
import { seriesCast } from "@/utils/title/tvCast";
import { seriesCrew } from "@/utils/title/tvCrew";
import { Countrydata } from "@/staticData/countryName";

type PageProps = { params: Promise<{ id: string }> };

function getNumericId(value: string) {
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
}

/**
 * Nine appended keys, well inside the twenty-remote-call cap append_to_response
 * enforces with a 400.
 *
 * `external_ids` came off this list: it was fetched, handed to the client and
 * read by nothing. Watch providers cannot be appended at all — TMDB serves them
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
    `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,images,recommendations,similar,keywords,content_ratings,aggregate_credits,reviews`,
    "TV detail",
    { revalidate: 600 }
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = getNumericId(id);
  if (!numericId) return { title: "TV Show Not Found" };
  const result = await getShow(numericId);
  const show = result.data;
  return {
    title: show?.name || "TV Show Not Found",
    description: show?.tagline || "Discover TV shows on LetSee",
    openGraph: {
      title: show?.name,
      description: show?.tagline,
      images: show?.poster_path ? [`https://image.tmdb.org/t/p/w342${show.poster_path}`] : [],
    },
  };
}

export default async function TvPage({ params }: PageProps) {
  const { id } = await params;
  const numericId = getNumericId(id);
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
  const backdrops = show.images?.backdrops ?? [];
  const posters = show.images?.posters ?? [];
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
    images: { logos: images?.logos ?? [] },
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
  );
}
