"use client";

import Link from "next/link";
import { useState, useContext } from "react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import MarkTVWatchedModal from "@components/tv/MarkTVWatchedModal";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";

type RecentItem = {
  id: number;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  watched_at: string;
  review_text?: string | null;
};

const NO_POSTER = "/no-photo.webp";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w185";

/** Build full poster URL: DB may store path (e.g. /abc.jpg) or full URL */
function getPosterUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl?.trim()) return NO_POSTER;
  const u = imageUrl.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const path = u.startsWith("/") ? u.slice(1) : u;
  return `${TMDB_POSTER_BASE}/${path}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function RecentActivityStrip({
  items,
}: {
  items: RecentItem[];
}) {
  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
        Recent activity
      </h3>
      {!items?.length ? (
        <p className="text-neutral-500 text-sm py-8 text-center rounded-xl bg-neutral-800/30 border border-neutral-700/50">
          No recent activity yet. Watched titles and ratings will show here.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 pretty-scrollbar">
          {items.map((it) => {
            const itemHref = `/app/${it.item_type}/${it.item_id}`;
            const imgSrc = getPosterUrl(it.image_url);
            const snippet = it.review_text?.trim()
              ? it.review_text.slice(0, 50) +
                (it.review_text.length > 50 ? "…" : "")
              : null;
            return (
              <ActivityCard
                key={it.id}
                href={itemHref}
                imgSrc={imgSrc}
                itemName={it.item_name}
                watchedAt={it.watched_at}
                snippet={snippet}
                reviewText={it.review_text ?? undefined}
                itemId={it.item_id}
                itemType={it.item_type}
                imageUrl={it.image_url}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  href,
  imgSrc,
  itemName,
  watchedAt,
  snippet,
  reviewText,
  itemId,
  itemType,
  imageUrl,
}: {
  href: string;
  imgSrc: string;
  itemName: string;
  watchedAt: string;
  snippet: string | null;
  reviewText?: string | null;
  itemId: string;
  itemType: string;
  imageUrl: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const [tvModalOpen, setTvModalOpen] = useState(false);
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const src = imgError ? NO_POSTER : imgSrc;

  return (
    <div className="group shrink-0 w-28 sm:w-32 flex flex-col rounded-xl overflow-hidden border border-neutral-700/60 bg-neutral-800/50 hover:border-amber-500/40 transition-all duration-200">
      <Link href={href} className="block">
        <div className="aspect-2/3 overflow-hidden bg-neutral-800">
          <img
            src={src}
            alt={itemName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        </div>
        <div className="p-2.5 flex-1 min-h-0">
          <p
            className="text-white text-sm font-medium truncate"
            title={itemName}
          >
            {itemName}
          </p>
          <p className="text-neutral-500 text-[10px] mt-0.5">
            {formatDate(watchedAt)}
          </p>
          {snippet && (
            <p
              className="text-neutral-400 text-[10px] line-clamp-1 mt-1"
              title={reviewText ?? undefined}
            >
              {snippet}
            </p>
          )}
        </div>
      </Link>

      {/* Preference Buttons Strip */}
      <div className="border-t border-white/5 bg-neutral-900">
        <ThreePrefrenceBtn
          variant="compact"
          cardId={itemId}
          cardType={itemType}
          cardName={itemName}
          cardImg={imageUrl}
          genres={[]}
          onAddWatchedTv={
            itemType === "tv" ? () => setTvModalOpen(true) : undefined
          }
        />
      </div>

      {itemType === "tv" && (
        <MarkTVWatchedModal
          showId={itemId}
          showName={itemName}
          seasons={[]}
          isOpen={tvModalOpen}
          onClose={() => setTvModalOpen(false)}
          onSuccess={() => {
            setTvModalOpen(false);
            refreshPreferences?.();
          }}
          watchedPayload={{
            itemId: Number(itemId),
            name: itemName,
            imgUrl: imageUrl ?? "",
            adult: false,
            genres: [],
          }}
        />
      )}
    </div>
  );
}
