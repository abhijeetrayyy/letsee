/**
 * The picture a shared link shows, and the card shape that matches it.
 *
 * Every detail page declared `twitter:card: "summary_large_image"` and then
 * handed it a poster — 780x1170, a 2:3 portrait. That card renders 1.91:1
 * landscape, so the platform centre-crops the poster and throws away the top
 * and bottom, which on a film poster is where the title usually is. The link
 * previews were showing a rectangle of someone's chest.
 *
 * Two shapes are available and only one of them is landscape:
 *
 *   backdrop   w1280  1280x720   16:9  — near enough to 1.91:1 to survive
 *   poster     w780    780x1170  2:3   — a large_image card destroys it
 *
 * So: prefer the backdrop and keep the big card; fall back to the poster and
 * step down to `summary`, which shows a small square thumbnail and crops far
 * less. Choosing the card to fit the image is the part that was missing —
 * declaring a shape and then supplying a different one is what did the damage.
 *
 * Episode pages already pass a still, which is 16:9 and correct as-is.
 */

export type ShareImage = {
  /** OpenGraph `images` entry, sized so platforms do not have to guess. */
  images: { url: string; width: number; height: number; alt: string }[];
  /** The Twitter card shape this image actually fits. */
  card: "summary_large_image" | "summary";
  /** Bare URLs, for the `twitter.images` field. */
  urls: string[];
};

const TMDB = "https://image.tmdb.org/t/p";

export function shareImage(
  backdropPath: string | null | undefined,
  posterPath: string | null | undefined,
  alt: string,
): ShareImage {
  if (backdropPath) {
    const url = `${TMDB}/w1280${backdropPath}`;
    return {
      images: [{ url, width: 1280, height: 720, alt }],
      card: "summary_large_image",
      urls: [url],
    };
  }

  if (posterPath) {
    const url = `${TMDB}/w780${posterPath}`;
    return {
      images: [{ url, width: 780, height: 1170, alt }],
      // Deliberately the smaller card. A portrait image in a large_image slot
      // looks broken; in a summary slot it looks like a poster.
      card: "summary",
      urls: [url],
    };
  }

  return { images: [], card: "summary", urls: [] };
}
