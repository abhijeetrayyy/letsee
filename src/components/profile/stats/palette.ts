/**
 * Two series, two colours, chosen by measurement rather than by taste.
 *
 * `#16a34a` (the app's own brand-600) and `#3987e5` clear every gate of the
 * data-viz colour check against this app's dark chart surface (#18181b):
 * both inside the dark lightness band, both above the chroma floor, both above
 * 3:1 contrast on the surface, adjacent CVD ΔE 24.3 (deuteranopia) against a
 * target of 8, normal-vision ΔE 26.4 against a floor of 15.
 *
 * The green is the app's, so "you" wears the colour the product already means
 * by *you*, and the crowd gets a hue that is unmistakable beside it — including
 * for the ~8% of men with red-green colour deficiency, for whom the green/gold
 * pairing this section used to reach for is nearly a single colour.
 *
 * Tritanopia is the one axis where the pair is close (ΔE 4.6). It is also the
 * rarest deficiency, and the charts here never lean on hue alone: the two
 * series keep a fixed left/right order inside every group, both are named in a
 * legend, and every chart has a table view. Position and text carry the
 * identity; colour only reinforces it.
 *
 * ── On the delta colours ───────────────────────────────────────────────────
 * A difference between the two series is drawn in whichever series' colour is
 * winning — green when you rated above the crowd, blue when the crowd rated
 * above you. That is deliberately not a red/green good-bad axis: rating a film
 * higher than everyone else is not an error, and colouring it as one would be
 * the chart making a judgement the data does not support.
 */

export const SERIES = {
  you: "#16a34a",
  crowd: "#3987e5",
} as const;

/** Softer fills for large areas; the solid steps stay for small marks. */
export const SERIES_SOFT = {
  you: "rgba(22, 163, 74, 0.85)",
  crowd: "rgba(57, 135, 229, 0.85)",
} as const;

export const NEUTRAL = {
  /** Bars with no series identity — counts, activity, decades. */
  mark: "#52525b",
  markHover: "#71717a",
  /** The zero line of a diverging axis. */
  axis: "#3f3f46",
  track: "rgba(63, 63, 70, 0.35)",
} as const;

export type SeriesKey = keyof typeof SERIES;

/** Which colour a signed difference wears. Zero is neutral, not "good". */
export function deltaColor(delta: number | null | undefined): string {
  if (delta == null || Math.abs(delta) < 0.05) return NEUTRAL.mark;
  return delta > 0 ? SERIES.you : SERIES.crowd;
}
