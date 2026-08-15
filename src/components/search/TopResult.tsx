"use client";

import Link from "next/link";
import { useState } from "react";
import { Star, Calendar } from "lucide-react";
import { releaseInfo } from "@/utils/releaseInfo";
import StatusControl from "@components/buttons/StatusControl";
import EpisodeManagementModal from "@components/tv/EpisodeManagementModal";
import type { MediaStatus } from "@/app/contextAPI/userPrefrence";

export type TopResultItem = {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title: string;
  posterPath?: string | null;
  year?: string | null;
  /** Raw TMDB date. Preferred over `year` — it can say "not out yet". */
  releaseDate?: string | null;
  rating?: number | null;
  voteCount?: number | null;
  overview?: string | null;
  knownFor?: string | null;
  genres?: string[];
};

function slug(title: string) {
  return title.trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-");
}

const TYPE_LABEL: Record<string, string> = { movie: "Film", tv: "TV series", person: "Person" };

/**
 * The single result the query most likely meant, answered outright.
 *
 * Searching a title like "inception" returns four things called Inception, and
 * a uniform grid makes you compare posters to work out which is the one you
 * know. This states it — year, type, rating, and the opening line of the plot —
 * and lets you log it without opening anything.
 */
export default function TopResult({ item }: { item: TopResultItem }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MediaStatus | null>(null);

  const href = `/app/${item.mediaType}/${item.id}${item.title ? `-${slug(item.title)}` : ""}`;
  const release = releaseInfo(item.releaseDate);
  const img = item.posterPath
    ? `https://image.tmdb.org/t/p/${item.mediaType === "person" ? "h632" : "w342"}${item.posterPath}`
    : null;

  return (
    <section className="mb-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500 mb-2.5">
        Top result
      </h2>

      <div className="rounded-2xl border border-surface-700/50 bg-surface-900/50 p-4 sm:p-5 flex gap-4 sm:gap-5">
        <Link href={href} className="shrink-0 group">
          <div className="w-24 sm:w-32 aspect-[2/3] rounded-xl overflow-hidden bg-surface-800 border border-surface-700/40">
            {img ? (
              <img
                src={img}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-surface-600 text-xs">
                No image
              </div>
            )}
          </div>
        </Link>

        <div className="min-w-0 flex-1 flex flex-col">
          <Link href={href} className="group">
            <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight group-hover:text-brand-400 transition-colors">
              {item.title}
            </h3>
          </Link>

          {/* .meta-row draws the separators via ::before, so a dot never
              strands at the end of a wrapped line and a missing year (people
              have none) can't leave a leading one. */}
          <div className="meta-row mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-surface-400">
            {(item.year ?? release.year) && (
              <span className="tabular-nums">{item.year ?? release.year}</span>
            )}
            <span>{TYPE_LABEL[item.mediaType]}</span>
            {item.rating != null && item.rating > 0 && (
              <span className="inline-flex items-center gap-1 text-accent-gold">
                <Star className="size-3.5 fill-current" aria-hidden />
                {item.rating.toFixed(1)}
                {/* A 10.0 from three people is not a 10.0. */}
                {item.voteCount != null && item.voteCount > 0 && (
                  <span className="text-surface-500 text-xs">
                    ({item.voteCount.toLocaleString()})
                  </span>
                )}
              </span>
            )}
            {item.knownFor && <span>{item.knownFor}</span>}
          </div>

          {release.isUpcoming && (
            <p className="mt-2 inline-flex max-w-fit items-center gap-1.5 text-sm font-medium text-brand-400">
              <Calendar className="size-3.5 shrink-0" aria-hidden />
              {item.mediaType === "tv" ? "Premieres" : "Out"} {release.full}
            </p>
          )}

          {item.overview && (
            <p className="mt-2.5 text-sm text-surface-400 line-clamp-2 sm:line-clamp-3">
              {item.overview}
            </p>
          )}

          {item.mediaType !== "person" && (
            <div className="mt-auto pt-3.5 flex items-center gap-2">
              <StatusControl
                itemId={item.id}
                mediaType={item.mediaType}
                name={item.title}
                imgUrl={item.posterPath ?? undefined}
                genres={item.genres ?? []}
                variant="detail"
                onWatchedTv={
                  item.mediaType === "tv"
                    ? (intended) => {
                        setPendingStatus(intended);
                        setModalOpen(true);
                      }
                    : undefined
                }
              />
              <Link
                href={href}
                className="inline-flex items-center px-4 py-2.5 rounded-xl bg-surface-800/60 text-surface-300 hover:text-white border border-surface-700/50 text-sm font-medium transition-colors"
              >
                Details
              </Link>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <EpisodeManagementModal
          showId={String(item.id)}
          showName={item.title}
          isOpen={modalOpen}
          intendedStatus={pendingStatus}
          onClose={() => {
            setModalOpen(false);
            setPendingStatus(null);
          }}
          onSuccess={() => {
            setModalOpen(false);
            setPendingStatus(null);
          }}
        />
      )}
    </section>
  );
}
