import { GenreList } from "@/staticData/genreList";

/**
 * What a search result says besides its name, so the right one can be picked
 * without opening each: "Interstellar · 2014 · Film" and "Interstellar · 2022 ·
 * Series" look alike until one says *Sci-fi · ★ 8.5 — The adventures of a
 * group of explorers who make use of a newly discovered wormhole…*
 *
 * All of it comes in the TMDB search response the panel already fetches.
 */
export type SearchMeta = { genre: string | null; rating: number | null; blurb: string | null };

type Hit = {
  genre_ids?: number[];
  original_language?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  overview?: string | null;
};

const NAMES = new Map<number, string>(GenreList.genres.map((g) => [g.id, g.name]));
const SAY: Record<string, string> = {
  "Science Fiction": "Sci-fi",
  "Sci-Fi & Fantasy": "Sci-fi & fantasy",
  "Action & Adventure": "Action",
  "War & Politics": "War",
};

/** Below this many votes a score is a handful of people; it isn't shown. */
const MIN_VOTES = 20;
const MAX_BLURB = 140;

export function searchMeta(hit: Hit): SearchMeta {
  const ids = hit.genre_ids ?? [];
  // Japanese animation is "anime" to the people searching for it.
  const anime = ids.includes(16) && hit.original_language === "ja";
  const first = ids.map((id) => NAMES.get(id)).find((n): n is string => !!n) ?? null;
  const genre = anime ? "Anime" : first ? (SAY[first] ?? first) : null;

  const rating = (hit.vote_count ?? 0) >= MIN_VOTES && (hit.vote_average ?? 0) > 0 ? Math.round((hit.vote_average as number) * 10) / 10 : null;

  return { genre, rating, blurb: firstSentence(hit.overview) };
}

/** The overview's first sentence, cut at a word if it runs long. */
export function firstSentence(text?: string | null): string | null {
  const t = text?.replace(/\s+/g, " ").trim();
  if (!t) return null;
  const m = t.match(/^.+?[.!?](?=\s|$)/);
  const s = m ? m[0] : t;
  if (s.length <= MAX_BLURB) return s;
  const cut = s.slice(0, MAX_BLURB);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)).replace(/[,;:\s]+$/, "")}…`;
}
