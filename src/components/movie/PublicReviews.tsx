"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import toast from "react-hot-toast";

interface ReviewItem {
  id: number;
  userId: string;
  username: string | null;
  reviewText: string;
  watchedAt: string;
}

interface PublicReviewsProps {
  itemId: number | string;
  itemType: "movie" | "tv";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function PublicReviews({ itemId, itemType }: PublicReviewsProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const limit = 10;

  const fetchReviews = useCallback(() => {
    const params = new URLSearchParams({
      itemId: String(itemId),
      itemType,
      page: String(page),
      limit: String(limit),
    });
    return fetch(`/api/reviews?${params}`)
      .then((res) => res.json())
      .then((body) => {
        if (body?.error) {
          setError(body.error);
          return;
        }
        setReviews(body?.reviews ?? []);
        setTotal(body?.total ?? 0);
        setError(null);
      })
      .catch(() => setError("Failed to load reviews"));
  }, [itemId, itemType, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchReviews().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchReviews]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const scrollToEditForm = () => {
    window.location.hash = "#edit-public-review";
    document.getElementById("your-public-review")?.scrollIntoView({ behavior: "smooth" });
  };

  const deleteMyReview = async () => {
    if (!window.confirm("Delete this public review? It will no longer appear in Reviews.")) return;
    setDeletingId(-1);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: String(itemId),
          itemType,
          publicReviewText: null,
        }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Failed to delete");
        return;
      }
      toast.success("Public review deleted");
      await fetchReviews();
    } catch {
      toast.error("Failed to delete public review");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasMore = page < totalPages;
  const hasPrev = page > 1;

  return (
    <div className="my-6">
      <h3 className="text-neutral-200 font-semibold text-lg mb-1">Reviews</h3>
      <p className="text-neutral-500 text-sm mb-3">
        Public reviews from everyone who watched this. Add yours above in <strong className="text-neutral-400">Your public review</strong>.
      </p>
      {loading && reviews.length === 0 ? (
        <p className="text-neutral-500 text-sm">Loading reviews…</p>
      ) : error ? (
        <p className="text-amber-200 text-sm">{error}</p>
      ) : reviews.length === 0 ? (
        <p className="text-neutral-500 text-sm">No public reviews yet. Mark as Watched and add one in Your public review above.</p>
      ) : (
        <>
          <ul className="space-y-4">
            {reviews.map((r) => {
              const isMine = currentUserId !== null && r.userId === currentUserId;
              return (
                <li
                  key={r.id}
                  className="p-4 rounded-lg bg-neutral-800/60 border border-neutral-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {r.username ? (
                          <Link
                            href={`/app/profile/${r.username}`}
                            className="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                          >
                            {r.username}
                          </Link>
                        ) : (
                          <span className="text-neutral-400 font-medium text-sm">Anonymous</span>
                        )}
                        <span className="text-neutral-500 text-xs">
                          Watched {formatDate(r.watchedAt)}
                        </span>
                      </div>
                      <p className="text-neutral-300 text-sm whitespace-pre-wrap">{r.reviewText}</p>
                    </div>
                    {isMine && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={scrollToEditForm}
                          className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-600 text-sm font-medium rounded-lg transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={deleteMyReview}
                          disabled={deletingId !== null}
                          className="px-3 py-1.5 text-red-300 hover:text-red-200 hover:bg-red-900/30 text-sm font-medium rounded-lg transition disabled:opacity-60"
                        >
                          {deletingId !== null ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={!hasPrev || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded bg-neutral-700 text-neutral-200 text-sm disabled:opacity-50 hover:bg-neutral-600 transition"
              >
                Previous
              </button>
              <span className="text-neutral-400 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={!hasMore || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded bg-neutral-700 text-neutral-200 text-sm disabled:opacity-50 hover:bg-neutral-600 transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
