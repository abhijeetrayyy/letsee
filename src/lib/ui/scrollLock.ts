/**
 * Stopping the page from scrolling behind a sheet, a search panel or a
 * lightbox — counted, so locks can overlap and end in any order.
 *
 * Each of those used to save `body.style.overflow`, set "hidden", and put the
 * saved value back when it closed. Two at once (the diary sheet opened from a
 * poster's marks sheet, a lightbox over a sheet) saved "hidden" as the value
 * to restore; closed in the wrong order, the page was left unscrollable — on
 * a phone, until you reloaded. Now the first lock hides the overflow, the last
 * release restores it, and a route change clears a lock nobody holds
 * (releaseStrayLock, called by the shell).
 */
let held = 0;
let original: string | null = null;

export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (held === 0) {
    original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  held += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held = Math.max(0, held - 1);
    if (held === 0) {
      document.body.style.overflow = original && original !== "hidden" ? original : "";
      original = null;
    }
  };
}

/** After a navigation: if nothing holds a lock, the page must scroll. */
export function releaseStrayLock() {
  if (typeof document === "undefined") return;
  if (held === 0 && document.body.style.overflow === "hidden") document.body.style.overflow = "";
}

/** For tests. */
export function scrollLocksHeld(): number {
  return held;
}
