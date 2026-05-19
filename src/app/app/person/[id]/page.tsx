import { Suspense } from "react";
import Link from "next/link";
import { FaInstagram, FaXTwitter } from "react-icons/fa6";
import { FaImdb } from "react-icons/fa";
import { HiOutlineGlobeAlt } from "react-icons/hi2";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PersonCredits from "@/components/person/server/personCredits";
import Biography from "@/components/person/client/Biography";
import KnowFor from "@/components/person/KnowFor";
import PersonPhotos from "@/components/person/PersonPhotos";
import { tmdbFetchJson } from "@/utils/tmdb";
import { Calendar, MapPin, Film, Tv, Star, ExternalLink } from "lucide-react";

const REVALIDATE_DAY = 86400;
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

async function fetchPersonFull(id: string) {
  return tmdbFetchJson<Record<string, unknown>>(
    `https://api.themoviedb.org/3/person/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US&append_to_response=external_ids,combined_credits,images`,
    "Person full",
    { revalidate: REVALIDATE_DAY }
  );
}

type CastItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  vote_count?: number;
  vote_average?: number;
  popularity?: number;
  genre_ids?: number[];
  adult?: boolean;
  character?: string;
};

function getKnownFor(cast: CastItem[]): CastItem[] {
  return (cast ?? [])
    .filter((item) => !item.adult)
    .sort((a, b) => {
      const votesA = (a.vote_count ?? 0) * (a.vote_average ?? 0) + (a.popularity ?? 0) * 10;
      const votesB = (b.vote_count ?? 0) * (b.vote_average ?? 0) + (b.popularity ?? 0) * 10;
      return votesB - votesA;
    })
    .slice(0, 12);
}

function calcFilmographyStats(cast: CastItem[], crew: CastItem[]) {
  const totalCredits = cast.length + crew.length;
  const movieCount = cast.filter((c) => c.media_type === "movie").length + crew.filter((c) => c.media_type === "movie").length;
  const tvCount = cast.filter((c) => c.media_type === "tv").length + crew.filter((c) => c.media_type === "tv").length;
  const allRated = [...cast, ...crew].filter((c) => c.vote_average != null && c.vote_average > 0);
  const avgRating = allRated.length > 0
    ? (allRated.reduce((sum, c) => sum + (c.vote_average ?? 0), 0) / allRated.length).toFixed(1)
    : null;
  const years = new Set(
    [...cast, ...crew]
      .map((c) => {
        const d = c.release_date || c.first_air_date;
        return d ? new Date(d).getFullYear() : null;
      })
      .filter((y): y is number => y !== null)
  );
  const yearSpan = years.size > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : null;
  return { totalCredits, movieCount, tvCount, avgRating, yearSpan };
}

type Params = Promise<{ id: string }>;
interface PageProps {
  params: Params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = id ? String(id).split("-")[0] : "";
  if (!numericId || !/^\d+$/.test(numericId)) {
    return { title: "Person" };
  }
  try {
    const personResult = await fetchPersonFull(numericId);
    const person = personResult.data as { name?: string; profile_path?: string | null; biography?: string } | undefined;
    if (!person?.name) return { title: "Person" };
    const profilePath = person.profile_path;
    const ogImage = profilePath
      ? `${TMDB_IMAGE_BASE}/w500${profilePath.startsWith("/") ? profilePath : `/${profilePath}`}`
      : undefined;
    const description =
      typeof person.biography === "string" && person.biography.length > 0
        ? person.biography.slice(0, 160).trim() + (person.biography.length > 160 ? "…" : "")
        : `Profile for ${person.name}`;
    return {
      title: `${person.name} | Letsee`,
      description,
      openGraph: {
        title: `${person.name} | Letsee`,
        description,
        ...(ogImage && { images: [{ url: ogImage, width: 500, height: 750, alt: person.name }] }),
      },
      twitter: { card: "summary_large_image", title: person.name, description },
    };
  } catch {
    return { title: "Person" };
  }
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  if (!id) return notFound();

  const numericId = String(id).split("-")[0];
  if (!/^\d+$/.test(numericId)) return notFound();

  try {
    const personResult = await fetchPersonFull(numericId);
    if (personResult.error || !personResult.data) {
      throw new Error(personResult.error ?? "Failed to fetch person details");
    }

    const data = personResult.data as Record<string, unknown>;
    const person = data as {
      name?: string;
      profile_path?: string | null;
      biography?: string;
      birthday?: string;
      deathday?: string | null;
      place_of_birth?: string;
      known_for_department?: string;
      also_known_as?: string[];
      homepage?: string | null;
    };

    const credits = (data.combined_credits ?? { cast: [], crew: [] }) as { cast: unknown[]; crew: unknown[] };
    const { cast = [], crew = [] } = credits;
    const castList = cast as CastItem[];
    const knownFor = getKnownFor(castList);
    const stats = calcFilmographyStats(castList, crew as CastItem[]);

    const externalIds = (data.external_ids ?? {}) as {
      twitter_id?: string;
      instagram_id?: string;
      imdb_id?: string;
    };

    const imagesData = data.images as { profiles?: { file_path: string; vote_average?: number }[] } | undefined;
    const profilesRaw = (imagesData?.profiles ?? []) as { file_path: string; vote_average?: number }[];
    const profiles = [...profilesRaw].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));

    const profileImageUrl = person.profile_path
      ? `${TMDB_IMAGE_BASE}/h632${person.profile_path.startsWith("/") ? person.profile_path : `/${person.profile_path}`}`
      : null;

    return (
      <div className="min-h-screen bg-surface-950 text-white">
        {/* Hero */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 via-surface-950 to-surface-950" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="flex flex-col md:flex-row gap-8 md:gap-10 items-start">
              {/* Profile Photo */}
              <div className="shrink-0 w-full md:w-auto">
                <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt={person.name ?? "Person"}
                      className="w-full max-w-[300px] aspect-[2/3] object-cover"
                    />
                  ) : (
                    <div className="w-full max-w-[300px] aspect-[2/3] bg-surface-800 flex items-center justify-center">
                      <span className="text-surface-500 text-sm">No photo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                  {person.name}
                </h1>
                {person.known_for_department && (
                  <span className="inline-block mt-3 px-3 py-1 rounded-full bg-brand-500/15 text-brand-400 text-sm font-medium border border-brand-500/25">
                    {person.known_for_department}
                  </span>
                )}

                {/* Social Links */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {externalIds?.imdb_id && (
                    <Link href={`https://www.imdb.com/name/${externalIds.imdb_id}`} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl glass-card hover:border-amber-500/40 text-amber-400 transition-colors" aria-label="IMDb">
                      <FaImdb className="w-5 h-5" />
                    </Link>
                  )}
                  {person.homepage && (
                    <Link href={person.homepage} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl glass-card hover:border-surface-600/50 text-surface-400 hover:text-white transition-colors" aria-label="Official website">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}
                  {externalIds?.twitter_id && (
                    <Link href={`https://x.com/${externalIds.twitter_id}`} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl glass-card hover:border-surface-600/50 text-surface-400 hover:text-white transition-colors" aria-label="X (Twitter)">
                      <FaXTwitter className="w-4 h-4" />
                    </Link>
                  )}
                  {externalIds?.instagram_id && (
                    <Link href={`https://instagram.com/${externalIds.instagram_id}`} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl glass-card hover:border-surface-600/50 text-surface-400 hover:text-white transition-colors" aria-label="Instagram">
                      <FaInstagram className="w-4 h-4" />
                    </Link>
                  )}
                </div>

                {/* Bio Meta */}
                <dl className="mt-4 space-y-1.5 text-sm text-surface-400">
                  {person.birthday && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-surface-600" />
                      <span>Born {person.birthday}</span>
                    </div>
                  )}
                  {person.deathday && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-surface-600" />
                      <span>Died {person.deathday}</span>
                    </div>
                  )}
                  {person.place_of_birth && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-surface-600" />
                      <span>{person.place_of_birth}</span>
                    </div>
                  )}
                  {person.also_known_as && person.also_known_as.length > 0 && (
                    <div>
                      <span className="text-surface-600">Also known as: </span>
                      <span className="text-surface-300">{person.also_known_as.slice(0, 5).join(", ")}</span>
                      {person.also_known_as.length > 5 && (
                        <span className="text-surface-600"> +{person.also_known_as.length - 5} more</span>
                      )}
                    </div>
                  )}
                </dl>

                {/* Filmography Stats */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="pill-glass text-sm flex items-center gap-1">
                    <Film className="w-3.5 h-3.5" />
                    {stats.totalCredits} credits
                  </span>
                  <span className="pill-glass text-sm flex items-center gap-1">
                    <Film className="w-3.5 h-3.5" />
                    {stats.movieCount} movies
                  </span>
                  <span className="pill-glass text-sm flex items-center gap-1">
                    <Tv className="w-3.5 h-3.5" />
                    {stats.tvCount} shows
                  </span>
                  {stats.avgRating && (
                    <span className="pill-glass text-sm flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-accent-gold fill-accent-gold" />
                      {stats.avgRating} avg
                    </span>
                  )}
                  {stats.yearSpan && (
                    <span className="pill-glass text-sm">{stats.yearSpan}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Biography */}
            {person.biography && (
              <div className="mt-8 glass-card rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-1 h-5 rounded-full bg-brand-500 shrink-0" />
                  <h2 className="text-lg font-bold text-white">Biography</h2>
                </div>
                <Biography biography={person.biography} />
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
          {/* Known For */}
          {knownFor.length > 0 && (
            <section aria-label="Known for">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Known For</h2>
                  <p className="text-sm text-surface-500 mt-0.5">Most popular works</p>
                </div>
              </div>
              <KnowFor castData={knownFor} />
            </section>
          )}

          {/* Photos */}
          {profiles.length > 0 && (
            <section aria-label="Photos">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Photos</h2>
                  <p className="text-sm text-surface-500 mt-0.5">{profiles.length} images</p>
                </div>
              </div>
              <PersonPhotos name={person.name ?? "Person"} profiles={profiles} />
            </section>
          )}

          {/* Full Credits */}
          <Suspense fallback={<div className="w-full h-48 flex justify-center items-center text-surface-500">Loading credits…</div>}>
            <PersonCredits cast={castList} crew={crew as CastItem[]} name={person.name ?? ""} knownFor={knownFor} />
          </Suspense>
        </div>
      </div>
    );
  } catch (err) {
    const message = (err as Error).message ?? "";
    if (message.includes("404")) return notFound();
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950 text-white p-4">
        <div className="glass-card rounded-2xl p-8 max-w-xl text-center">
          <p className="text-lg font-semibold text-white">Person unavailable</p>
          <p className="mt-3 text-sm text-amber-200">{message || "Could not load this person."}</p>
          <p className="mt-3 text-sm text-surface-500">Try again later.</p>
        </div>
      </div>
    );
  }
}
