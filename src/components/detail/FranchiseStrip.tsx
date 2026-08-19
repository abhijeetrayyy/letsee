"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/utils/swrFetcher";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { Section } from "@components/detail/TitleChrome";
import type { CollectionResponse, CollectionPart } from "@/app/api/collection/route";
import { slugify } from "@/utils/urls";

/**
 * How far through a franchise you are — the film counterpart of the episode
 * ribbon.
 *
 * "You have seen 3 of 4" is the same fact as "12 of 24 episodes" with the time
 * axis collapsed: a set with a defined end, and your position in it. So this
 * borrows the ribbon's whole grammar rather than inventing a second one. Green
 * is you, everything you have not seen sits back, the count reads the same way
 * ("3 of 4 films" against "41 of 62 episodes"), and the tiles are the control
 * — tap the check and the film is marked, no modal, no navigating away and
 * coming back.
 *
 * The reason it earns the space: measured live, 40% of popular films and 40%
 * of top-rated films belong to a collection, so this fires on a large minority
 * of movie pages rather than a rare few. Median collection is 3 films, and the
 * long tail is real — the James Bond collection returns 27.
 *
 * The strip does not appear for a collection of one. TMDB files some films
 * under a collection that holds only them, and "you have seen 1 of 1" is not
 * progress, it is the same fact the page already states.
 */

const POSTER = "https://image.tmdb.org/t/p/w342";

type MinimalCollection = {
  id: number;
  name?: string | null;
  poster_path?: string | null;
};


function year(date: string | null): string {
  const y = date?.slice(0, 4);
  return y && /^\d{4}$/.test(y) ? y : "TBA";
}

export default function FranchiseStrip({
  collection,
  currentId,
}: {
  /** `movie.belongs_to_collection`, which the movie page already has in hand. */
  collection: MinimalCollection | null;
  /** The film being viewed, so its own tile can be marked rather than read as just another entry. */
  currentId: number | string;
}) {
  const { getStatus, setStatus, isAuthenticated } = useMediaInteraction();

  const { data, error } = useSWR<CollectionResponse>(
    collection?.id ? `/api/collection?id=${collection.id}` : null,
    swrFetcher,
  );

  /** Optimistic overlay, so a tap fills the tile now rather than after a round trip. */
  const [pending, setPending] = useState<Record<number, boolean>>({});

  const parts: CollectionPart[] = useMemo(() => data?.parts ?? [], [data]);

  const isSeen = useCallback(
    (id: number) => (id in pending ? pending[id] : getStatus(String(id), "movie") === "watched"),
    [pending, getStatus],
  );

  const seen = useMemo(() => parts.filter((p) => isSeen(p.id)).length, [parts, isSeen]);

  /**
   * The first film in release order you have not seen. This is the only line
   * here that answers "so what do I do now", which is why it is worth
   * computing separately from the count.
   */
  const nextUp = useMemo(() => parts.find((p) => !isSeen(p.id)) ?? null, [parts, isSeen]);

  const toggle = useCallback(
    async (part: CollectionPart) => {
      if (!isAuthenticated) return;
      const next = !isSeen(part.id);
      setPending((p) => ({ ...p, [part.id]: next }));
      await setStatus(String(part.id), next ? "watched" : null, {
        itemType: "movie",
        name: part.title,
        imgUrl: part.posterPath ? `${POSTER}${part.posterPath}` : undefined,
      });
      setPending((p) => {
        const { [part.id]: _drop, ...rest } = p;
        // The provider reverts its own optimistic write when the request fails,
        // so dropping the overlay is enough to snap the tile back to the truth
        // either way.
        return rest;
      });
    },
    [isAuthenticated, isSeen, setStatus],
  );

  if (!collection?.id) return null;
  if (error) return null;

  const name = data?.name ?? collection.name ?? "Collection";

  // The heading is known from the movie payload before the fetch resolves, so
  // the section can hold its shape instead of popping in under the reader.
  if (!data) {
    return (
      <Section title={name}>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="h-[150px] w-24 shrink-0 animate-pulse rounded-xl bg-surface-800/60 sm:h-[174px] sm:w-28"
            />
          ))}
        </div>
      </Section>
    );
  }

  if (parts.length < 2) return null;

  const pct = Math.round((seen / parts.length) * 100);
  const currentKey = String(currentId);

  return (
    <Section title={name}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-sm text-surface-300">
          {seen > 0 ? (
            <>
              <span className="font-mono tabular-nums text-white">{seen}</span>
              <span className="text-surface-500">
                {" "}
                of {parts.length} film{parts.length === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span className="text-surface-500">
              {parts.length} film{parts.length === 1 ? "" : "s"}
            </span>
          )}
        </p>
        {seen > 0 && (
          <span className="font-mono text-xs tabular-nums text-brand-400">{pct}%</span>
        )}
      </div>

      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {parts.map((p, i) => {
          const on = isSeen(p.id);
          const here = String(p.id) === currentKey;
          return (
            <div key={p.id} className="w-24 shrink-0 sm:w-28">
              <div className="relative">
                <Link
                  href={`/app/movie/${p.id}${p.title ? `-${slugify(p.title)}` : ""}`}
                  aria-current={here ? "page" : undefined}
                  className="block"
                >
                  <div
                    className={`overflow-hidden rounded-xl transition ${
                      on
                        ? "ring-2 ring-brand-500"
                        : here
                          ? "ring-2 ring-surface-400"
                          : "ring-1 ring-surface-800"
                    }`}
                  >
                    {p.posterPath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`${POSTER}${p.posterPath}`}
                        alt={p.title}
                        loading="lazy"
                        className={`h-[150px] w-full object-cover transition sm:h-[174px] ${
                          on ? "opacity-100" : "opacity-60 hover:opacity-90"
                        }`}
                      />
                    ) : (
                      <div className="flex h-[150px] w-full items-center justify-center bg-surface-800 px-2 text-center text-[10px] text-surface-500 sm:h-[174px]">
                        {p.title}
                      </div>
                    )}
                  </div>
                </Link>

                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    aria-pressed={on}
                    aria-label={`${p.title} — ${on ? "watched" : "mark watched"}`}
                    title={on ? "Watched" : "Mark watched"}
                    className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[13px] leading-none transition-colors ${
                      on
                        ? "bg-brand-500 text-surface-950 hover:bg-brand-400"
                        : "bg-surface-950/75 text-surface-400 hover:bg-surface-900 hover:text-surface-200"
                    }`}
                  >
                    ✓
                  </button>
                )}
              </div>

              <p
                className={`mt-1.5 truncate text-[11px] leading-tight ${
                  here ? "text-white" : "text-surface-400"
                }`}
                title={p.title}
              >
                {p.title}
              </p>
              <p className="font-mono text-[10px] tabular-nums text-surface-600">
                {i + 1}. {year(p.releaseDate)}
                {here && <span className="ml-1 text-surface-400">· here</span>}
              </p>
            </div>
          );
        })}
      </div>

      {nextUp && seen > 0 && (
        <p className="mt-2 text-xs text-surface-500">
          Next in order:{" "}
          <Link
            href={`/app/movie/${nextUp.id}${nextUp.title ? `-${slugify(nextUp.title)}` : ""}`}
            className="text-brand-400 hover:text-brand-300"
          >
            {nextUp.title}
          </Link>
        </p>
      )}
    </Section>
  );
}
