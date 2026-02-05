"use client";

import MediaCard, { mediaCardHref } from "@/components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatReviewedDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

type ReviewItem = {
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  item_adult: boolean;
  public_review_text: string | null;
  watched_at: string;
};

export default function ProfilePublicReviews({
  userId,
  isOwner = false,
}: {
  userId: string;
  isOwner?: boolean;
}) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/profile/public-reviews?userId=${encodeURIComponent(userId)}&page=${p}&limit=20`
        );
        if (!res.ok) throw new Error("Failed to fetch reviews");
        const data = await res.json();
        setItems((prev) => (p === 1 ? data.data : [...prev, ...data.data]));
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchReviews(page);
  }, [fetchReviews, page]);

  const loadMore = useCallback(() => {
    if (page < totalPages && !loading) setPage((p) => p + 1);
  }, [page, totalPages, loading]);

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">
        {isOwner ? "My reviews" : "Reviews"}
      </h2>
      <p className="text-sm text-neutral-400 mb-4">
        {isOwner
          ? "Titles you’ve written a public review for. Edit or remove reviews on each title’s page."
          : "Public reviews by this user."}
      </p>
      {loading && items.length === 0 ? (
        <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 p-8 flex flex-col items-center justify-center gap-3 min-h-[160px]">
          <LoadingSpinner size="md" className="border-t-white shrink-0" />
          <p className="text-neutral-500 text-sm animate-pulse">Loading reviews…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 p-6 text-center">
          <p className="text-neutral-400 text-sm">
            {isOwner
              ? "No public reviews yet. Add a review on any movie or TV show from your Watched list (open the title → write a public review)."
              : "No public reviews yet."}
          </p>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((item) => {
          const detailHref = mediaCardHref(
            item.item_type,
            Number(item.item_id),
            item.item_name
          );
          const reviewSnippet =
            item.public_review_text &&
            (item.public_review_text.length > 120
              ? item.public_review_text.slice(0, 120).trim() + "…"
              : item.public_review_text);
          const subtitle = (
            <>
              <span className="block text-xs text-neutral-500">
                Reviewed {formatReviewedDate(item.watched_at)}
              </span>
              {reviewSnippet && (
                <span className="block text-xs text-neutral-400 line-clamp-3 mt-1 leading-relaxed">
                  {reviewSnippet}
                </span>
              )}
              {isOwner && (
                <Link
                  href={detailHref}
                  className="inline-block text-xs text-amber-500 hover:text-amber-400 mt-2 font-medium"
                >
                  Edit review
                </Link>
              )}
            </>
          );
          return (
            <MediaCard
              key={`${item.item_id}-${item.item_type}`}
              id={Number(item.item_id)}
              title={item.item_name}
              mediaType={item.item_type as "movie" | "tv"}
              imageUrl={
                item.item_adult
                  ? "/pixeled.webp"
                  : item.image_url
                    ? `https://image.tmdb.org/t/p/w185/${item.image_url}`
                    : null
              }
              adult={item.item_adult}
              genres={[]}
              showActions={false}
              typeLabel={item.item_type}
              subtitle={subtitle}
            />
          );
        })}
      </div>
      {items.length < totalItems && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            aria-busy={loading}
            className="px-6 py-2.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 min-w-[140px] transition-all duration-200 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                <span>Loading…</span>
              </>
            ) : (
              "Load more reviews"
            )}
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}
