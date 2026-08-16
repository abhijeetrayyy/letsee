/**
 * One scale, two representations.
 *
 * Ratings are **stored** as integers 1–10 and **shown** as 0.5–5 stars in half
 * steps. Doubling is exact in both directions, so nothing is lost, nothing is
 * migrated, and a rating given before this change reads back identically: a
 * stored 7 was always "7/10" and is now 3½ stars, which is the same judgement.
 *
 * ── Why change the presentation at all ──────────────────────────────────────
 * A 1–10 grid asks a question people can't actually answer. The difference
 * between a 6 and a 7 isn't a real distinction anyone holds consistently, so
 * the choice takes longer *and* means less. Worse, it means something
 * different to each person — one user's 7 is another's 5 — which quietly
 * corrodes the best original feature in this app: taste matching scores
 * agreement as `1 - |r_a - r_b| / 9` (043_taste_matching.sql), and that term is
 * only meaningful if two people's numbers are commensurate.
 *
 * Ten half-steps rendered as stars keep the same underlying resolution while
 * making the scale legible: everyone's 4★ means roughly the same thing.
 *
 * Nothing here writes to the database. `score` remains a smallint 1–10
 * everywhere — the API contract, the import, `rating_distribution` and the
 * cached stats path are all untouched.
 */

/** Stored score (1–10) → stars (0.5–5). */
export function scoreToStars(score: number): number {
  return score / 2;
}

/** Stars (0.5–5) → stored score (1–10). */
export function starsToScore(stars: number): number {
  return Math.round(stars * 2);
}

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

/** Clamp anything to a storable score. */
export function clampScore(score: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(score)));
}

/**
 * Compact label for a stored score: "4½", "3", "½".
 *
 * A half is written as a glyph rather than ".5" because it reads as a rating
 * rather than a measurement — and because "4½" is a character shorter in the
 * many places this sits next to a title.
 */
export function formatStars(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "";
  const stars = scoreToStars(score);
  const whole = Math.floor(stars);
  const half = stars - whole >= 0.5;
  if (whole === 0) return "½";
  return half ? `${whole}½` : String(whole);
}

/** "4½ / 5" — for the one place that spells the scale out. */
export function formatStarsWithMax(score: number | null | undefined): string {
  const label = formatStars(score);
  return label ? `${label} / 5` : "";
}
