"use client";

import Link from "next/link";
import useSWR from "swr";
import { Heart } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";
import { getAvatarUrl, getPosterUrl } from "@/utils/imageUrl";

type PopularReview = {
  id: number;
  username: string;
  avatarUrl: string | null;
  reviewText: string;
  itemId: string | null;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  reactionCount: number;
};

/**
 * The week's most-liked writing.
 *
 * This exists to make writing worth doing. A review that can only be found by
 * someone already on its title page has no audience, and a surface with no
 * audience gets no submissions — which is exactly why the review column here
 * has stayed empty while Letterboxd's is the whole product.
 *
 * Renders nothing when there's nothing to show. An empty "Popular reviews"
 * heading on a young community advertises the absence.
 */
export default function PopularReviews() {
  const { data } = useSWR<{ reviews: PopularReview[] }>("/api/reviews/popular", swrFetcher);
  const reviews = data?.reviews ?? [];

  if (reviews.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Heart className="size-4 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Worth reading this week</h2>
      </div>

      <ul className="space-y-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-2xl border border-surface-800 bg-surface-900/40 p-4 transition-colors hover:border-surface-700"
          >
            <div className="flex gap-3">
              {review.itemId && (
                <Link href={`/app/${review.itemType}/${review.itemId}`} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPosterUrl(review.imageUrl, "w92")}
                    alt={review.itemName}
                    className="h-[72px] w-12 rounded-lg border border-surface-800 object-cover"
                  />
                </Link>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getAvatarUrl(review.avatarUrl)}
                    alt=""
                    className="size-5 rounded-full object-cover"
                  />
                  <Link
                    href={`/app/profile/${review.username}`}
                    className="text-xs font-medium text-surface-300 hover:text-white transition-colors"
                  >
                    @{review.username}
                  </Link>
                  <span className="text-xs text-surface-600">on</span>
                  {review.itemId ? (
                    <Link
                      href={`/app/${review.itemType}/${review.itemId}`}
                      className="truncate text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      {review.itemName}
                    </Link>
                  ) : (
                    <span className="truncate text-xs text-surface-400">{review.itemName}</span>
                  )}
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-surface-500">
                    <Heart className="size-3 fill-rose-400/70 text-rose-400/70" />
                    {review.reactionCount}
                  </span>
                </div>

                {/* Links to the permalink, not the title page — the review is
                    the thing being recommended here. */}
                <Link href={`/app/review/${review.id}`} className="group mt-2 block">
                  <p className="line-clamp-3 text-sm text-surface-200 group-hover:text-white transition-colors">
                    {review.reviewText}
                  </p>
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
