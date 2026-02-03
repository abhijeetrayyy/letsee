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

const REVALIDATE_DAY = 86400;
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/** Single TMDB call for person page: details + external_ids, combined_credits, images (4 → 1). */
async function fetchPersonFull(id: string) {
  return tmdbFetchJson<Record<string, unknown>>(
    `https://api.themoviedb.org/3/person/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US&append_to_response=external_ids,combined_credits,images`,
    "Person full",
    { revalidate: REVALIDATE_DAY }
  );
}

/** TMDB combined_credits cast item. */
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

/** Derive "Known For" from combined_credits cast: sort by impact (votes × rating + popularity), filter adult, take top 12. */
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
      <div className="min-h-screen w-full bg-neutral-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,40,0.06),transparent)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
          {/* Hero */}
          <section className="flex flex-col md:flex-row gap-8 md:gap-10 items-start">
            <div className="shrink-0 w-full md:w-auto">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={person.name ?? "Person"}
                  width={300}
                  height={450}
                  className="rounded-2xl object-cover w-full max-w-[300px] aspect-[2/3] shadow-xl ring-1 ring-neutral-700/50"
                />
              ) : (
                <div className="w-full max-w-[300px] aspect-[2/3] rounded-2xl bg-neutral-800 flex items-center justify-center ring-1 ring-neutral-700/50">
                  <span className="text-neutral-500 text-sm">No photo</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">
                {person.name}
              </h1>
              {person.known_for_department && (
                <p className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium mb-4">
                  {person.known_for_department}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {externalIds?.imdb_id && (
                  <Link
                    href={`https://www.imdb.com/name/${externalIds.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 transition-colors"
                    aria-label="IMDb"
                  >
                    <FaImdb className="w-6 h-6" />
                  </Link>
                )}
                {person.homepage && (
                  <Link
                    href={person.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors border border-neutral-700/60"
                    aria-label="Official website"
                  >
                    <HiOutlineGlobeAlt className="w-5 h-5" />
                  </Link>
                )}
                {externalIds?.twitter_id && (
                  <Link
                    href={`https://x.com/${externalIds.twitter_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors border border-neutral-700/60"
                    aria-label="X (Twitter)"
                  >
                    <FaXTwitter className="w-5 h-5" />
                  </Link>
                )}
                {externalIds?.instagram_id && (
                  <Link
                    href={`https://instagram.com/${externalIds.instagram_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors border border-neutral-700/60"
                    aria-label="Instagram"
                  >
                    <FaInstagram className="w-5 h-5" />
                  </Link>
                )}
              </div>
              {person.also_known_as && person.also_known_as.length > 0 && (
                <p className="text-sm text-neutral-400 mb-3">
                  <span className="text-neutral-500">Also known as</span>{" "}
                  <span className="text-neutral-300">{person.also_known_as.slice(0, 5).join(", ")}</span>
                  {person.also_known_as.length > 5 && (
                    <span className="text-neutral-500"> (+{person.also_known_as.length - 5} more)</span>
                  )}
                </p>
              )}
              <dl className="text-sm text-neutral-400 space-y-1.5 mb-6">
                {person.birthday && (
                  <div>
                    <span className="text-neutral-500">Born</span>{" "}
                    <span className="text-neutral-300">{person.birthday}</span>
                  </div>
                )}
                {person.deathday && (
                  <div>
                    <span className="text-neutral-500">Died</span>{" "}
                    <span className="text-neutral-300">{person.deathday}</span>
                  </div>
                )}
                {person.place_of_birth && (
                  <div>
                    <span className="text-neutral-500">From</span>{" "}
                    <span className="text-neutral-300">{person.place_of_birth}</span>
                  </div>
                )}
              </dl>
              {person.biography && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-2">Biography</h2>
                  <Biography biography={person.biography} />
                </div>
              )}
            </div>
          </section>

          {/* Known For — from combined_credits, sorted by impact */}
          {knownFor.length > 0 && (
            <section aria-label="Known for">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
                Known for
              </h2>
              <KnowFor castData={knownFor} />
            </section>
          )}

          {/* Photos — TMDB person images (profiles) */}
          {profiles.length > 0 && (
            <section aria-label="Photos">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
                Photos
              </h2>
              <PersonPhotos name={person.name ?? "Person"} profiles={profiles} />
            </section>
          )}

          {/* Full credits (timeline + crew) */}
          <Suspense
            fallback={
              <div className="w-full h-48 flex justify-center items-center text-neutral-500">
                Loading credits…
              </div>
            }
          >
            <PersonCredits
              cast={castList}
              crew={(crew ?? []) as CastItem[]}
              name={person.name ?? ""}
              knownFor={knownFor}
            />
          </Suspense>
        </div>
      </div>
    );
  } catch (err) {
    const message = (err as Error).message ?? "";
    if (message.includes("404")) return notFound();
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-200 p-4">
        <div className="max-w-xl text-center">
          <p className="text-lg font-semibold text-white">Person unavailable</p>
          <p className="mt-3 text-sm text-amber-200">{message || "Could not load this person."}</p>
          <p className="mt-3 text-sm text-neutral-400">Try again later.</p>
        </div>
      </div>
    );
  }
}
