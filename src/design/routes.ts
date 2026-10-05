/**
 * Every route, the page family it belongs to, and how far the redesign has
 * reached it.
 *
 * The source of truth for `docs/design/EXECUTION.md` §2. A `page.tsx` that is
 * not listed here fails `tests/invariants/routes-have-families.test.ts`, so a
 * new page cannot ship without someone deciding which template it uses.
 *
 * Status: "-" not started · "M" mechanical (tokens, codemods) · "V" on the new
 * look · "S" new structure shipped · "done" definition of done passed.
 */
export type Family = "focus" | "stream" | "detail" | "room" | "collection" | "recap" | "task";
export type Status = "-" | "M" | "V" | "S" | "done";

export type RouteEntry = {
  family: Family;
  /** The step of phase 5 that restructures it (EXECUTION.md §1). */
  step: number;
  status: Status;
  /** Where it is going, when the route itself will become a redirect. */
  becomes?: string;
};

export const ROUTES: Record<string, RouteEntry> = {
  "/": { family: "focus", step: 9, status: "S" },
  "/invite": { family: "focus", step: 9, status: "S" },
  "/login": { family: "focus", step: 9, status: "S" },
  "/signup": { family: "focus", step: 9, status: "S" },
  "/forgot-password": { family: "focus", step: 9, status: "V" },
  "/update-password": { family: "focus", step: 9, status: "V" },
  "/tv-time": { family: "focus", step: 9, status: "V" },

  "/app": { family: "stream", step: 5, status: "S" },

  "/app/movie/[id]": { family: "detail", step: 2, status: "V" },
  "/app/movie/[id]/cast": { family: "collection", step: 2, status: "V" },
  "/app/tv/[id]": { family: "detail", step: 2, status: "V" },
  "/app/tv/[id]/cast": { family: "collection", step: 2, status: "V" },
  "/app/tv/[id]/season/[seasonNumber]": { family: "detail", step: 2, status: "V" },
  "/app/tv/[id]/season/[seasonNumber]/episode/[episodeId]": { family: "detail", step: 2, status: "V" },
  "/app/person/[id]": { family: "detail", step: 8, status: "V" },
  "/app/review/[id]": { family: "detail", step: 8, status: "S" },
  "/app/profile/[id]": { family: "detail", step: 8, status: "S" },
  "/app/lists/[listId]": { family: "detail", step: 8, status: "S" },

  "/app/people": { family: "collection", step: 4, status: "S" },
  "/app/people/find": { family: "collection", step: 4, status: "S" },
  "/app/people/[username]": { family: "room", step: 4, status: "S" },
  "/app/up-next": { family: "collection", step: 6, status: "S" },

  "/app/people/g/[slug]": { family: "room", step: 4, status: "S" },
  "/app/links": { family: "collection", step: 9, status: "S" },
  "/app/tonight": { family: "room", step: 4, status: "V" },

  "/app/search": { family: "collection", step: 7, status: "S" },
  "/app/lists": { family: "collection", step: 8, status: "S" },

  "/app/profile/[id]/month/[month]": { family: "recap", step: 8, status: "S" },
  "/app/profile/[id]/year/[year]": { family: "recap", step: 8, status: "S" },

  "/app/welcome": { family: "focus", step: 9, status: "S" },
  "/app/settings": { family: "task", step: 9, status: "S" },
  "/app/import": { family: "task", step: 9, status: "V" },
  "/app/quick-add": { family: "task", step: 9, status: "S" },
};
