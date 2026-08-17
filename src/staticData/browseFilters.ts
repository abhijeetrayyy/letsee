/**
 * The option lists behind the browse filter bar.
 *
 * Checked in rather than fetched. `homeData.ts` currently spends two TMDB calls
 * per home render on `/genre/movie/list` and `/genre/tv/list` to populate a
 * dozen chips, which is two chances to fail on a connection where roughly one
 * request in eight resets. Genre vocabularies change about once a decade.
 *
 * Genre names and ids verified against both TMDB list endpoints.
 */

import type { BrowseType, BrowseSort } from "@/utils/browseUrl";

export type Option = { value: string; label: string };

/** 19 film genres. */
export const MOVIE_GENRES: Option[] = [
  { value: "28", label: "Action" },
  { value: "12", label: "Adventure" },
  { value: "16", label: "Animation" },
  { value: "35", label: "Comedy" },
  { value: "80", label: "Crime" },
  { value: "99", label: "Documentary" },
  { value: "18", label: "Drama" },
  { value: "10751", label: "Family" },
  { value: "14", label: "Fantasy" },
  { value: "36", label: "History" },
  { value: "27", label: "Horror" },
  { value: "10402", label: "Music" },
  { value: "9648", label: "Mystery" },
  { value: "10749", label: "Romance" },
  { value: "878", label: "Science Fiction" },
  { value: "53", label: "Thriller" },
  { value: "10770", label: "TV Movie" },
  { value: "10752", label: "War" },
  { value: "37", label: "Western" },
];

/** 16 TV genres — a different vocabulary, not a subset. */
export const TV_GENRES: Option[] = [
  { value: "10759", label: "Action & Adventure" },
  { value: "16", label: "Animation" },
  { value: "35", label: "Comedy" },
  { value: "80", label: "Crime" },
  { value: "99", label: "Documentary" },
  { value: "18", label: "Drama" },
  { value: "10751", label: "Family" },
  { value: "10762", label: "Kids" },
  { value: "9648", label: "Mystery" },
  { value: "10763", label: "News" },
  { value: "10764", label: "Reality" },
  { value: "10765", label: "Sci-Fi & Fantasy" },
  { value: "10766", label: "Soap" },
  { value: "10767", label: "Talk" },
  { value: "10768", label: "War & Politics" },
  { value: "37", label: "Western" },
];

export function genresFor(type: BrowseType): Option[] {
  return type === "tv" ? TV_GENRES : MOVIE_GENRES;
}

export function genreLabel(id: string | undefined, type: BrowseType): string | undefined {
  if (!id) return undefined;
  return genresFor(type).find((g) => g.value === id)?.label;
}

/**
 * Languages worth offering, which is emphatically not all 187 TMDB lists.
 *
 * Chosen by measuring what actually has a catalogue behind it — films with at
 * least ten votes, by original language — rather than by guessing. The Indian
 * regional languages stay in even where the counts are small (Marathi 26,
 * Punjabi 14, Gujarati 5), because a filter that only admits large catalogues
 * can never answer the question that motivated it. Alphabetical, because a
 * `<select>` is scanned by eye.
 */
export const LANGUAGES: Option[] = [
  { value: "bn", label: "Bengali" },
  { value: "zh", label: "Chinese" },
  { value: "da", label: "Danish" },
  { value: "nl", label: "Dutch" },
  { value: "en", label: "English" },
  { value: "fa", label: "Persian" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "gu", label: "Gujarati" },
  { value: "he", label: "Hebrew" },
  { value: "hi", label: "Hindi" },
  { value: "id", label: "Indonesian" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "kn", label: "Kannada" },
  { value: "ko", label: "Korean" },
  { value: "ml", label: "Malayalam" },
  { value: "mr", label: "Marathi" },
  { value: "no", label: "Norwegian" },
  { value: "pl", label: "Polish" },
  { value: "pt", label: "Portuguese" },
  { value: "pa", label: "Punjabi" },
  { value: "ru", label: "Russian" },
  { value: "es", label: "Spanish" },
  { value: "sv", label: "Swedish" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "th", label: "Thai" },
  { value: "tr", label: "Turkish" },
  { value: "vi", label: "Vietnamese" },
];

export function languageLabel(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return LANGUAGES.find((l) => l.value === code)?.label;
}

/** Newest first — the 2020s are a likelier destination than the 1920s. */
export const DECADES: Option[] = (() => {
  const newest = Math.floor(new Date().getUTCFullYear() / 10) * 10;
  const out: Option[] = [];
  for (let y = newest; y >= 1920; y -= 10) out.push({ value: String(y), label: `${y}s` });
  return out;
})();

export const SORT_LABELS: Record<BrowseSort, string> = {
  popular: "Most popular",
  rating: "Highest rated",
  votes: "Most rated",
  new: "Newest first",
  chrono: "Oldest first",
};
