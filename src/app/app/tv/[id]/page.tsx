import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import TvDetailClient from "./TvDetailClient";
import MovieRecoTile from "@components/movie/recoTiles";

type PageProps = { params: Promise<{ id: string }> };

function getNumericId(value: string) {
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
}

async function getShow(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,images,external_ids,recommendations,similar,keywords,content_ratings,watch_providers`,
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
  const videos = show.videos?.results ?? [];
  const backdrops = show.images?.backdrops ?? [];
  const posters = show.images?.posters ?? [];
  const keywords = show.keywords?.results ?? show.keywords?.keywords ?? [];
  const externalIds = show.external_ids ?? {};
  const contentRatings = show.content_ratings?.results ?? [];
  const watchProviders = show.watch_providers?.results?.US ?? null;
  const flatrateProviders = watchProviders?.flatrate ?? [];

  const recoData = show.recommendations ?? { total_results: 0, results: [] };
  const similarData = show.similar ?? { total_results: 0, results: [] };
  const createdBy = show.created_by ?? [];
  const seasons = (show.seasons ?? []).filter((s: any) => s.name !== "Specials");

  const trailer = videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube")
    ?? videos.find((v: any) => v.site === "YouTube");

  const usRating = contentRatings.find((r: any) => r.iso_3166_1 === "US");
  const certification = usRating?.rating ?? null;

  return (
    <div className="bg-surface-950 min-h-screen">
      <TvDetailClient
        show={show}
        credits={credits}
        trailer={trailer}
        certification={certification}
        backdrops={backdrops}
        posters={posters}
        keywords={keywords}
        externalIds={externalIds}
        seasons={seasons}
        createdBy={createdBy}
        watchProviders={flatrateProviders}
        watchLink={watchProviders?.link ?? ""}
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        {recoData.total_results > 0 && (
          <MovieRecoTile type="tv" title={show.name} data={recoData} sectionTitle="More like this" />
        )}
        {similarData.total_results > 0 && (
          <MovieRecoTile type="tv" title={show.name} data={similarData} sectionTitle="Similar shows" />
        )}
      </div>
    </div>
  );
}
