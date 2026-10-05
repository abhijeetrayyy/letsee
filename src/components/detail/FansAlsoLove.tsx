"use client";

import useSWR from "swr";
import TitleCard from "@components/ds/TitleCard";
import Rail from "@components/ds/Rail";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { useInView } from "@/hooks/useInView";
import { fansAlsoLove } from "@/lib/db/fans";

/**
 * People here who love this also love… — letsee's own taste, not TMDB's
 * algorithm: the other favourites of everyone who hearted this title, each
 * with the faces of the people who love both (lib/db/fans). Nothing until
 * it's a screen away, and nothing at all when nobody here loves it yet.
 */
export default function FansAlsoLove({ itemId, itemType, itemName }: { itemId: string; itemType: "movie" | "tv"; itemName: string }) {
  const { ref, inView } = useInView<HTMLElement>();
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const { data } = useSWR(inView && status !== "loading" ? ["fans-also-love", itemType, itemId, me] : null, () => fansAlsoLove(itemId, itemType, me), { revalidateOnFocus: false });

  if (!data) return <section ref={ref} aria-hidden className="min-h-px" />;
  if (!data.picks.length) return null;

  return (
    <section ref={ref} aria-labelledby="fans-also-love">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">From the favourites of {data.fans === 1 ? "one person" : `${data.fans} people`} here</p>
      <h2 id="fans-also-love" className="mb-4 mt-1 text-2xl text-ink-0">
        People who love <span className="italic">{itemName}</span> also love
      </h2>
      <Rail>
        <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8">
          {data.picks.map((p) => (
            <li key={`${p.itemType}:${p.itemId}`} className="w-32 shrink-0 snap-start sm:w-36">
              <TitleCard id={p.itemId} title={p.name} mediaType={p.itemType} imageUrl={p.imageUrl} people={p.fans} />
            </li>
          ))}
        </ul>
      </Rail>
    </section>
  );
}
