import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import MovieDetailClient from "./MovieDetailClient";
import { Countrydata } from "@/staticData/countryName";
import { Suspense } from "react";
import RelatedStream from "@components/detail/RelatedStream";
import { parseRouteId } from "@/utils/urls";
import { absoluteUrl } from "@/utils/siteUrl";
import { titlePath } from "@/utils/urls";
import JsonLd from "@components/seo/JsonLd";
import { movieLd, breadcrumbLd } from "@/utils/structuredData";

type PageProps = { params: Promise<{ id: string }> };


/**
 * Eight appended keys on one request.
 *
 * `append_to_response` caps at twenty remote calls — a twenty-first returns a
 * 400 rather than dropping the extra quietly — so there is room here, but the
 * budget is worth stating because two things people reach for cannot use it at
 * all. Watch providers live at `watch/providers`, with a slash, which append
 * does not accept; and a collection is its own resource. Both are fetched from
 * the client instead, by the components that need them.
 *
 * `images` is what carries the title's logo artwork. TMDB returns every
 * language's logo under that key with no `include_image_language` parameter,
 * which is why the hero can print a film's own wordmark without a second call.
 */
async function getMovie(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,images,recommendations,similar,keywords,release_dates,reviews`,
    "Movie detail",
    { revalidate: 3600 }
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseRouteId(id);
  if (!numericId) return { title: "Movie Not Found" };
  const result = await getMovie(numericId);
  const movie = result.data;
  if (!movie) return { title: "Movie Not Found" };

  const year = movie.release_date ? String(movie.release_date).slice(0, 4) : null;
  // The year disambiguates the many films that share a title, in the one place
  // a person scanning results actually reads.
  const title = year ? `${movie.title} (${year})` : movie.title;
  const description =
    (movie.tagline && String(movie.tagline).trim()) ||
    (movie.overview ? String(movie.overview).slice(0, 200) : "") ||
    `Where to watch ${movie.title}, what people thought of it, and who made it.`;
  const canonical = absoluteUrl(titlePath("movie", movie.id, movie.title));
  const poster = movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : null;

  return {
    title,
    description,
    // Points at the slugged form, so an index consolidates there rather than
    // treating /app/movie/550 and /app/movie/550-fight-club as two pages.
    alternates: { canonical },
    openGraph: {
      type: "video.movie",
      title,
      description,
      url: canonical,
      images: poster ? [{ url: poster, width: 780, height: 1170, alt: movie.title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: poster ? [poster] : [],
    },
  };
}

export default async function MoviePage({ params }: PageProps) {
  const { id } = await params;
  const numericId = parseRouteId(id);
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
  const directors = credits.crew?.filter((c: any) => c.job === "Director") ?? [];
  const originCountries = movie.origin_country ?? [];
  const countryNames = originCountries.flatMap((c: string) =>
    Countrydata.filter((item: any) => item.iso_3166_1 === c).map((i: any) => i.english_name)
  );

  const releaseDates = movie.release_dates?.results ?? [];
  const reviews = movie.reviews?.results ?? [];

  /**
   * Every appended blob above is already extracted into a prop of its own, so
   * handing the raw object to the browser would send each of them a second
   * time — `images` in particular carries every backdrop and poster TMDB holds,
   * which MediaGallery already receives directly. Only `images.logos` survives,
   * because the hero reads it to print the film's own wordmark.
   */
  const { images, ...base } = movie;
  const movieForClient = {
    ...base,
    credits: undefined,
    videos: undefined,
    recommendations: undefined,
    similar: undefined,
    keywords: undefined,
    release_dates: undefined,
    reviews: undefined,
    images: { logos: images?.logos ?? [] },
  };

  // One ranked, reasoned section in place of the two rails that used to render
  // TMDB's `recommendations` and `similar` lists side by side without saying
  // why anything was in either. Both lists already arrive on the single
  // append_to_response call above, so the pool costs nothing.
  const relatedArgs = {
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
  } as const;


  const trailer = videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube")
    ?? videos.find((v: any) => v.site === "YouTube");

  return (
    <>
      {/* Served in the HTML, not added on hydration — crawlers read the former. */}
      <JsonLd
        data={[
          movieLd(movie),
          breadcrumbLd([
            { name: "Films", path: "/app/browse" },
            { name: movie.title, path: titlePath("movie", movie.id, movie.title) },
          ]),
        ]}
      />
    <div className="bg-surface-950 min-h-screen">
      <MovieDetailClient
        movie={movieForClient}
        directors={directors}
        credits={credits}
        trailer={trailer}
        videos={videos}
        releaseDates={releaseDates}
        countryNames={countryNames}
        backdrops={backdrops}
        posters={posters}
        keywords={keywords}
        collection={collection}
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
