import { normalizeQuery } from "@/utils/searchIndex";

/**
 * "Did you mean…" for titles and names.
 *
 * TMDB's search matches what you typed, letter for letter: "intersteller"
 * finds nothing, "the dark knigt" finds nothing useful. People type fast on a
 * phone and expect what Google does — so each word that isn't one we know is
 * replaced by the closest word that is, from the words of real titles and
 * names already in the search index (your library plus the popular catalogue,
 * up to 5,000 rows, loaded for free). If any word changed, that's the
 * suggestion; the caller decides whether to search it instead or offer it.
 *
 * Closeness is edit distance with transpositions (Damerau–Levenshtein), one
 * edit for short words and two for long ones, and ties go to the commoner word.
 * Words under three letters and numbers are left as typed — "it", "up", "9" —
 * because at that length almost everything is one edit from something.
 */
export type Vocabulary = Map<string, number>;

export function buildVocabulary(names: Iterable<string>): Vocabulary {
  const vocab: Vocabulary = new Map();
  for (const name of names) {
    for (const word of normalizeQuery(name).split(" ")) {
      if (word.length < 2) continue;
      vocab.set(word, (vocab.get(word) ?? 0) + 1);
    }
  }
  return vocab;
}

/** Edit distance with adjacent transpositions, stopping early past `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    let best = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
  }
  return d[rows - 1][cols - 1];
}

function correctWord(word: string, vocab: Vocabulary): string {
  if (word.length < 3 || /^\d+$/.test(word) || vocab.has(word)) return word;
  const max = word.length <= 4 ? 1 : 2;
  let best: { word: string; dist: number; freq: number } | null = null;
  for (const [candidate, freq] of vocab) {
    if (candidate.length < 3 || Math.abs(candidate.length - word.length) > max) continue;
    const dist = editDistance(word, candidate, max);
    if (dist > max) continue;
    if (!best || dist < best.dist || (dist === best.dist && freq > best.freq)) best = { word: candidate, dist, freq };
  }
  return best?.word ?? word;
}

/**
 * The query with unknown words replaced by their closest known word, or null
 * when nothing changed (or there was nothing to go on).
 */
export function correctQuery(query: string, vocab: Vocabulary): string | null {
  const words = normalizeQuery(query).split(" ").filter(Boolean);
  if (!words.length || vocab.size === 0) return null;
  const corrected = words.map((w) => correctWord(w, vocab));
  return corrected.some((w, i) => w !== words[i]) ? corrected.join(" ") : null;
}
