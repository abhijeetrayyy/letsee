/**
 * What someone's favourites say about them (the owner: "you know about any
 * person by their favourites"). Pure, so the profile and its tests agree.
 */

export type Favourite = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  genres: string[];
};

export const favKey = (f: { itemType: string; itemId: string }) => `${f.itemType}:${f.itemId}`;

/**
 * TMDB names series genres differently ("Sci-Fi & Fantasy"), so a person with
 * both kinds of favourite would have their taste split across two spellings.
 * Folded into the film names before counting; catalogue labels that describe
 * an audience or a format rather than a taste are left out.
 */
const FOLD: Record<string, string[]> = {
  "Action & Adventure": ["Action", "Adventure"],
  "Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
  "War & Politics": ["War"],
};
const NOT_TASTE = new Set(["TV Movie", "Kids", "Soap", "Talk", "News", "Reality"]);
const SAY: Record<string, string> = { "Science Fiction": "sci-fi" };

/** The genres a person's favourites lean on most, most first, in words: "drama", "sci-fi". */
export function topGenres(favourites: Pick<Favourite, "genres">[], n = 3): string[] {
  const counts = new Map<string, number>();
  for (const f of favourites) {
    const seen = new Set<string>();
    for (const g of f.genres ?? []) for (const name of FOLD[g] ?? [g]) if (!NOT_TASTE.has(name)) seen.add(name);
    for (const name of seen) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([name]) => SAY[name] ?? name.toLowerCase());
}

/** "drama", "drama and comedy", "drama, comedy and romance". */
export function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** Their favourites that are yours too, in their order. */
export function sharedFavourites<T extends Pick<Favourite, "itemId" | "itemType">>(theirs: T[], mine: Set<string>): T[] {
  return theirs.filter((f) => mine.has(favKey(f)));
}
