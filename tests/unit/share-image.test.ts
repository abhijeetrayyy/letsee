import { describe, expect, it } from "vitest";
import { shareImage } from "@/utils/shareImage";

/**
 * Every detail page declared `twitter:card: "summary_large_image"` and then
 * handed it a 780x1170 poster. That card renders 1.91:1 landscape, so the
 * platform centre-crops a 2:3 portrait and discards the top and bottom — which
 * on a film poster is where the title art lives. Shared links were previewing
 * a rectangle of someone's chest.
 *
 * The rule these tests hold: the card shape must match the image that is
 * actually supplied. Declaring one shape and sending another is what did the
 * damage, so a fallback that keeps the big card would be the same bug again.
 */
describe("shareImage", () => {
  const BACKDROP = "/back.jpg";
  const POSTER = "/poster.jpg";

  it("prefers the backdrop and keeps the large card", () => {
    const s = shareImage(BACKDROP, POSTER, "The Matrix");
    expect(s.card).toBe("summary_large_image");
    expect(s.images).toHaveLength(1);
    expect(s.images[0].url).toContain("/w1280/back.jpg");
    // 1280x720 is 1.78:1 — close enough to the 1.91:1 slot to survive it.
    expect(s.images[0].width / s.images[0].height).toBeCloseTo(1.78, 2);
  });

  it("steps down to the small card when only a poster exists", () => {
    const s = shareImage(null, POSTER, "The Matrix");
    // The whole point: a portrait image must not be sent to a landscape card.
    expect(s.card).toBe("summary");
    expect(s.images[0].url).toContain("/w780/poster.jpg");
    expect(s.images[0].width / s.images[0].height).toBeLessThan(1);
  });

  it("declares dimensions so platforms do not have to guess", () => {
    for (const s of [shareImage(BACKDROP, null, "x"), shareImage(null, POSTER, "x")]) {
      expect(s.images[0].width).toBeGreaterThan(0);
      expect(s.images[0].height).toBeGreaterThan(0);
    }
  });

  it("carries the title as alt text", () => {
    expect(shareImage(BACKDROP, null, "Breaking Bad").images[0].alt).toBe("Breaking Bad");
  });

  it("emits nothing rather than a broken URL when TMDB has neither", () => {
    const s = shareImage(null, null, "Obscure Film");
    expect(s.images).toEqual([]);
    expect(s.urls).toEqual([]);
    // No image at all means the platform falls back to the site card, which is
    // correct. A `summary_large_image` with no image renders as an empty box.
    expect(s.card).toBe("summary");
  });

  it("keeps urls and images pointing at the same file", () => {
    const s = shareImage(BACKDROP, POSTER, "x");
    expect(s.urls).toEqual([s.images[0].url]);
  });
});
