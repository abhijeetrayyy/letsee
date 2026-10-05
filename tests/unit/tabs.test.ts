import { describe, expect, it } from "vitest";
import { activeTab, hidesTabBar, tabs } from "@/components/ds/tabs";

describe("which tab a page belongs to", () => {
  it("lights Home only on the home page itself", () => {
    expect(activeTab("/app", "ana")).toBe("home");
    expect(activeTab("/app/", "ana")).toBe("home");
    expect(activeTab("/app/movie/603-the-matrix", "ana")).toBeNull();
  });

  it("files the old places under their new tab", () => {
    expect(activeTab("/app/watchlist", "ana")).toBe("up-next");
    expect(activeTab("/app/browse", "ana")).toBe("search");
    expect(activeTab("/app/search/dune", "ana")).toBe("search");
    expect(activeTab("/app/messages/42", "ana")).toBe("people");
    expect(activeTab("/app/clubs/noir", "ana")).toBe("people");
    expect(activeTab("/app/import", "ana")).toBe("you");
  });

  it("does not mistake a path that only starts the same way", () => {
    expect(activeTab("/app/searching", "ana")).toBeNull();
    expect(activeTab("/app/listsx", "ana")).toBeNull();
  });

  it("lights You on your own profile and nothing on someone else's", () => {
    expect(activeTab("/app/profile/ana", "ana")).toBe("you");
    expect(activeTab("/app/profile/Ana/year/2025", "ana")).toBe("you");
    expect(activeTab("/app/profile/bo", "ana")).toBeNull();
    expect(activeTab("/app/profile/ana", null)).toBeNull();
  });

  it("sends You to onboarding until there is a username", () => {
    expect(tabs(null).find((t) => t.key === "you")?.href).toBe("/app/welcome");
    expect(tabs("ana").find((t) => t.key === "you")?.href).toBe("/app/profile/ana");
  });

  it("steps the tab bar aside inside a room, not on the room list", () => {
    expect(hidesTabBar("/app/people/ana")).toBe(true);
    expect(hidesTabBar("/app/people")).toBe(false);
    // Find people is a page of the tab, not a room.
    expect(hidesTabBar("/app/people/find")).toBe(false);
    expect(hidesTabBar("/app/people/finder")).toBe(true);
    expect(activeTab("/app/people/find", "ray")).toBe("people");
  });
});
