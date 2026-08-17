"use client";

import { useMemo } from "react";
import MediaCard from "@components/cards/MediaCard";
import type { Credit } from "@/utils/person/model";

/**
 * A filmography is a wall of posters, not a table of rows.
 *
 * The first version was a dense list with a 48px thumbnail, which is what the
 * industry standard sites do — and it is wrong for the way people actually
 * read this page. Nobody scans a filmography by title; they scan it by poster,
 * recognise a shape and a colour, and stop. A thumbnail too small to recognise
 * makes the reader do the work in text that the artwork would have done
 * instantly, and a hover-to-enlarge crutch just admitted the layout was
 * fighting them.
 *
 * Not masonry, deliberately. Masonry earns its irregularity when items have
 * different aspect ratios; every TMDB poster is 2:3, so a masonry column would
 * produce ragged edges carrying no information. A uniform grid lets the eye
 * travel in straight lines, which is the whole point of scanning.
 *
 * Two lists, both always on screen — see the note on the sections below.
 */

/**
 * The whole filmography, every time. No "show more".
 *
 * A pager on a body of work is a strange thing to make someone click: the list
 * is the content, and the fold was arbitrary — 40 was a number I picked, not a
 * meaningful boundary in anyone's career. Scrolling is cheaper than deciding.
 *
 * The two costs this incurs are both bounded. Posters are `loading="lazy"`, so
 * a 216-credit page still only fetches the rows you scroll to. And every card
 * carries an add-to-list control, which subscribes to the preference context —
 * measured on Spielberg, the heaviest page in the sample, that is the real
 * price of showing everything, and it is paid once at mount rather than on
 * every keystroke or scroll.
 */

function roleText(c: Credit, mode: "screen" | "behind"): string | null {
  if (mode === "behind") return c.jobs.length ? c.jobs.join(", ") : null;
  if (c.characters.length) {
    const chars = c.characters.slice(0, 2).join(" / ");
    return c.episodeCount > 1 ? `${chars} · ${c.episodeCount} eps` : chars;
  }
  return null;
}

function CreditGrid({ credits, mode }: { credits: Credit[]; mode: "screen" | "behind" }) {
  return (
    <>
      {/* Same column steps as "Known for", so poster size is constant down the
          whole page rather than changing meaning section to section. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {credits.map((c) => (
          // `card-lift` scales the card on hover. A transform never affects
          // layout, so the card grows over its neighbours without moving a
          // single one of them — the absolute-positioned feel, without taking
          // the card out of the grid and having to re-place it by hand.
          <div key={c.key} className="card-lift">
            <MediaCard
              id={c.id}
              title={c.title}
              mediaType={c.mediaType}
              posterPath={c.posterPath}
              genres={[]}
              showActions
              role={roleText(c, mode)}
              releaseDate={c.date || null}
              rating={c.voteAverage || null}
              voteCount={c.voteCount || null}
            />
          </div>
        ))}
      </div>

    </>
  );
}

function Heading({ title, count }: { title: string; count: number }) {
  return (
    <h3 className="mb-4 flex items-baseline gap-2 text-lg font-semibold text-white">
      {title}
      <span className="font-mono text-sm font-normal tabular-nums text-surface-500">{count}</span>
    </h3>
  );
}

export default function PersonWork({
  credits,
  knownForDepartment,
}: {
  credits: Credit[];
  knownForDepartment: string | null;
}) {
  const { screen, behind } = useMemo(() => {
    const work = credits.filter((c) => c.bucket === "performance" || c.bucket === "presenting");
    const byDate = (a: Credit, b: Credit) => {
      if (!a.date && !b.date) return b.voteCount - a.voteCount;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    };
    return {
      screen: work.filter((c) => c.characters.length > 0).sort(byDate),
      behind: work.filter((c) => c.isCrew && c.jobs.length > 0).sort(byDate),
    };
  }, [credits]);

  /**
   * Both lists are always on screen, and the order follows the person.
   *
   * A tab is a step, and a step is a filter on who ever sees the content.
   * Measured across ten people, every one had crew credits — Emily Blunt 6,
   * Tom Holland 7, Scarlett Johansson 13 (including *Eleanor the Great*, which
   * she directed), Cruise 27, Hanks 61, and DiCaprio 68, which is more
   * producing credits than acting ones.
   */
  const behindFirst = (knownForDepartment ?? "Acting") !== "Acting";

  const screenBlock = screen.length > 0 && (
    <div key="screen">
      <Heading title="On screen" count={screen.length} />
      <CreditGrid credits={screen} mode="screen" />
    </div>
  );
  const behindBlock = behind.length > 0 && (
    <div key="behind">
      <Heading title="Behind the camera" count={behind.length} />
      <CreditGrid credits={behind} mode="behind" />
    </div>
  );

  if (!screenBlock && !behindBlock) return null;

  return (
    <div className="space-y-12">
      {behindFirst ? [behindBlock, screenBlock] : [screenBlock, behindBlock]}
    </div>
  );
}
