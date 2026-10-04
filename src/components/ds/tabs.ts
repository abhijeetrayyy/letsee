/**
 * The five places (docs/design/RETHINK.md §2, docs/design/PAGES.md §0).
 *
 * Home · Search · Up next · People · You. Every other page belongs to one of
 * them or to none (a title, a person, someone else's profile); the tab bar
 * lights the one you are inside, and lights nothing on a page that belongs to
 * no tab rather than guessing.
 */
export type TabKey = "home" | "search" | "up-next" | "people" | "you";

export type Tab = { key: TabKey; label: string; href: string };

export function tabs(username: string | null): Tab[] {
  return [
    { key: "home", label: "Home", href: "/app" },
    { key: "search", label: "Search", href: "/app/search" },
    { key: "up-next", label: "Up next", href: "/app/up-next" },
    { key: "people", label: "People", href: "/app/people" },
    { key: "you", label: "You", href: username ? `/app/profile/${username}` : "/app/welcome" },
  ];
}

const UNDER: [TabKey, RegExp][] = [
  ["search", /^\/app\/(search|browse)(\/|$)/],
  ["up-next", /^\/app\/(up-next|watchlist)(\/|$)/],
  // Messages, notifications, clubs and Tonight are moving into rooms; until
  // they have, they are still People's.
  ["people", /^\/app\/(people|messages|notification|clubs|tonight)(\/|$)/],
  ["you", /^\/app\/(profile\/setup|lists|import|data)(\/|$)/],
];

export function activeTab(pathname: string, username: string | null): TabKey | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/app") return "home";
  for (const [key, pattern] of UNDER) if (pattern.test(path)) return key;
  if (username) {
    const own = /^\/app\/profile\/([^/]+)/.exec(path)?.[1];
    if (own && safeDecode(own).toLowerCase() === username.toLowerCase()) return "you";
  }
  return null;
}

/**
 * Pages where the tab bar steps aside: inside a room the composer takes its
 * place (Back returns to People); logging in bulk has its own bar at the
 * bottom; and onboarding has nowhere else to go yet.
 */
export function hidesTabBar(pathname: string): boolean {
  return /^\/app\/people\/[^/]+/.test(pathname) || /^\/app\/(welcome|quick-add)(\/|$)/.test(pathname);
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
