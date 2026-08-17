import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import TvDetailClient from "./TvDetailClient";
import { Suspense } from "react";
import RelatedStream from "@components/detail/RelatedStream";
import { seriesCast } from "@/utils/title/tvCast";

type PageProps = { params: Promise<{ id: string }> };

function getNumericId(value: string) {
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
}

async function getShow(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,images,external_ids,recommendations,similar,keywords,content_ratings,aggregate_credits`,
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
  const videos = show.videos?.results ?? [];
  const backdrops = show.images?.backdrops ?? [];
  const posters = show.images?.posters ?? [];
  const keywords = show.keywords?.results ?? show.keywords?.keywords ?? [];
  const externalIds = show.external_ids ?? {};
  const contentRatings = show.content_ratings?.results ?? [];
  // See the note on the movie route: `watch_providers` is not a valid append
  // key and never returned anything.

  const createdBy = show.created_by ?? [];
  const seasons = (show.seasons ?? []).filter((s: any) => s.name !== "Specials");

  const trailer = videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube")
    ?? videos.find((v: any) => v.site === "YouTube");


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
        show={show}
        credits={credits}
        cast={cast}
        trailer={trailer}
        videos={videos}
        contentRatings={contentRatings}
        backdrops={backdrops}
        posters={posters}
        keywords={keywords}
        externalIds={externalIds}
        seasons={seasons}
        createdBy={createdBy}
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
