"use client";

import TitleCard from "@components/ds/TitleCard";
import type { RelatedItem } from "@/utils/related";

import Rail from "@components/ds/Rail";
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
  if (items.length === 0) return null;
  // A shelf on phones (at most 12, native scroll), the grid from md up. SYSTEM.md §3, shelves.
  const shown = items.slice(0, 12);

  return (
    <section className="mx-auto w-full max-w-app px-4 pb-16 sm:px-6 lg:px-8">

      <h2 className="mb-4 text-xl text-ink-0">{heading}</h2>

      <Rail>
        <div
          className="no-scrollbar -mx-4 flex snap-x snap-proximity scroll-px-4 gap-3 overflow-x-auto px-4 md:mx-0 md:scroll-px-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-6"
        >
          {shown.map((item) => (
            <div key={`${item.mediaType}:${item.id}`} className="w-32 shrink-0 snap-start md:w-auto md:min-w-0">
              <TitleCard
                id={item.id}
                title={item.title}
                mediaType={item.mediaType}
                posterPath={item.posterPath}
                adult={item.adult}
                releaseDate={item.releaseDate}
              />
              {/* Why it's here, under the card: one more line, clamped. Passing a
                  film to someone now lives on its page (Pass to…), not on every card. */}
              <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-ink-500">
                {item.reason}
              </p>
            </div>
          ))}
        </div>
      </Rail>
    </section>
  );
}
