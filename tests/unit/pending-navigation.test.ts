import { describe, expect, it } from "vitest";
import { classifyPath } from "@/lib/nav/pendingNavigation";

describe("classifyPath: which page a tap is on its way to", () => {
  it("knows a film and a series by id, whatever the slug", () => {
    expect(classifyPath("/app/movie/27205-inception")).toEqual({ kind: "title", key: "movie:27205" });
    expect(classifyPath("/app/movie/27205")).toEqual({ kind: "title", key: "movie:27205" });
    expect(classifyPath("/app/tv/1396-breaking-bad/")).toEqual({ kind: "title", key: "tv:1396" });
  });

  it("leaves a title's own sub-pages to the plain shape", () => {
    expect(classifyPath("/app/tv/1396-breaking-bad/season/1").kind).toBe("page");
    expect(classifyPath("/app/movie/27205-inception/cast").kind).toBe("page");
  });

  it("knows a person by id and a profile by name, case aside", () => {
    expect(classifyPath("/app/person/2037-cillian-murphy")).toEqual({ kind: "person", key: "person:2037" });
    expect(classifyPath("/app/profile/Ray")).toEqual({ kind: "profile", key: "profile:ray" });
    expect(classifyPath("/app/profile/r%C3%A9my")).toEqual({ kind: "profile", key: "profile:rémy" });
    expect(classifyPath("/app/profile/ray/month/2026-10").kind).toBe("page");
  });

  it("calls anything else a page", () => {
    expect(classifyPath("/app")).toEqual({ kind: "page", key: "page:/app" });
    expect(classifyPath("/app/people/jojo").kind).toBe("page");
  });
});
