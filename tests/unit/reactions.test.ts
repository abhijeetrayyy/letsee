import { describe, expect, it } from "vitest";
import { reached } from "@/lib/logging/episodes";
import { aboutQuery, parseAbout, reactionOf, reactionPreview } from "@/lib/people/reactions";

const sev = { show_id: "95396", show_name: "Severance", show_image: "/x.jpg", s: 2, e: 4 };

describe("an episode reaction", () => {
  it("opens once you've reached the episode — marked, or anything after it", () => {
    expect(reached(new Set(["2:4"]), 2, 4)).toBe(true);
    expect(reached(new Set(["2:5"]), 2, 4)).toBe(true);
    expect(reached(new Set(["3:1"]), 2, 4)).toBe(true);
    expect(reached(new Set(["2:3", "1:9"]), 2, 4)).toBe(false);
    expect(reached(new Set(["0:9"]), 2, 4)).toBe(false);
    expect(reached(new Set(), 2, 4)).toBe(false);
  });

  it("previews safely everywhere but the room", () => {
    expect(reactionPreview(sev)).toBe("Reacted to Severance S02 · E04");
  });

  it("travels in the room's address and back", () => {
    expect(parseAbout(new URLSearchParams(aboutQuery(sev)))).toEqual(sev);
    expect(parseAbout(new URLSearchParams("about=95396:0:4&title=X"))).toBeNull();
    expect(parseAbout(new URLSearchParams("about=95396:2:4"))).toBeNull();
    expect(parseAbout(new URLSearchParams("about=junk&title=X"))).toBeNull();
  });

  it("is read from a message's metadata only when whole", () => {
    expect(reactionOf({ episode: sev, text: "that ending" })).toEqual({ ...sev, text: "that ending" });
    expect(reactionOf({ episode: { ...sev, s: "2" }, text: "x" })).toBeNull();
    expect(reactionOf({ media_id: "1" })).toBeNull();
    expect(reactionOf(null)).toBeNull();
  });
});
