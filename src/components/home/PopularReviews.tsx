"use client";

import Link from "@components/ui/AppLink";
import useSWR from "swr";
import { useInView } from "@/hooks/useInView";
import { PenLine } from "lucide-react";
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
import { reviewPath, titlePath } from "@/utils/urls";
export default function PopularReviews() {
  /**
   * Deferred until scrolled to — see `useInView`. This sits well below the fold
   * on the home page, and its route is one of the more expensive ones in the
   * app; running it for readers who never reach it is the clearest case of
   * paying for something nobody asked for.
   */
  const { ref, inView } = useInView<HTMLDivElement>();
  const { data } = useSWR<{ reviews: PopularReview[] }>(
    inView ? "/api/reviews/popular" : null,
    swrFetcher,
  );
  const reviews = data?.reviews ?? [];

  /**
   * The placeholder has to exist, or the observer has nothing to observe.
   *
   * This component renders `null` when there is nothing to show, and "not
   * fetched yet" looks exactly like "nothing to show" — so returning null
   * before the first fetch would remove the element the sentinel is attached
   * to, and the fetch would never be triggered by anything. A section that
   * silently never loads is the worst possible outcome of deferring it.
   */
  if (!inView) {
    return (
      <div ref={ref} className="space-y-3" aria-hidden>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-900/40" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        {/* Not a heart, and not "worth reading" — both framed this row as a
            selection of the best, which is exactly the comparison that stops
            someone posting their own three sentences. It is simply what people
            wrote. */}
        <PenLine className="size-4 text-brand-400" />
        <h2 className="text-lg font-bold text-white">What people wrote</h2>
      </div>

      <ul className="space-y-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-2xl border border-surface-800 bg-surface-900/40 p-4 transition-colors hover:border-surface-700"
          >
            <div className="flex gap-3">
              {review.itemId && (
                <Link href={titlePath(review.itemType, review.itemId, review.itemName)} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async"
                    src={getPosterUrl(review.imageUrl, "w92")}
                    alt={review.itemName}
                    className="h-[72px] w-12 rounded-lg border border-surface-800 object-cover"
                  />
                </Link>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async"
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
                      href={titlePath(review.itemType, review.itemId, review.itemName)}
                      className="truncate text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      {review.itemName}
                    </Link>
                  ) : (
                    <span className="truncate text-xs text-surface-400">{review.itemName}</span>
                  )}
                </div>

                {/* Links to the permalink, not the title page — the review is
                    the thing being recommended here. */}
                <Link href={reviewPath(review.id, review.itemName)} className="group mt-2 block">
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
