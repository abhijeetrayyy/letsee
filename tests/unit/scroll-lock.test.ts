import { beforeEach, describe, expect, it } from "vitest";

// Node has no DOM: the lock only touches document.body.style.overflow.
const body = { style: { overflow: "" } };
(globalThis as unknown as { document: unknown }).document = { body };

const { lockScroll, releaseStrayLock, scrollLocksHeld } = await import("@/lib/ui/scrollLock");

describe("scroll lock", () => {
  beforeEach(() => {
    body.style.overflow = "";
  });

  it("locks while anything holds it, and lets go when the last one does", () => {
    const a = lockScroll();
    expect(body.style.overflow).toBe("hidden");
    a();
    expect(body.style.overflow).toBe("");
    expect(scrollLocksHeld()).toBe(0);
  });

  it("survives two locks ending in the wrong order — the page scrolls again", () => {
    const sheet = lockScroll();
    const diary = lockScroll(); // a sheet opened from inside the first
    sheet(); // the outer one closes first
    expect(body.style.overflow).toBe("hidden");
    diary();
    expect(body.style.overflow).toBe("");
  });

  it("ignores a release called twice", () => {
    const a = lockScroll();
    const b = lockScroll();
    a();
    a();
    expect(body.style.overflow).toBe("hidden");
    b();
    expect(body.style.overflow).toBe("");
  });

  it("clears a lock nobody holds after a navigation, and leaves a held one alone", () => {
    body.style.overflow = "hidden"; // left behind by something outside the counter
    releaseStrayLock();
    expect(body.style.overflow).toBe("");
    const held = lockScroll();
    releaseStrayLock();
    expect(body.style.overflow).toBe("hidden");
    held();
  });
});
