"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function slug(title: string): string {
  return title
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-");
}

function detailHref(mediaType: string, id: string, title: string): string {
  const s = slug(title);
  return `/app/${mediaType}/${Number(id)}${s ? `-${s}` : ""}`;
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
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/profile/public-reviews?userId=${encodeURIComponent(userId)}&page=${page}&limit=12`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data.data ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-sm text-surface-500 animate-pulse">Loading reviews…</p>
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
          const posterUrl = item.image_url
            ? `https://image.tmdb.org/t/p/w185${item.image_url}`
            : "/no-photo.webp";

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
                      {item.score}/10
                    </span>
                  </div>
                )}

                {/* Review Text */}
                {item.public_review_text && (
                  <p className="text-sm text-surface-300 leading-relaxed line-clamp-4">
                    {item.public_review_text}
                  </p>
                )}

                {/* Read More Link */}
                <Link
                  href={href}
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors mt-auto"
                >
                  Read full review →
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
