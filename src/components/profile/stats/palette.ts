import { TOKENS, TOKENS_DARK, alpha } from "@/design/tokens";
import { isDarkTheme } from "@/lib/theme";
/**
 * Two series: you, and everyone else.
 *
 * The interface has no accent colour (docs/design/SYSTEM.md §1), so the
 * series are told apart by lightness and position rather than hue: you are
 * the interface's white (`ink0`, 16.7 : 1 on the chart surface `raised`),
 * the crowd is the metadata grey (`ink500`, 6.3 : 1). The two differ by
 * 2.6 : 1 from each other, which reads at a glance for every kind of colour
 * vision because nothing depends on hue.
 *
 * The charts never lean on colour alone: the two series keep a fixed
 * left/right order inside every group, both are named in a legend, and every
 * chart has a table view. Position and text carry the identity; lightness
 * only reinforces it.
 *
 * ── On the delta colours ───────────────────────────────────────────────────
 * A difference between the two series is drawn in whichever series is ahead —
 * white when you rated above the crowd, grey when the crowd rated above you.
 * Deliberately not a red/green good-bad axis: rating a film higher than
 * everyone else is not an error.
 */

// Read at draw time, so the charts follow the app's light or dark theme:
// "you" is the ink of whichever palette is showing, never ink on ink.
const pal = () => (isDarkTheme() ? TOKENS_DARK : TOKENS);

export const SERIES = {
  get you() {
    return pal().ink0;
  },
  get crowd() {
    return pal().ink500;
  },
};

/** Softer fills for large areas; the solid steps stay for small marks. */
export const SERIES_SOFT = {
  get you() {
    return alpha(pal().ink0, 0.85);
  },
  get crowd() {
    return alpha(pal().ink500, 0.85);
  },
};

export const NEUTRAL = {
  /** Bars with no series identity — counts, activity, decades. */
  get mark() {
    return pal().active;
  },
  get markHover() {
    return pal().lineInput;
  },
  /** The zero line of a diverging axis. */
  get axis() {
    return pal().lineStrong;
  },
  get track() {
    return alpha(pal().lineStrong, 0.35);
  },
};

export type SeriesKey = keyof typeof SERIES;

/** Which colour a signed difference wears. Zero is neutral, not "good". */
export function deltaColor(delta: number | null | undefined): string {
  if (delta == null || Math.abs(delta) < 0.05) return NEUTRAL.mark;
  return delta > 0 ? SERIES.you : SERIES.crowd;
}
