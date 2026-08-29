"use client";

import { useState } from "react";
import { SERIES, NEUTRAL } from "./palette";
import { Legend } from "./Chrome";
import type { DriftPoint } from "./types";

/**
 * Are you getting harsher? Your average rating per year against the crowd's
 * average for the same films.
 *
 * ── One axis, on purpose ───────────────────────────────────────────────────
 * Both series are a mean score in the same 1–10 unit, so they share a scale.
 * The crowd line is the control: if your line dips in 2025 and theirs dips
 * with it, you did not get harsher, you watched worse films. A second y-axis
 * would have hidden exactly that.
 *
 * The scale is padded around the data rather than pinned to 1–10, because a
 * fixed full-range axis flattens every real movement into a straight line —
 * but it never inverts or zooms past the data, and the axis labels state the
 * range so a small wiggle cannot be misread as a collapse.
 */
export default function DriftChart({
  points,
  showYou,
}: {
  points: DriftPoint[];
  showYou: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const usable = points.filter((p) => p.your_avg != null || p.crowd_avg != null);
  if (usable.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-surface-500">
        Two years of ratings are needed before a trend means anything.
      </p>
    );
  }

  const values = usable.flatMap((p) =>
    [showYou ? p.your_avg : null, p.crowd_avg].filter((v): v is number => v != null),
  );
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max(0.5, (rawMax - rawMin) * 0.25);
  const yMin = Math.max(0, Math.floor((rawMin - pad) * 2) / 2);
  const yMax = Math.min(10, Math.ceil((rawMax + pad) * 2) / 2);
  const span = Math.max(0.5, yMax - yMin);

  const W = 100;
  const H = 100;
  const x = (i: number) => (usable.length === 1 ? W / 2 : (i / (usable.length - 1)) * W);
  const y = (v: number) => H - ((v - yMin) / span) * H;

  const path = (pick: (p: DriftPoint) => number | null) => {
    const segments: string[] = [];
    let open = false;
    usable.forEach((point, index) => {
      const value = pick(point);
      if (value == null) { open = false; return; }
      segments.push(`${open ? "L" : "M"}${x(index).toFixed(2)},${y(value).toFixed(2)}`);
      open = true;
    });
    return segments.join(" ");
  };

  const active = hovered != null ? usable[hovered] : null;

  return (
    <div>
      <Legend showYou={showYou} />

      <div className="relative mt-5">
        <div className="flex gap-2">
          {/* Axis labels outside the plot, so the plot area is only data. */}
          <div className="flex h-40 w-7 shrink-0 flex-col justify-between py-[1px] text-right text-[10px] tabular-nums text-surface-500">
            <span>{yMax.toFixed(1)}</span>
            <span>{((yMax + yMin) / 2).toFixed(1)}</span>
            <span>{yMin.toFixed(1)}</span>
          </div>

          <div
            className="relative h-40 flex-1"
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="h-full w-full overflow-visible"
              role="img"
              aria-label={
                showYou
                  ? "Your average rating per year, against TMDB's average for the same titles"
                  : "TMDB's average rating per year"
              }
            >
              {[0, 0.5, 1].map((t) => (
                <line
                  key={t}
                  x1={0} x2={W} y1={t * H} y2={t * H}
                  stroke={NEUTRAL.axis} strokeWidth={0.4} vectorEffect="non-scaling-stroke"
                />
              ))}

              <path
                d={path((p) => p.crowd_avg)}
                fill="none" stroke={SERIES.crowd} strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {showYou && (
                <path
                  d={path((p) => p.your_avg)}
                  fill="none" stroke={SERIES.you} strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {usable.map((point, index) => (
                <g key={point.year}>
                  {point.crowd_avg != null && (
                    <circle
                      cx={x(index)} cy={y(point.crowd_avg)} r={hovered === index ? 4 : 3}
                      fill={SERIES.crowd} stroke="#18181b" strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {showYou && point.your_avg != null && (
                    <circle
                      cx={x(index)} cy={y(point.your_avg)} r={hovered === index ? 4 : 3}
                      fill={SERIES.you} stroke="#18181b" strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              ))}
            </svg>

            {/* Hit targets are full-height columns, far bigger than the 8px
                markers — a crosshair you have to aim at is a crosshair nobody
                finds. */}
            <div className="absolute inset-0 flex">
              {usable.map((point, index) => (
                <div
                  key={point.year}
                  className="h-full flex-1"
                  onMouseEnter={() => setHovered(index)}
                />
              ))}
            </div>

            {active && (
              <div
                className="pointer-events-none absolute top-0 z-20 w-max rounded-lg border border-surface-700 bg-surface-950/95 px-2.5 py-2 text-xs shadow-xl"
                style={{
                  left: `${x(hovered!)}%`,
                  transform:
                    hovered! > usable.length / 2 ? "translateX(-105%)" : "translateX(5%)",
                }}
                role="tooltip"
              >
                <p className="font-medium text-surface-100">{active.year}</p>
                {showYou && active.your_avg != null && (
                  <p className="mt-1 flex items-center gap-1.5 text-surface-300">
                    <span className="size-2 rounded-[2px]" style={{ backgroundColor: SERIES.you }} />
                    You: <span className="font-medium tabular-nums">{active.your_avg.toFixed(2)}</span>
                  </p>
                )}
                {active.crowd_avg != null && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-surface-300">
                    <span className="size-2 rounded-[2px]" style={{ backgroundColor: SERIES.crowd }} />
                    TMDB: <span className="font-medium tabular-nums">{active.crowd_avg.toFixed(2)}</span>
                  </p>
                )}
                <p className="mt-1 text-[10px] text-surface-500">
                  {active.count} rating{active.count === 1 ? "" : "s"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="ml-9 mt-1.5 flex">
          {usable.map((point, index) => (
            <span
              key={point.year}
              className={`flex-1 text-center text-[11px] tabular-nums transition-colors ${
                hovered === index ? "text-surface-200" : "text-surface-500"
              }`}
            >
              {point.year}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-surface-500">
        Scaled to {yMin.toFixed(1)}–{yMax.toFixed(1)}, not the full 1–10, so small
        movements are visible. The crowd line is the control: if both fall
        together, the films changed, not you.
      </p>
    </div>
  );
}
