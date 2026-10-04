/**
 * Edit before you share (docs/design/PAGES.md §6, recaps): what goes on a
 * month or year card before it becomes an image — a line of your own, which
 * four posters, which parts show. Never saved anywhere; it shapes the picture
 * you export. Plain functions, tested (tests/unit/recap-edits.test.ts).
 */
export const MAX_POSTERS = 4;
export const MAX_LINE = 80;

export type RecapEdits = {
  /** A line of your own under your name. Empty means none. */
  line: string;
  /** Which posters, in order, as `type:id`. */
  posters: string[];
  /** Parts of the card left off. */
  hidden: string[];
};

export function startEdits(defaultPosters: string[]): RecapEdits {
  return { line: "", posters: defaultPosters.slice(0, MAX_POSTERS), hidden: [] };
}

/** One line, no runs of spaces, at most 80 characters. */
export function cleanLine(text: string): string {
  return text.replace(/\s+/g, " ").trimStart().slice(0, MAX_LINE);
}

/**
 * Tap a poster: in, it comes off; out, it goes on at the end — unless four
 * are already on, in which case nothing changes (the editor says so).
 */
export function togglePoster(edits: RecapEdits, key: string): RecapEdits {
  if (edits.posters.includes(key)) return { ...edits, posters: edits.posters.filter((k) => k !== key) };
  if (edits.posters.length >= MAX_POSTERS) return edits;
  return { ...edits, posters: [...edits.posters, key] };
}

export function toggleSection(edits: RecapEdits, section: string): RecapEdits {
  return { ...edits, hidden: edits.hidden.includes(section) ? edits.hidden.filter((s) => s !== section) : [...edits.hidden, section] };
}

export const shows = (edits: RecapEdits, section: string) => !edits.hidden.includes(section);

/** The chosen posters as films, in the chosen order; a key no longer in the pool is dropped. */
export function chosenFilms<T extends { itemType: string; itemId: string }>(pool: T[], edits: RecapEdits): T[] {
  const byKey = new Map(pool.map((f) => [`${f.itemType}:${f.itemId}`, f]));
  return edits.posters.map((k) => byKey.get(k)).filter((f): f is T => !!f);
}
