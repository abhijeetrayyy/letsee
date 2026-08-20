import { describe, expect, it } from "vitest";
import { pickLogo, pickLogoEntry } from "@/utils/title/logo";

/**
 * The server now chooses the wordmark and ships one logo instead of every
 * language's — 61 of them for The Matrix, each carrying seven fields nothing
 * reads once the choice is made.
 *
 * That is only safe while the two entry points agree. `pickLogo` still runs on
 * the client against whatever it receives, so if `pickLogoEntry` picked a
 * different file the hero would show one wordmark during SSR and another after
 * hydration — the exact swap the original docblock was written to prevent.
 * They share a comparator now; these tests are what keeps that true.
 */
const logo = (o: Partial<Record<string, unknown>>) => ({
  file_path: "/a.png",
  iso_639_1: "en",
  vote_average: 0,
  vote_count: 0,
  aspect_ratio: 3,
  width: 300,
  height: 100,
  ...o,
});

describe("pickLogoEntry agrees with pickLogo", () => {
  const cases: { name: string; logos: ReturnType<typeof logo>[] }[] = [
    { name: "one candidate", logos: [logo({ file_path: "/only.png" })] },
    {
      name: "votes decide",
      logos: [
        logo({ file_path: "/low.png", vote_average: 1 }),
        logo({ file_path: "/high.png", vote_average: 9 }),
      ],
    },
    {
      name: "count breaks a vote tie",
      logos: [
        logo({ file_path: "/few.png", vote_average: 5, vote_count: 1 }),
        logo({ file_path: "/many.png", vote_average: 5, vote_count: 40 }),
      ],
    },
    {
      name: "raster beats svg at equal standing",
      logos: [logo({ file_path: "/v.svg" }), logo({ file_path: "/r.png" })],
    },
    {
      name: "non-English are excluded",
      logos: [
        logo({ file_path: "/es.png", iso_639_1: "es", vote_average: 10 }),
        logo({ file_path: "/en.png", iso_639_1: "en", vote_average: 1 }),
      ],
    },
    { name: "untagged counts as usable", logos: [logo({ file_path: "/x.png", iso_639_1: null })] },
  ];

  for (const c of cases) {
    it(`picks the same file: ${c.name}`, () => {
      const entry = pickLogoEntry({ logos: c.logos });
      const direct = pickLogo({ logos: c.logos });
      expect(entry).not.toBeNull();
      expect(direct).not.toBeNull();
      // The url is built from file_path, so a match proves the same entry won.
      expect(direct!.url).toContain(entry!.file_path as string);
    });

    it(`re-picking the shipped winner is stable: ${c.name}`, () => {
      // What the client actually does: pickLogo over an array of exactly one.
      const entry = pickLogoEntry({ logos: c.logos })!;
      const fromServerShipped = pickLogo({ logos: [entry] });
      expect(fromServerShipped!.url).toBe(pickLogo({ logos: c.logos })!.url);
    });
  }

  it("returns null when nothing is usable, and pickLogo agrees", () => {
    const none = { logos: [logo({ iso_639_1: "fr" })] };
    expect(pickLogoEntry(none)).toBeNull();
    expect(pickLogo(none)).toBeNull();
  });
});
