"use client";

import { SERIES, NEUTRAL, deltaColor } from "./palette";
import type { GenreStat } from "./types";

/**
 * What you watch, and whether you rate it above or below everyone else.
 *
 * A table with an inline bar rather than a chart: genre names are long, there
 * are up to twenty of them, and the second column is the actual story. A
 * horizontal bar list reads at a glance *and* keeps the numbers legible, which
 * a rotated-label bar chart does not.
 */
export default function GenreTable({
  genres,
  showYou,
  onSelect,
}: {
  genres: GenreStat[];
  showYou: boolean;
  onSelect: (genre: string) => void;
}) {
  if (genres.length === 0) {
    return <p className="py-8 text-center text-sm text-surface-500">No genres yet.</p>;
  }

  const max = Math.max(1, ...genres.map((genre) => genre.count));
  const rows = genres.slice(0, 12);

  return (
    <div>
      <div className="space-y-1.5">
        {rows.map((genre) => {
          // A delta over one or two shared titles is noise wearing a number.
          const hasDelta = showYou && genre.delta != null && genre.paired_count >= 3;
          return (
            <button
              key={genre.genre}
              type="button"
              onClick={() => onSelect(genre.genre)}
              className="group flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-800/50"
            >
              <span className="w-24 shrink-0 truncate text-sm text-surface-300 sm:w-28">
                {genre.genre}
              </span>

              <span
                className="relative h-5 flex-1 overflow-hidden rounded-[4px]"
                style={{ backgroundColor: NEUTRAL.track }}
              >
                <span
                  className="block h-full rounded-[4px] transition-all duration-500"
                  style={{
                    width: `${(genre.count / max) * 100}%`,
                    backgroundColor: NEUTRAL.mark,
                  }}
                />
              </span>

              <span className="w-9 shrink-0 text-right text-sm tabular-nums text-surface-400">
                {genre.count}
              </span>

              {showYou && (
                <span className="hidden w-32 shrink-0 items-center justify-end gap-1.5 text-xs tabular-nums sm:flex">
                  {hasDelta ? (
                    <>
                      <span className="text-surface-500">
                        {genre.your_avg?.toFixed(1)} vs {genre.crowd_avg?.toFixed(1)}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 font-medium"
                        style={{
                          color: deltaColor(genre.delta),
                          backgroundColor: `${deltaColor(genre.delta)}1a`,
                        }}
                        title={`Averaged over the ${genre.paired_count} titles that carry both scores`}
                      >
                        {genre.delta! > 0 ? "+" : ""}
                        {genre.delta!.toFixed(1)}
                      </span>
                    </>
                  ) : (
                    <span className="text-surface-600">
                      {genre.rated_count === 0 ? "unrated" : "too few rated"}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showYou && (
        <p className="mt-4 text-[11px] leading-relaxed text-surface-500">
          The last column is your average against TMDB&rsquo;s, then the gap between
          them — averaged title by title over the ones that carry both scores,
          not one average minus the other.{" "}
          <span style={{ color: SERIES.you }}>Green</span> means you rate the genre
          above everyone else, <span style={{ color: SERIES.crowd }}>blue</span> below.
          Genres with fewer than three shared scores are left blank rather than
          given a number nobody should trust.
        </p>
      )}
    </div>
  );
}
