"use client";

import type { ReactNode } from "react";
import { SERIES } from "./palette";

/** The one card shell every chart in this section sits in. */
export function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5 sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-surface-100">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-xs leading-relaxed text-surface-400">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/**
 * Identity is never colour alone: two series always ship a legend, and the
 * swatch sits beside a name rather than replacing it.
 */
export function Legend({ showYou = true }: { showYou?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-surface-400">
      {showYou && (
        <span className="inline-flex items-center gap-2">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ backgroundColor: SERIES.you }}
            aria-hidden
          />
          You
        </span>
      )}
      <span className="inline-flex items-center gap-2">
        <span
          className="size-2.5 rounded-[3px]"
          style={{ backgroundColor: SERIES.crowd }}
          aria-hidden
        />
        Everyone on TMDB
      </span>
    </div>
  );
}

/** A single number that earns its own space. No plot, so no tooltip. */
export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-surface-800 bg-surface-900/50 px-3 py-3 text-center">
      <p
        className="text-xl font-bold tabular-nums sm:text-2xl"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-surface-400">{label}</p>
      {hint && <p className="mt-1 text-[10px] text-surface-500">{hint}</p>}
    </div>
  );
}

/** One row of mutually exclusive filters, above the charts they filter. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-surface-700/70 bg-surface-900/60 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-surface-700 text-surface-50"
                : "text-surface-400 hover:text-surface-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The hover layer. Positioned by the caller in the chart's own coordinate
 * space, and `pointer-events-none` so it can never eat the hover that spawned
 * it and flicker.
 */
export function Tooltip({
  x,
  align = "center",
  children,
}: {
  x: number;
  align?: "center" | "left" | "right";
  children: ReactNode;
}) {
  return (
    <div
      className="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[220px] rounded-lg border border-surface-700 bg-surface-950/95 px-2.5 py-2 text-xs shadow-xl backdrop-blur-sm"
      style={{
        left: `${x}%`,
        transform:
          align === "center"
            ? "translateX(-50%)"
            : align === "right"
              ? "translateX(-100%)"
              : "none",
      }}
      role="tooltip"
    >
      {children}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-surface-500">{children}</p>
  );
}
