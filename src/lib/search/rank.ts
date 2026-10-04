import { normalizeQuery } from "@/utils/searchIndex";

/**
 * What you typed, exactly, beats what fuzzy matching thinks you meant: exact
 * names, then names that start with it, then ones containing it, then the
 * rest — each group kept in the order its source gave (PAGES.md §4).
 */
export function rankByName<T extends { itemName: string }>(items: T[], query: string): T[] {
  const nq = normalizeQuery(query);
  const rank = (t: T) => {
    const n = normalizeQuery(t.itemName);
    return n === nq ? 0 : n.startsWith(nq) ? 1 : n.includes(nq) ? 2 : 3;
  };
  return items
    .map((t, i) => ({ t, i, r: rank(t) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ t }) => t);
}
