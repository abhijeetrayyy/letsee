import { describe, expect, it } from "vitest";
import { MOODS } from "@/staticData/moods";
import { buildBrowseUrl, parseBrowseParams } from "@/utils/browseUrl";

describe("moods", () => {
  it("each opens browse with its filters intact", () => {
    for (const m of MOODS) {
      const url = buildBrowseUrl(m.params);
      const back = parseBrowseParams(Object.fromEntries(new URL(url, "https://x").searchParams));
      for (const [k, v] of Object.entries(m.params)) expect(back[k as keyof typeof back], `${m.key}.${k}`).toBe(v);
    }
  });

  it("have unique keys and labels", () => {
    expect(new Set(MOODS.map((m) => m.key)).size).toBe(MOODS.length);
    expect(new Set(MOODS.map((m) => m.label)).size).toBe(MOODS.length);
  });
});
