"use client";

import { useState } from "react";
import { NEUTRAL } from "./palette";
import { Tooltip } from "./Chrome";

export type CountBar = {
  key: string | number;
  label: string;
  count: number;
  /** Extra lines for the tooltip — "6.8 your average", "12 films", etc. */
  detail?: string[];
};

/**
 * One series, magnitude by category. Decades of release, titles per year.
 *
 * No legend: a single series is named by the panel title above it, and a legend
 * box for one thing is furniture. Labels thin out on narrow screens rather than
 * overlapping — a collided axis is worse than a sampled one.
 */
export default function CountBars({
  bars,
  onSelect,
  emptyLabel = "Nothing to show yet.",
}: {
  bars: CountBar[];
  onSelect?: (bar: CountBar) => void;
  emptyLabel?: string;
}) {
  const [hovered, setHovered] = useState<string | number | null>(null);

  if (bars.length === 0) {
    return <p className="py-8 text-center text-sm text-surface-500">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...bars.map((bar) => bar.count));
  // Past a dozen columns every label will not fit; show every other one.
  const labelStride = bars.length > 12 ? Math.ceil(bars.length / 12) : 1;

  return (
    <div className="relative">
      <div className="flex h-40 items-end gap-1.5">
        {bars.map((bar) => {
          const isHovered = hovered === bar.key;
          const interactive = Boolean(onSelect) && bar.count > 0;
          return (
            <div
              key={bar.key}
              className="relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHovered(bar.key)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && (
                <Tooltip x={50}>
                  <p className="font-medium text-surface-100">{bar.label}</p>
                  <p className="mt-0.5 tabular-nums text-surface-300">
                    {bar.count} title{bar.count === 1 ? "" : "s"}
                  </p>
                  {bar.detail?.map((line) => (
                    <p key={line} className="mt-0.5 text-surface-400">{line}</p>
                  ))}
                  {interactive && (
                    <p className="mt-1.5 border-t border-surface-800 pt-1.5 text-[10px] text-surface-500">
                      Click to see the titles
                    </p>
                  )}
                </Tooltip>
              )}
              <button
                type="button"
                disabled={!interactive}
                onClick={interactive ? () => onSelect?.(bar) : undefined}
                aria-label={`${bar.label}: ${bar.count} titles`}
                className={`w-full rounded-t-[4px] transition-all duration-300 ${
                  interactive ? "cursor-pointer" : "cursor-default"
                } ${hovered !== null && !isHovered ? "opacity-45" : "opacity-100"}`}
                style={{
                  height: `${bar.count > 0 ? Math.max(3, (bar.count / max) * 100) : 2}%`,
                  backgroundColor: isHovered ? NEUTRAL.markHover : NEUTRAL.mark,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="h-px w-full" style={{ backgroundColor: NEUTRAL.axis }} />

      <div className="mt-1.5 flex gap-1.5">
        {bars.map((bar, index) => (
          <div
            key={bar.key}
            className={`flex-1 truncate text-center text-[11px] tabular-nums transition-colors ${
              hovered === bar.key ? "text-surface-200" : "text-surface-500"
            }`}
          >
            {index % labelStride === 0 || hovered === bar.key ? bar.label : " "}
          </div>
        ))}
      </div>
    </div>
  );
}
