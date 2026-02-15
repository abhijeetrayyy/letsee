/**
 * Anime-only browse tags for the "Browse anime" section.
 * Genres, keywords and special discover URLs for anime TV and movies.
 */

export type AnimeTag =
  | { type: "genre"; mediaType: "movie"; id: number; label: string }
  | { type: "genre"; mediaType: "tv"; id: number; label: string }
  | { type: "keyword"; mediaType: "movie"; id: number; label: string }
  | { type: "keyword"; mediaType: "tv"; id: number; label: string }
  | { type: "special"; href: string; label: string };

export const ANIME_TAGS: AnimeTag[] = [
  // Anime keywords (TMDB)
  { type: "keyword", mediaType: "tv", id: 210024, label: "Anime series" },
  { type: "keyword", mediaType: "movie", id: 210024, label: "Anime films" },
  { type: "keyword", mediaType: "tv", id: 237451, label: "Isekai" },
  // Animation genres (anime-heavy)
  { type: "genre", mediaType: "tv", id: 16, label: "Animation TV" },
  { type: "genre", mediaType: "movie", id: 16, label: "Animation movies" },
  // Special: Japanese animated films
  {
    type: "special",
    href: "/app/search/discover?media_type=movie&genre=16&lang=ja",
    label: "Japanese animation",
  },
  // Anime + genre combos
  {
    type: "special",
    href: "/app/search/discover?media_type=tv&keyword=210024&genre=28",
    label: "Anime action",
  },
];
