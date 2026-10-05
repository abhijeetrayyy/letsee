"use client";

import { useSyncExternalStore } from "react";

/**
 * The page you're on your way to, from the moment you tap until it arrives.
 *
 * Links don't prefetch (AppLink), so a tap on a poster waits one to three
 * seconds for the next page, and the only sign of it was a thin bar at the top
 * of the screen — far from the poster the reader's eyes were on. They tapped
 * again, or decided nothing had happened. This holds what the next page will
 * be (a title, a person, a profile, or some other page) and what the tap
 * already showed of it (the poster or face, and the name), so the shell can
 * put that page's shape on screen at once (components/ui/PendingNavigation).
 *
 * Nothing here fetches. The picture is the one already decoded in the card
 * that was tapped, used only when it has finished loading, so showing it again
 * costs no request.
 */

export type PageKind = "title" | "person" | "profile" | "page";

export type NavHint = {
  /** The name on the card that was tapped. */
  title?: string;
  /** A picture the tapped card had already loaded: the poster, face or avatar. */
  image?: string;
};

export type PendingNav = {
  kind: PageKind;
  /** What the destination is, independent of its slug: "movie:27205", "profile:ray". */
  key: string;
  /** Where it's going, so the bars can mark the destination's tab at once. */
  path: string;
  /** The path the tap was made on. Once the shell is on any other path, the wait is over. */
  fromPath: string;
  hint: NavHint;
  /** Past the short grace period, so a quick arrival never flashes a skeleton. */
  shown: boolean;
};

/**
 * A tap answered within this long never shows the stand-in: a hover-prefetched
 * page lands in a frame or two, and a skeleton for one frame reads as flicker.
 * Well under the tenth of a second that still feels like an immediate response.
 */
const GRACE_MS = 70;
/** Never leave the stand-in up if a navigation dies without the path changing. */
const GIVE_UP_MS = 15_000;

let pending: PendingNav | null = null;
let lastHint: { key: string; hint: NavHint } | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;
let giveUpTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePendingNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPendingNavigation(): PendingNav | null {
  return pending;
}

/** The server never has a navigation in flight. */
export function getServerPendingNavigation(): PendingNav | null {
  return null;
}

/** Which kind of page a path is, and which one. Slugs are ignored: `/app/movie/27205` and `/app/movie/27205-inception` are the same film. */
export function classifyPath(pathname: string): { kind: PageKind; key: string } {
  const title = pathname.match(/^\/app\/(movie|tv)\/(\d+)(?:-[^/]*)?\/?$/);
  if (title) return { kind: "title", key: `${title[1]}:${title[2]}` };
  const person = pathname.match(/^\/app\/person\/(\d+)(?:-[^/]*)?\/?$/);
  if (person) return { kind: "person", key: `person:${person[1]}` };
  const profile = pathname.match(/^\/app\/profile\/([^/]+)\/?$/);
  if (profile) {
    let name = profile[1];
    try {
      name = decodeURIComponent(name);
    } catch {
      // A malformed escape is still a usable key.
    }
    return { kind: "profile", key: `profile:${name.toLowerCase()}` };
  }
  return { kind: "page", key: `page:${pathname}` };
}

function decodeName(pathname: string): string | undefined {
  const raw = pathname.match(/^\/app\/profile\/([^/]+)/)?.[1];
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function firstLine(text: string | null | undefined): string | undefined {
  const line = text?.split("\n").map((s) => s.trim()).find(Boolean);
  return line ? line.slice(0, 120) : undefined;
}

/** What a tapped link already shows of where it goes. */
export function hintFromLink(anchor: HTMLAnchorElement): NavHint {
  const images = Array.from(anchor.querySelectorAll("img"));
  // Loaded, and a real picture: not a placeholder graphic, so the stand-in
  // never fetches anything and never blows up a tiny icon.
  const picture = images.find(
    (img) => img.complete && img.naturalWidth > 0 && !/\.svg($|\?)/.test(img.currentSrc || img.src) && !img.src.startsWith("data:"),
  );
  const title =
    anchor.dataset.navTitle?.trim() ||
    anchor.getAttribute("aria-label")?.trim() ||
    images.map((img) => img.alt.trim()).find(Boolean) ||
    firstLine(anchor.innerText);
  return { title: title || undefined, image: picture ? picture.currentSrc || picture.src : undefined };
}

/**
 * A client-side navigation to `href` has just begun (AppLink's onNavigate).
 * A link to the page you're already on (a filter, a tab, an anchor) is left
 * to the page itself: covering it would hide the thing being changed.
 */
export function startPendingNavigation(href: string, hint: NavHint = {}): void {
  if (typeof window === "undefined") return;
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return;
  }
  if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

  const { kind, key } = classifyPath(url.pathname);
  // A profile's name is its path. The link's own text can be anything — the
  // You tab's is an avatar's initial — so the path says whose it is.
  const named = kind === "profile" ? { ...hint, title: decodeName(url.pathname) ?? hint.title } : hint;

  if (graceTimer) clearTimeout(graceTimer);
  if (giveUpTimer) clearTimeout(giveUpTimer);
  pending = { kind, key, path: url.pathname, fromPath: window.location.pathname, hint: named, shown: false };
  lastHint = { key, hint: named };
  emit();

  graceTimer = setTimeout(() => {
    if (!pending || pending.key !== key) return;
    pending = { ...pending, shown: true };
    emit();
  }, GRACE_MS);
  giveUpTimer = setTimeout(clearPendingNavigation, GIVE_UP_MS);
}

export function clearPendingNavigation(): void {
  if (graceTimer) clearTimeout(graceTimer);
  if (giveUpTimer) clearTimeout(giveUpTimer);
  graceTimer = giveUpTimer = null;
  if (!pending) return;
  pending = null;
  emit();
}

/**
 * What the last tap showed of the page at `pathname`, if that's where it went.
 * A route's own loading.tsx takes over from the stand-in when the server
 * streams one, and reads this so the name and picture don't blink out.
 */
export function hintForPath(pathname: string): NavHint | undefined {
  if (!lastHint) return undefined;
  return lastHint.key === classifyPath(pathname).key ? lastHint.hint : undefined;
}

/** The navigation in flight from the page at `pathname`, if any. */
export function usePendingNavigation(pathname: string | null): PendingNav | null {
  const current = useSyncExternalStore(subscribePendingNavigation, getPendingNavigation, getServerPendingNavigation);
  return current && current.fromPath === pathname ? current : null;
}
