"use client";

import Link from "@components/ui/AppLink";
import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/utils/swrFetcher";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { Section } from "@components/detail/TitleChrome";
import type { CollectionResponse, CollectionPart } from "@/app/api/collection/route";
import { titlePath } from "@/utils/urls";

/**
 * How far through a franchise you are — the film counterpart of the episode
 * ribbon.
 *
 * "You have seen 3 of 4" is the same fact as "12 of 24 episodes" with the time
 * axis collapsed: a set with a defined end, and your position in it. So this
 * borrows the ribbon's whole grammar rather than inventing a second one. Green
 * is you, everything you have not seen sits back, and the count reads the same
 * way ("3 of 4 films" against "41 of 62 episodes").
 *
 * The tiles used to be a control too — a check on each poster that marked the
 * film watched. It was the one place left on the page where something became
 * "watched" without a viewing behind it, so it went with the logging cleanup
 * (src/lib/logging/titleState.ts: logging is the only way to mark something
 * watched). A tile is a link to that film, where Log it is.
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
  bare = false,
}: {
  /** `movie.belongs_to_collection`, which the movie page already has in hand. */
  collection: MinimalCollection | null;
  /** The film being viewed, so its own tile can be marked rather than read as just another entry. */
  currentId: number | string;
  /** Inside a fold that already carries the collection's name: no heading of its own. */
  bare?: boolean;
}) {
  const { getStatus } = useMediaInteraction();

  // The same entry as the "Watch order" tile at the top of the page.
  const { data, error } = useSWR<CollectionResponse>(
    collection?.id ? `/api/collection?id=${collection.id}` : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );

  const parts: CollectionPart[] = useMemo(() => data?.parts ?? [], [data]);

  const isSeen = useCallback((id: number) => getStatus(String(id), "movie") === "watched", [getStatus]);

  const seen = useMemo(() => parts.filter((p) => isSeen(p.id)).length, [parts, isSeen]);

  /**
   * The first film in release order you have not seen. This is the only line
   * here that answers "so what do I do now", which is why it is worth
   * computing separately from the count.
   */
  const nextUp = useMemo(() => parts.find((p) => !isSeen(p.id)) ?? null, [parts, isSeen]);

  if (!collection?.id) return null;
  if (error) return null;

  const name = data?.name ?? collection.name ?? "Collection";
  const frame = (children: React.ReactNode) => (bare ? children : <Section title={name}>{children}</Section>);

  // The heading is known from the movie payload before the fetch resolves, so
  // the section can hold its shape instead of popping in under the reader.
  if (!data) {
    return frame(
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-37.5 w-24 shrink-0 animate-pulse rounded-xl bg-overlay/60 sm:h-43.5 sm:w-28"
          />
        ))}
      </div>,
    );
  }

  if (parts.length < 2) return null;

  const pct = Math.round((seen / parts.length) * 100);
  const currentKey = String(currentId);

  return frame(
    <>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink-300">
          {seen > 0 ? (
            <>
              <span className="font-mono tabular-nums text-ink-0">{seen}</span>
              <span className="text-ink-500">
                {" "}
                of {parts.length} film{parts.length === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span className="text-ink-500">
              {parts.length} film{parts.length === 1 ? "" : "s"}
            </span>
          )}
        </p>
        {seen > 0 && (
          <span className="font-mono text-xs tabular-nums text-accent">{pct}%</span>
        )}
      </div>

      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {parts.map((p, i) => {
          const on = isSeen(p.id);
          const here = String(p.id) === currentKey;
          return (
            <div key={p.id} className="w-24 shrink-0 sm:w-28">
              <Link
                href={titlePath("movie", p.id, p.title)}
                aria-current={here ? "page" : undefined}
                className="block"
              >
                <div
                  className={`overflow-hidden rounded-xl transition ${
                    on
                      ? "ring-2 ring-focus"
                      : here
                        ? "ring-2 ring-line-light"
                        : "ring-1 ring-line"
                  }`}
                >
                  {p.posterPath ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`${POSTER}${p.posterPath}`}
                      alt={p.title}
                      loading="lazy"
                      className={`h-37.5 w-full object-cover transition sm:h-43.5 ${
                        on ? "opacity-100" : "opacity-60 hover:opacity-90"
                      }`}
                    />
                  ) : (
                    <div className="flex h-37.5 w-full items-center justify-center bg-overlay px-2 text-center text-xs text-ink-500 sm:h-43.5">
                      {p.title}
                    </div>
                  )}
                </div>
              </Link>

              <p
                className={`mt-1.5 truncate text-xs leading-tight ${
                  here ? "text-ink-0" : "text-ink-400"
                }`}
                title={p.title}
              >
                {p.title}
              </p>
              <p className="font-mono text-xs tabular-nums text-ink-600">
                {i + 1}. {year(p.releaseDate)}
                {here && <span className="ml-1 text-ink-400">· here</span>}
              </p>
            </div>
          );
        })}
      </div>

      {nextUp && seen > 0 && (
        <p className="mt-2 text-xs text-ink-500">
          Next in order:{" "}
          <Link
            href={titlePath("movie", nextUp.id, nextUp.title)}
            className="text-accent hover:text-accent-soft"
          >
            {nextUp.title}
          </Link>
        </p>
      )}
    </>,
  );
}
