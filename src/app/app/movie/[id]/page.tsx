import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import MovieDetailClient from "./MovieDetailClient";
import { Countrydata } from "@/staticData/countryName";
import RelatedSection from "@components/detail/RelatedSection";
import { getRelated } from "@/utils/relatedData";

type PageProps = { params: Promise<{ id: string }> };

function getNumericId(value: string) {
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
}

async function getMovie(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,images,recommendations,similar,keywords,release_dates,watch_providers`,
    "Movie detail",
    { revalidate: 3600 }
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = getNumericId(id);
  if (!numericId) return { title: "Movie Not Found" };
  const result = await getMovie(numericId);
  const movie = result.data;
  return {
    title: movie?.title || "Movie Not Found",
    description: movie?.tagline || "Discover movies on LetSee",
    openGraph: {
      title: movie?.title,
      description: movie?.tagline,
      images: movie?.poster_path ? [`https://image.tmdb.org/t/p/w342${movie.poster_path}`] : [],
    },
  };
}

export default async function MoviePage({ params }: PageProps) {
  const { id } = await params;
  const numericId = getNumericId(id);
  if (!numericId) return notFound();

  const result = await getMovie(numericId);
  const movie = result.data;
  if (!movie) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950 text-surface-300 p-4">
        <p>Movie data unavailable. Try refreshing.</p>
      </div>
    );
  }

  const credits = movie.credits ?? { cast: [], crew: [] };
  const videos = movie.videos?.results ?? [];
  const backdrops = movie.images?.backdrops ?? [];
  const posters = movie.images?.posters ?? [];
  const keywords = movie.keywords?.keywords ?? movie.keywords?.results ?? [];
  const collection = movie.belongs_to_collection ?? null;
  const watchProviders = movie.watch_providers?.results?.US ?? null;
  const flatrateProviders = watchProviders?.flatrate ?? [];
  const directors = credits.crew?.filter((c: any) => c.job === "Director") ?? [];
  const originCountries = movie.origin_country ?? [];
  const countryNames = originCountries.flatMap((c: string) =>
    Countrydata.filter((item: any) => item.iso_3166_1 === c).map((i: any) => i.english_name)
  );

  const releaseDates = movie.release_dates?.results ?? [];

  // One ranked, reasoned section in place of the two rails that used to render
  // TMDB's `recommendations` and `similar` lists side by side without saying
  // why anything was in either. Both lists already arrive on the single
  // append_to_response call above, so the pool costs nothing.
  const related = await getRelated({
    // `numericId`, not `id` — the route param is "497-The-Green-Mile", and
    // Number() of that is NaN, which would stop the seed excluding itself.
    id: Number(numericId),
    mediaType: "movie",
    title: movie.title,
    keywords,
    people: directors.map((d: { id: number; name: string }) => ({ id: d.id, name: d.name })),
    collection: collection ? { id: collection.id, name: collection.name } : null,
    recommendations: movie.recommendations?.results ?? [],
    similar: movie.similar?.results ?? [],
  });

  // Find US certification
  const usRelease = releaseDates.find((r: any) => r.iso_3166_1 === "US");
  const certification = usRelease?.release_dates?.find((d: any) => d.certification)?.certification ?? null;

  const trailer = videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube")
    ?? videos.find((v: any) => v.site === "YouTube");

  return (
    <div className="bg-surface-950 min-h-screen">
      <MovieDetailClient
        movie={movie}
        directors={directors}
        credits={credits}
        trailer={trailer}
        videos={videos}
        certification={certification}
        countryNames={countryNames}
        backdrops={backdrops}
        posters={posters}
        keywords={keywords}
        collection={collection}
        watchProviders={flatrateProviders}
        watchLink={watchProviders?.link ?? ""}
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        <RelatedSection items={related} />
      </div>
    </div>
  );
}
