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
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

type RowItem = {
  item_id: string;
  item_type: string;
  item_name: string;
  watched_at: string;
  score: number | null;
  public_review_text: string | null;
  review_text: string | null;
};

export default function ProfileReviewsRatingsDiaryRows({
  userId,
  isOwner = false,
}: {
  userId: string;
  isOwner?: boolean;
}) {
  const [items, setItems] = useState<RowItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/profile/reviews-ratings-diary?userId=${encodeURIComponent(userId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const { data } = await res.json();
      setItems(data ?? []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 p-6 flex flex-col items-center justify-center gap-3 min-h-[100px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-sm text-neutral-500 animate-pulse">Loading…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/50 p-6 text-center">
        <p className="text-neutral-400 text-sm">
          {isOwner
            ? "No reviews, ratings or diary entries yet. Add them on any movie or TV page from your Watched list."
            : "No reviews or ratings yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/50 overflow-hidden">
      {/* Header row — visible on larger screens */}
      <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-3 bg-neutral-800/80 border-b border-neutral-700/60 text-xs font-medium text-neutral-400 uppercase tracking-wide">
        <div className="sm:col-span-4">Title</div>
        <div className="sm:col-span-1 text-center">Rating</div>
        <div className={isOwner ? "sm:col-span-4" : "sm:col-span-7"}>Public review</div>
        {isOwner && <div className="sm:col-span-3">Your diary</div>}
      </div>

      {items.map((row) => {
        const href = detailHref(row.item_type, row.item_id, row.item_name);
        const reviewSnippet =
          row.public_review_text &&
          (row.public_review_text.length > 200
            ? row.public_review_text.slice(0, 200).trim() + "…"
            : row.public_review_text);
        const diarySnippet =
          row.review_text &&
          (row.review_text.length > 200
            ? row.review_text.slice(0, 200).trim() + "…"
            : row.review_text);

        return (
          <div
            key={`${row.item_id}-${row.item_type}`}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 px-4 py-4 border-b border-neutral-700/40 last:border-b-0 hover:bg-neutral-700/20 transition-colors"
          >
            <div className="sm:col-span-4 min-w-0">
              <Link
                href={href}
                className="text-white font-medium hover:text-amber-400 transition-colors line-clamp-2"
              >
                {row.item_name}
              </Link>
              <span className="text-xs text-neutral-500 mt-0.5 block">
                {row.item_type} · {formatDate(row.watched_at)}
              </span>
            </div>
            <div className="sm:col-span-1 flex sm:justify-center items-start">
              <span className="sm:hidden text-xs text-neutral-500 mr-2">Rating:</span>
              {row.score != null ? (
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 text-sm font-medium">
                  {row.score}/10
                </span>
              ) : (
                <span className="text-neutral-600 text-sm">—</span>
              )}
            </div>
            <div className={`min-w-0 ${isOwner ? "sm:col-span-4" : "sm:col-span-7"}`}>
              <span className="sm:hidden text-xs text-neutral-500 block mb-1">Public review:</span>
              {reviewSnippet ? (
                <p className="text-sm text-neutral-300 leading-relaxed line-clamp-3">
                  {reviewSnippet}
                </p>
              ) : (
                <span className="text-neutral-600 text-sm">—</span>
              )}
            </div>
            {isOwner && (
              <div className="sm:col-span-3 min-w-0">
                <span className="sm:hidden text-xs text-neutral-500 block mb-1">Your diary:</span>
                {diarySnippet ? (
                  <p className="text-sm text-neutral-400 leading-relaxed line-clamp-3 italic">
                    {diarySnippet}
                  </p>
                ) : (
                  <span className="text-neutral-600 text-sm">—</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
