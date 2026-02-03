"use client";

import Link from "next/link";
import { useState } from "react";

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
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Recent activity</h3>
      {!items?.length ? (
        <p className="text-neutral-500 text-sm py-8 text-center rounded-xl bg-neutral-800/30 border border-neutral-700/50">
          No recent activity yet. Watched titles and ratings will show here.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          {items.map((it) => {
            const itemHref = `/app/${it.item_type}/${it.item_id}`;
            const imgSrc = getPosterUrl(it.image_url);
            const snippet = it.review_text?.trim() ? it.review_text.slice(0, 50) + (it.review_text.length > 50 ? "…" : "") : null;
            return (
              <ActivityCard
                key={it.id}
                href={itemHref}
                imgSrc={imgSrc}
                itemName={it.item_name}
                watchedAt={it.watched_at}
                snippet={snippet}
                reviewText={it.review_text ?? undefined}
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
}: {
  href: string;
  imgSrc: string;
  itemName: string;
  watchedAt: string;
  snippet: string | null;
  reviewText?: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const src = imgError ? NO_POSTER : imgSrc;

  return (
    <Link
      href={href}
      className="group shrink-0 w-28 sm:w-32 rounded-xl overflow-hidden border border-neutral-700/60 bg-neutral-800/50 hover:border-amber-500/40 hover:scale-[1.02] transition-all duration-200"
    >
      <div className="aspect-2/3 overflow-hidden bg-neutral-800">
        <img
          src={src}
          alt={itemName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={() => setImgError(true)}
        />
      </div>
      <div className="p-2.5">
        <p className="text-white text-sm font-medium truncate" title={itemName}>
          {itemName}
        </p>
        <p className="text-neutral-500 text-xs mt-0.5">{formatDate(watchedAt)}</p>
        {snippet && (
          <p className="text-neutral-400 text-xs truncate mt-1" title={reviewText ?? undefined}>
            {snippet}
          </p>
        )}
      </div>
    </Link>
  );
}
