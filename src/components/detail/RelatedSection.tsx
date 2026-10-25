"use client";

import useSWR from "swr";
import TitleCard from "@components/ds/TitleCard";
import { useInView } from "@/hooks/useInView";
import { supabase } from "@/utils/supabase/client";
import { communityFrom, communityReason, type RelatedItem } from "@/utils/related";

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
 *
 * The community line — "Watched by 2 of the 7 people here who saw Inception" —
 * is asked for here, in the browser, once the row is near: the order is the
 * page's (TMDB evidence), and a card whose film people here watched too says so
 * instead of its TMDB reason. Nothing moves. In the page build the same read
 * held every uncached film and series page for ~0.7s.
 */
export default function RelatedSection({
  items,
  heading = "Related",
  seed,
}: {
  items: RelatedItem[];
  heading?: string;
  /** The title this row is related to, for the community line. */
  seed?: { id: number; mediaType: "movie" | "tv"; title: string };
}) {
  const { ref, inView } = useInView<HTMLElement>();
  const { data: community } = useSWR(
    seed && inView ? ["related-audience", seed.mediaType, seed.id] : null,
    async () => {
      const { data } = await supabase.rpc("related_by_audience", { p_item_id: String(seed!.id), p_item_type: seed!.mediaType, p_limit: 200 });
      return communityFrom(data) ?? null;
    },
    { revalidateOnFocus: false },
  );
  if (items.length === 0) return null;
  // A shelf on phones (at most 12, native scroll), the grid from md up. SYSTEM.md §3, shelves.
  const shown = items.slice(0, 12);

  return (
    <section ref={ref} className="mx-auto w-full max-w-app px-4 pb-16 sm:px-6 lg:px-8">

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
                {seed && community?.byId.get(item.id) ? communityReason(seed.title, community.byId.get(item.id)!, community.seedWatchers) : item.reason}
              </p>
            </div>
          ))}
        </div>
      </Rail>
    </section>
  );
}
