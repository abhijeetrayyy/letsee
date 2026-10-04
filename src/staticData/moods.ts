/**
 * Moods for browse (docs/design/PAGES.md §4, "browse by genre and mood"): a
 * way in when you don't know what you want. Each is a set of browse filters.
 *
 * Keyword ids checked against TMDB's /search/keyword on 3 Oct 2026, and kept
 * only where /discover returns enough to browse — "feel good" (2 films),
 * "twist ending" (26) and "cult film" (7) were dropped for that reason.
 */
import type { BrowseParams } from "@/utils/browseUrl";

export type Mood = { key: string; label: string; params: Partial<BrowseParams> };

export const MOODS: Mood[] = [
  { key: "light", label: "Something light", params: { genre: "35" } },
  { key: "tense", label: "Edge of your seat", params: { genre: "53" } },
  { key: "true", label: "Based on a true story", params: { keyword: "9672" } },
  { key: "growing-up", label: "Coming of age", params: { keyword: "10683" } },
  { key: "heist", label: "A good heist", params: { keyword: "10051" } },
  { key: "time-loop", label: "Time loops", params: { keyword: "10854" } },
  { key: "road", label: "On the road", params: { keyword: "7312" } },
  { key: "small-town", label: "Small-town stories", params: { keyword: "1415" } },
  { key: "dystopia", label: "Dystopias", params: { keyword: "4565" } },
  { key: "found-family", label: "Found family", params: { keyword: "248927" } },
  { key: "slow-burn", label: "Slow burn", params: { keyword: "277551", sort: "rating" } },
];
