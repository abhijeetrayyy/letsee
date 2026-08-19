"use client";

import { formatStars } from "@/utils/ratingScale";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { swrFetcher } from "@/utils/swrFetcher";
import { getPosterUrl } from "@/utils/imageUrl";
import { reviewPath, titlePath } from "@/utils/urls";


function detailHref(mediaType: string, id: string, title: string): string {
  return titlePath(mediaType, Number(id), title);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

type ReviewItem = {
  id: number;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  watched_at: string;
  score: number | null;
  public_review_text: string | null;
};

export default function ReviewsSection({
  userId,
  isOwner = false,
}: {
  userId: string;
  isOwner?: boolean;
}) {
  const [page, setPage] = useState(1);

  const { data, error, isLoading, mutate } = useSWR<{ data: ReviewItem[]; totalPages: number }>(
    `/api/profile/public-reviews?userId=${encodeURIComponent(userId)}&page=${page}&limit=12`,
    swrFetcher,
  );
  const items = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const loading = isLoading;

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-sm text-surface-500 animate-pulse">Loading reviews…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-12 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-red-300">Couldn’t load reviews.</p>
        <button
          onClick={() => mutate()}
          className="text-xs px-3 py-1.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/50 p-12 text-center">
        <div className="text-4xl mb-4">✍️</div>
        <p className="text-surface-400 text-sm">
          {isOwner
            ? "No reviews yet. Write a review on any movie or TV page to see it here."
            : "No reviews yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item) => {
          const href = detailHref(item.item_type, item.item_id, item.item_name);
          const posterUrl = getPosterUrl(item.image_url, "w185");

          return (
            <div
              key={item.id}
              className="group flex gap-4 p-4 rounded-xl border border-surface-700/60 bg-surface-900/40 hover:border-surface-500/60 transition-all duration-300"
            >
              {/* Poster */}
              <Link href={href} className="shrink-0 w-24 aspect-[2/3] rounded-lg overflow-hidden">
                <img
                  src={posterUrl}
                  alt={item.item_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </Link>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div>
                  <Link
                    href={href}
                    className="text-base font-semibold text-surface-100 hover:text-brand-400 transition-colors line-clamp-1"
                  >
                    {item.item_name}
                  </Link>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {item.item_type === "tv" ? "TV Series" : "Movie"} · {formatDate(item.watched_at)}
                  </p>
                </div>

                {/* Rating */}
                {item.score != null && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span
                        key={i}
                        className={`text-sm ${
                          i < item.score! ? "text-accent-gold" : "text-surface-700"
                        }`}
                      >
                        ★
                      </span>
                    ))}
                    <span className="text-xs text-surface-400 ml-1">
                      {formatStars(item.score)}
                    </span>
                  </div>
                )}

                {/* Review Text */}
                {item.public_review_text && (
                  <p className="text-sm text-surface-300 leading-relaxed line-clamp-4">
                    {item.public_review_text}
                  </p>
                )}

                {/* The review's own page — where it can be replied to. */}
                <Link
                  href={reviewPath(item.id, item.item_name)}
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors mt-auto"
                >
                  Read &amp; discuss →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-surface-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
