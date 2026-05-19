"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import toast from "react-hot-toast";
import LikeButton from "@components/reactions/LikeButton";
import { MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";

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
  } catch { return iso; }
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
    const params = new URLSearchParams({ itemId: String(itemId), itemType, page: String(page), limit: String(limit) });
    return fetch(`/api/reviews?${params}`)
      .then((res) => res.json())
      .then((body) => {
        if (body?.error) { setError(body.error); return; }
        setReviews(body?.reviews ?? []);
        setTotal(body?.total ?? 0);
        setError(null);
      })
      .catch(() => setError("Failed to load reviews"));
  }, [itemId, itemType, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetchReviews().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchReviews]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const deleteMyReview = async () => {
    if (!window.confirm("Delete this public review? It will no longer appear in Reviews.")) return;
    setDeletingId(-1);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: String(itemId), itemType, publicReviewText: null }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body?.error || "Failed to delete"); return; }
      toast.success("Public review deleted");
      await fetchReviews();
    } catch { toast.error("Failed to delete public review"); }
    finally { setDeletingId(null); }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasMore = page < totalPages;
  const hasPrev = page > 1;

  return (
    <div className="card-accent rounded-2xl p-5 animate-fade-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-surface-100">Community Reviews</h3>
          <p className="text-[10px] text-surface-500">
            {total > 0 ? `${total} review${total !== 1 ? "s" : ""} total` : "No reviews yet"}
          </p>
        </div>
      </div>

      {loading && reviews.length === 0 ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-surface-800/50 rounded-xl p-4">
              <div className="h-4 bg-surface-800 rounded w-32 mb-2" />
              <div className="h-12 bg-surface-800 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">{error}</p>
      ) : reviews.length === 0 ? (
        <div className="text-center py-6 bg-surface-800/30 rounded-xl">
          <MessageSquare className="w-6 h-6 text-surface-600 mx-auto mb-2" />
          <p className="text-xs text-surface-500">No public reviews yet. Be the first!</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {reviews.map((r) => {
              const isMine = currentUserId !== null && r.userId === currentUserId;
              return (
                <li key={r.id} className="bg-surface-800/30 rounded-xl p-4 hover:bg-surface-800/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {r.username ? (
                          <Link
                            href={`/app/profile/${r.username}`}
                            className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                          >
                            {r.username}
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-surface-500">Anonymous</span>
                        )}
                        <span className="text-[10px] text-surface-600">·</span>
                        <span className="text-[10px] text-surface-500">Watched {formatDate(r.watchedAt)}</span>
                      </div>
                      <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">{r.reviewText}</p>
                      <div className="mt-3">
                        <LikeButton targetType="review" targetId={r.id} size="sm" />
                      </div>
                    </div>
                    {isMine && (
                      <div className="flex sm:flex-col gap-1">
                        <button
                          onClick={() => { window.location.hash = "#edit-public-review"; document.getElementById("your-public-review")?.scrollIntoView({ behavior: "smooth" }); }}
                          className="btn-ghost text-xs !px-2.5 !py-1.5"
                        >
                          Edit
                        </button>
                        <button
                          onClick={deleteMyReview}
                          disabled={deletingId !== null}
                          className="btn-danger text-xs !px-2.5 !py-1.5"
                        >
                          {deletingId !== null ? "..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4 pt-4 divider">
              <button
                type="button"
                disabled={!hasPrev || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-ghost text-xs disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="text-[10px] text-surface-500 bg-surface-800/50 px-2.5 py-1 rounded-full">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={!hasMore || loading}
                onClick={() => setPage((p) => p + 1)}
                className="btn-ghost text-xs disabled:opacity-40"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
