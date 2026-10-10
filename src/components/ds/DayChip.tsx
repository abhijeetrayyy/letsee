"use client";

import { Calendar } from "lucide-react";

/**
 * "Pick a day", as a chip that opens the calendar wherever it's tapped.
 *
 * It used to be a label around a visually hidden date field, and on a
 * computer it did nothing: Chrome opens a date field's calendar only from the
 * field's own icon, and a hidden field has no icon to click (owner report,
 * 10 Oct 2026: "picking a time … not working"). Here the real field lies over
 * the whole chip, transparent, so a tap lands on it — phones open their own
 * picker for that — and a click asks for the calendar outright (`showPicker`,
 * in every current browser; where it's refused, the field still has focus and
 * takes typed digits).
 */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: y === new Date().getFullYear() ? undefined : "numeric",
  });
}

export default function DayChip({
  value,
  max,
  on,
  className,
  onPick,
  disabled = false,
}: {
  /** yyyy-mm-dd: the day shown when `on`, and where the calendar opens. */
  value: string;
  max?: string;
  /** A day other than the quick ones is chosen: show it, and look selected. */
  on: boolean;
  /** The chip's look, from the caller (it matches the chips beside it). */
  className: string;
  onPick: (day: string) => void;
  disabled?: boolean;
}) {
  return (
    <span className={`relative has-focus-visible:ring-2 has-focus-visible:ring-focus ${className} ${disabled ? "opacity-60" : ""}`}>
      <Calendar className="size-4" aria-hidden />
      <span aria-hidden>{on ? dayLabel(value) : "Pick a day"}</span>
      <input
        type="date"
        value={value}
        max={max}
        disabled={disabled}
        aria-label={on ? `Day watched: ${dayLabel(value)}. Pick another day` : "Pick a day"}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // Already open, or not allowed here: the focused field still works.
          }
        }}
        onChange={(e) => e.target.value && onPick(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed"
      />
    </span>
  );
}
