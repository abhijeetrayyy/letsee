"use client";

import Link from "next/link";
import { useState } from "react";
import StatusControl from "@components/buttons/StatusControl";
import EpisodeManagementModal from "@components/tv/EpisodeManagementModal";
import type { MediaStatus } from "@/app/contextAPI/userPrefrence";

import { titlePath } from "@/utils/urls";
type TrackedPosterCardProps = {
  itemId: string;
  itemType: string;
  itemName: string;
  imageUrl: string | null;
  genres?: string[];
  /** Border tint so a row keeps its identity (amber = watching, purple = later). */
  accent?: string;
  /** Only the owner gets controls — on someone else's profile a status button
      would read as editing their list rather than your own. */
  interactive?: boolean;
};

/**
 * A poster in the profile's Currently Watching / Watch Later rows.
 *
 * These used to be plain links. They are the two places where you are most
 * likely to want to move something along — a show you're watching is the show
 * you just finished — and there was no way to do it without opening the title.
 * For a series the status control routes through the episode modal, same as
 * everywhere else.
 */
export default function TrackedPosterCard({
  itemId,
  itemType,
  itemName,
  imageUrl,
  genres = [],
  accent = "group-hover:border-brand-500/30",
  interactive = false,
}: TrackedPosterCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MediaStatus | null>(null);

  return (
    <div className="shrink-0 w-32">
      <Link href={titlePath(itemType, itemId, itemName)} className="group block">
        <div className={`aspect-[2/3] rounded-xl overflow-hidden bg-surface-800 border border-surface-700/30 transition-all ${accent}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={itemName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-surface-600 text-xs">
              {itemType}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-xs text-surface-300 line-clamp-2 group-hover:text-white transition-colors">
          {itemName}
        </p>
      </Link>

      {interactive && (
      <div className="mt-1.5 h-9 rounded-lg overflow-hidden bg-surface-900/70 border border-surface-800">
        <StatusControl
          itemId={itemId}
          mediaType={itemType}
          name={itemName}
          imgUrl={imageUrl ?? undefined}
          genres={genres}
          variant="compact"
          onWatchedTv={
            itemType === "tv"
              ? (intended) => {
                  setPendingStatus(intended);
                  setModalOpen(true);
                }
              : undefined
          }
        />
      </div>
      )}

      {modalOpen && (
        <EpisodeManagementModal
          showId={itemId}
          showName={itemName}
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
    </div>
  );
}
