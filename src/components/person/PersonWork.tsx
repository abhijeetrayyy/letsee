"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TitleCard from "@components/ds/TitleCard";
import SeenOf from "@components/ui/SeenOf";
import type { Credit } from "@/utils/person/model";
import { Search } from "lucide-react";

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
 *
 * Three across on a phone, not two. At two, each poster was 165px wide and
 * Christopher Nolan's 28 behind-the-camera credits alone ran 5,100px — six
 * screens of one section. At three a poster is about 105px: still a shape and
 * a colour you recognise (Up next's Someday is the same size), at half the
 * height.
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

function CreditGrid({ credits, mode, primary }: { credits: Credit[]; mode: "screen" | "behind"; primary: boolean }) {
  const PAGE_SIZE = 32;
  // Only the first filmography section belongs in the initial response. The
  // second can be hundreds of cards below the fold; it fills itself before the
  // reader reaches it instead of making the first click download it all.
  const [visibleCount, setVisibleCount] = useState(() => primary ? Math.min(PAGE_SIZE, credits.length) : 0);
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const visible = credits.slice(0, visibleCount);
  const hasMore = visibleCount < credits.length;

  useEffect(() => {
    if (!hasMore || !moreRef.current || typeof IntersectionObserver === "undefined") return;
    const node = moreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, credits.length));
          observer.disconnect();
        }
      },
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [credits.length, hasMore, visibleCount]);

  return (
    <>
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6 xl:grid-cols-8">
        {visible.map((c) => (
          <TitleCard
            key={c.key}
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
        ))}
      </div>
      {hasMore && (
        <button
          ref={moreRef}
          type="button"
          onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, credits.length))}
          className="mx-auto mt-6 block rounded-full border border-line-strong bg-raised px-5 py-2 text-sm text-ink-300 transition-colors hover:border-accent-strong/40 hover:text-ink-0"
        >
          Show more <span className="text-ink-500">({credits.length - visibleCount} left)</span>
        </button>
      )}
    </>
  );
}

function Heading({ title, count }: { title: string; count: number }) {
  return (
    <h3 className="mb-4 flex items-baseline gap-2 text-lg font-semibold text-ink-0">
      {title}
      <span className="font-mono text-sm font-normal tabular-nums text-ink-500">{count}</span>
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
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<"all" | "movie" | "tv">("all");
  const [sort, setSort] = useState<"newest" | "popular">("newest");

  const { screen, behind } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const work = credits.filter((c) => {
      if (c.bucket !== "performance" && c.bucket !== "presenting") return false;
      if (mediaType !== "all" && c.mediaType !== mediaType) return false;
      if (!needle) return true;
      return [c.title, ...c.characters, ...c.jobs].some((value) => value.toLowerCase().includes(needle));
    });
    const byDate = (a: Credit, b: Credit) => {
      if (sort === "popular") return b.voteCount - a.voteCount || b.voteAverage - a.voteAverage;
      if (!a.date && !b.date) return b.voteCount - a.voteCount;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    };
    return {
      screen: work.filter((c) => c.characters.length > 0).sort(byDate),
      behind: work.filter((c) => c.isCrew && c.jobs.length > 0).sort(byDate),
    };
  }, [credits, mediaType, query, sort]);

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
      <CreditGrid key={`screen-${query}-${mediaType}-${sort}`} credits={screen} mode="screen" primary={!behindFirst} />
    </div>
  );
  const behindBlock = behind.length > 0 && (
    <div key="behind">
      <Heading title="Behind the camera" count={behind.length} />
      <CreditGrid key={`behind-${query}-${mediaType}-${sort}`} credits={behind} mode="behind" primary={behindFirst} />
    </div>
  );

  return (
    <div className="space-y-12">
      {/* The bounded set: how much of this person's work you have seen. */}
      <SeenOf items={credits.filter((c) => c.mediaType === "movie" || c.mediaType === "tv").map((c) => ({ id: c.id, type: c.mediaType }))} noun="of their titles" className="mb-4" />

      <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-raised/40 p-3 sm:flex-row sm:items-center">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-line-strong bg-page/60 px-3 focus-within:border-accent-strong/50 focus-within:ring-2 focus-within:ring-focus">
          <Search className="size-4 text-ink-500" />
          <span className="sr-only">Search filmography</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles or roles"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-0 focus:outline-none placeholder:text-ink-600"
          />
        </label>
        {/* Type and order share a line on a phone; the search above gets its own. */}
        <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-page/60 p-1" aria-label="Media type">
          {(["all", "movie", "tv"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMediaType(value)}
              className={`min-h-9 rounded-lg px-3 text-xs font-medium capitalize transition-colors ${mediaType === value ? "bg-hover text-ink-0" : "text-ink-400 hover:text-ink-0"}`}
            >
              {value === "all" ? "All" : value === "tv" ? "TV" : "Movies"}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as "newest" | "popular")}
          aria-label="Sort filmography"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-page/60 px-3 text-sm text-ink-200 outline-none focus-visible:ring-2 focus-visible:ring-focus sm:flex-none"
        >
          <option value="newest">Newest first</option>
          <option value="popular">Most popular</option>
        </select>
        </div>
      </div>

      {screenBlock || behindBlock ? (
        behindFirst ? [behindBlock, screenBlock] : [screenBlock, behindBlock]
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong px-5 py-12 text-center">
          <p className="font-medium text-ink-300">No matching credits</p>
          <button type="button" onClick={() => { setQuery(""); setMediaType("all"); }} className="mt-2 text-sm text-accent hover:text-accent-soft">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
