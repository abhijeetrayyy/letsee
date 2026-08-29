"use client";

import { useState } from "react";
import { formatStars } from "@/utils/ratingScale";
import { SERIES, SERIES_SOFT, NEUTRAL } from "./palette";
import { Legend, Tooltip } from "./Chrome";
import { bucketValue, type MediaFilter, type ScoreBucket } from "./types";

/**
 * Your ratings and TMDB's, over the same ten buckets, as grouped bars.
 *
 * ── Why grouped and not two charts ─────────────────────────────────────────
 * The whole question is "where do these two disagree", and that is a
 * comparison the eye should make in one saccade rather than by remembering the
 * shape of a chart above. Grouping is only legitimate because both series are
 * counts of titles on the same 1–10 scale — one axis, one unit. If they were
 * not, this would have to be two charts.
 *
 * ── Why the bars are counts and not percentages ────────────────────────────
 * "90 titles at 6–7" is the sentence people actually say about their own
 * library. A percentage would make two libraries comparable, which is not what
 * a profile is for.
 */
export default function RatingHistogram({
  you,
  crowd,
  filter,
  showYou,
  onSelect,
}: {
  you: ScoreBucket[];
  crowd: ScoreBucket[];
  filter: MediaFilter;
  showYou: boolean;
  onSelect: (source: "you" | "crowd", score: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const scores = Array.from({ length: 10 }, (_, i) => i + 1);
  const byScore = (rows: ScoreBucket[], score: number) =>
    rows.find((row) => row.score === score);

  const valueAt = (rows: ScoreBucket[], score: number) => {
    const bucket = byScore(rows, score);
    return bucket ? bucketValue(bucket, filter) : 0;
  };

  // One scale for both series. Two scales would let a 3 look taller than a 30.
  const max = Math.max(
    1,
    ...scores.flatMap((score) => [
      showYou ? valueAt(you, score) : 0,
      valueAt(crowd, score),
    ]),
  );

  const total = (rows: ScoreBucket[]) =>
    scores.reduce((sum, score) => sum + valueAt(rows, score), 0);

  if (asTable) {
    return (
      <div>
        <TableToggle asTable={asTable} onToggle={() => setAsTable(false)} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <caption className="sr-only">
              Titles by rating, yours against TMDB&rsquo;s
            </caption>
            <thead>
              <tr className="border-b border-surface-800 text-left text-xs uppercase tracking-wider text-surface-500">
                <th scope="col" className="py-2 pr-3 font-medium">Rating</th>
                {showYou && <th scope="col" className="py-2 pr-3 text-right font-medium">You</th>}
                <th scope="col" className="py-2 text-right font-medium">TMDB</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score) => (
                <tr key={score} className="border-b border-surface-800/50 last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal text-surface-300">
                    {score}
                    <span className="ml-2 text-xs text-surface-500">{formatStars(score)}★</span>
                  </th>
                  {showYou && (
                    <td className="py-1.5 pr-3 text-right tabular-nums text-surface-200">
                      {valueAt(you, score)}
                    </td>
                  )}
                  <td className="py-1.5 text-right tabular-nums text-surface-200">
                    {valueAt(crowd, score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Legend showYou={showYou} />
        <TableToggle asTable={asTable} onToggle={() => setAsTable(true)} />
      </div>

      <div className="relative mt-5">
        <div className="flex h-48 items-end gap-1 sm:gap-2">
          {scores.map((score) => {
            const yourCount = valueAt(you, score);
            const crowdCount = valueAt(crowd, score);
            const isHovered = hovered === score;

            return (
              <div
                key={score}
                className="group relative flex h-full flex-1 flex-col justify-end"
                onMouseEnter={() => setHovered(score)}
                onMouseLeave={() => setHovered(null)}
              >
                {isHovered && (
                  <Tooltip x={50}>
                    <p className="font-medium text-surface-100">
                      Rated {score}
                      <span className="ml-1.5 text-surface-400">{formatStars(score)}★</span>
                    </p>
                    {showYou && (
                      <p className="mt-1 flex items-center gap-1.5 text-surface-300">
                        <span className="size-2 rounded-[2px]" style={{ backgroundColor: SERIES.you }} />
                        You: <span className="tabular-nums font-medium">{yourCount}</span>
                      </p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1.5 text-surface-300">
                      <span className="size-2 rounded-[2px]" style={{ backgroundColor: SERIES.crowd }} />
                      TMDB: <span className="tabular-nums font-medium">{crowdCount}</span>
                    </p>
                    <p className="mt-1.5 border-t border-surface-800 pt-1.5 text-[10px] text-surface-500">
                      Click a bar to see the titles
                    </p>
                  </Tooltip>
                )}

                {/* The 2px gap between the two fills is the spacer that keeps
                    adjacent bars from reading as one shape. */}
                <div className="flex h-full items-end justify-center gap-[2px]">
                  {showYou && (
                    <Bar
                      count={yourCount}
                      max={max}
                      color={SERIES_SOFT.you}
                      solid={SERIES.you}
                      dimmed={hovered !== null && !isHovered}
                      label={`${yourCount} title${yourCount === 1 ? "" : "s"} you rated ${score} out of 10`}
                      onClick={yourCount > 0 ? () => onSelect("you", score) : undefined}
                    />
                  )}
                  <Bar
                    count={crowdCount}
                    max={max}
                    color={SERIES_SOFT.crowd}
                    solid={SERIES.crowd}
                    dimmed={hovered !== null && !isHovered}
                    label={`${crowdCount} title${crowdCount === 1 ? "" : "s"} TMDB rates ${score} out of 10`}
                    onClick={crowdCount > 0 ? () => onSelect("crowd", score) : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Baseline. Bars are anchored to it, so a zero reads as zero. */}
        <div className="h-px w-full" style={{ backgroundColor: NEUTRAL.axis }} />

        <div className="mt-1.5 flex gap-1 sm:gap-2">
          {scores.map((score) => (
            <div
              key={score}
              className={`flex-1 text-center text-[11px] tabular-nums transition-colors ${
                hovered === score ? "text-surface-200" : "text-surface-500"
              }`}
            >
              {score}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-surface-500">
        Both scales run 1–10, so a bar in one series sits directly under the
        comparable bar in the other. 10 is {formatStars(10)}★.
        {showYou && ` You've rated ${total(you)}; TMDB has a score for ${total(crowd)}.`}
      </p>
    </div>
  );
}

function Bar({
  count,
  max,
  color,
  solid,
  dimmed,
  label,
  onClick,
}: {
  count: number;
  max: number;
  color: string;
  solid: string;
  dimmed: boolean;
  label: string;
  onClick?: () => void;
}) {
  // A zero keeps a 2px stub rather than vanishing: an empty bucket is a fact
  // about the library, and a gap in the row reads as missing data instead.
  const height = count > 0 ? Math.max(3, (count / max) * 100) : 2;

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-full max-w-[26px] rounded-t-[4px] transition-all duration-300 ${
        onClick ? "cursor-pointer" : "cursor-default"
      } ${dimmed ? "opacity-45" : "opacity-100"}`}
      style={{
        height: `${height}%`,
        backgroundColor: count > 0 ? color : "rgba(63,63,70,0.5)",
        boxShadow: !dimmed && count > 0 ? `inset 0 0 0 1px ${solid}` : undefined,
      }}
    />
  );
}

function TableToggle({ asTable, onToggle }: { asTable: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-md border border-surface-700/70 px-2 py-1 text-[11px] text-surface-400 transition-colors hover:border-surface-600 hover:text-surface-200"
    >
      {asTable ? "Show chart" : "Show numbers"}
    </button>
  );
}
