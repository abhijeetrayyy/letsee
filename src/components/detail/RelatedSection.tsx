"use client";

import { useState } from "react";
import SendMessageModal from "@components/message/sendCard";
import MediaCard from "@components/cards/MediaCard";
import { GenreList } from "@/staticData/genreList";
import type { RelatedItem } from "@/utils/related";

/**
 * One related section, replacing two.
 *
 * The detail pages used to render "More like this" and "Similar movies" as two
 * near-identical rails from TMDB's two near-identical lists, neither saying why
 * anything was in it. Four mediocre rails is how the home page reached
 * twenty-five surfaces; one section that says *why* is worth more.
 *
 * A grid rather than the old horizontal scroller, because every card now
 * carries a sentence. In a fixed-width rail those sentences wrap to five or six
 * lines at different heights and the row goes ragged; in a grid they have room,
 * and the reason is the whole point of the section.
 */
export default function RelatedSection({
  items,
  heading = "Related",
}: {
  items: RelatedItem[];
  heading?: string;
}) {
  const [shareTarget, setShareTarget] = useState<RelatedItem | null>(null);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Carried over from the rail this replaces — it was the only way to
          share a related title into a DM, and deleting the rail silently would
          have taken the feature with it. */}
      <SendMessageModal
        media_type={shareTarget?.mediaType ?? null}
        data={shareTarget}
        isOpen={shareTarget !== null}
        onClose={() => setShareTarget(null)}
      />

      <h2 className="mb-4 text-2xl font-bold text-white">{heading}</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <div key={`${item.mediaType}:${item.id}`} className="min-w-0">
            <MediaCard
              id={item.id}
              title={item.title}
              mediaType={item.mediaType}
              posterPath={item.posterPath}
              adult={item.adult}
              genres={item.genreIds
                .map((id) => GenreList.genres.find((g) => g.id === id)?.name)
                .filter((n): n is string => Boolean(n))}
              showActions
              onShare={(e) => {
                e.preventDefault();
                setShareTarget(item);
              }}
              typeLabel={item.mediaType}
              rating={item.voteAverage}
              voteCount={item.voteCount}
              overview={item.overview}
              releaseDate={item.releaseDate}
            />
            {/* Rendered outside the card rather than through its `role` slot,
                which is deliberately unclamped for crew jobs and would let a
                long sentence stretch one cell taller than its neighbours. */}
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-surface-500">
              {item.reason}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
