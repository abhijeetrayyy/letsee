"use client";

import useSWRInfinite from "swr/infinite";
import Link from "@components/ui/AppLink";
import { formatStars } from "@/utils/ratingScale";
import { swrFetcher } from "@/utils/swrFetcher";
import { getPosterUrl } from "@/utils/imageUrl";
import { reviewPath, titlePath } from "@/utils/urls";

/**
 * A person's reviews on their profile: what they wrote, newest first. Each is
 * the poster, the title, the day and their stars, then the opening of their
 * words in the voice — and the whole row opens the review's own page, where
 * it can be replied to. Read through `/api/profile/public-reviews`, which
 * returns only what the viewer may see.
 */
const LIMIT = 12;

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
type Page = { data: ReviewItem[]; totalPages: number };

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReviewsSection({ userId, isOwner = false }: { userId: string; isOwner?: boolean }) {
  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<Page>(
    (index, previous) => {
      if (previous && index >= previous.totalPages) return null;
      return `/api/profile/public-reviews?userId=${encodeURIComponent(userId)}&page=${index + 1}&limit=${LIMIT}`;
    },
    swrFetcher,
    { revalidateOnFocus: false },
  );
  const items = (data ?? []).flatMap((p) => p.data);
  const totalPages = data?.[0]?.totalPages ?? 1;

  if (isLoading) {
    return (
      <div className="flex flex-col" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3 border-b border-line py-3">
            <div className="h-18 w-12 rounded-media bg-raised" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-raised" />
              <div className="h-3 w-full rounded bg-raised" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-ink-400">
        Reviews didn&apos;t load.{" "}
        <button type="button" onClick={() => void mutate()} className="font-medium text-ink-0 underline decoration-line-input underline-offset-4">
          Try again
        </button>
      </p>
    );
  }
  if (!items.length) {
    return <p className="text-sm text-ink-500">{isOwner ? "Nothing written yet. Write about anything you've logged and it shows up here." : "Nothing written yet."}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {items.map((r) => {
          const stars = formatStars(r.score);
          return (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <div className="flex gap-3 py-3">
                <Link href={titlePath(r.item_type, Number(r.item_id), r.item_name)} aria-label={`Open ${r.item_name}`} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getPosterUrl(r.image_url, "w92")} alt="" loading="lazy" className="aspect-2/3 w-12 rounded-media object-cover ring-1 ring-inset ring-line" />
                </Link>
                <Link href={reviewPath(r.id, r.item_name)} className="group min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-display text-lg text-ink-0 group-hover:underline group-hover:decoration-line-input group-hover:underline-offset-4">{r.item_name}</span>
                    {stars && (
                      <span className="shrink-0 font-mono text-sm tabular-nums text-ink-0" aria-label={`${stars} stars`}>
                        ★ {stars}
                      </span>
                    )}
                  </span>
                  <span className="block font-mono text-xs uppercase tracking-wide text-ink-500">
                    {r.item_type === "tv" ? "Series" : "Film"} · {day(r.watched_at)}
                  </span>
                  {r.public_review_text && <span className="mt-2 line-clamp-4 block font-display text-base leading-snug text-ink-300">{r.public_review_text}</span>}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      {size < totalPages && (
        <button
          type="button"
          onClick={() => void setSize(size + 1)}
          disabled={isValidating}
          className="inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 disabled:opacity-60"
        >
          {isValidating ? "Loading…" : "Earlier"}
        </button>
      )}
    </div>
  );
}
