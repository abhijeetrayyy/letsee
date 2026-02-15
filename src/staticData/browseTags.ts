/**
 * Browse tags: genres and keywords for the home page "Browse by tag" section.
 * Genres use movie/TV genre routes; keywords use search discover with keyword param.
 */

export type BrowseTag =
  | { type: "genre"; mediaType: "movie"; id: number; label: string }
  | { type: "genre"; mediaType: "tv"; id: number; label: string }
  | { type: "keyword"; mediaType: "movie"; id: number; label: string }
  | { type: "keyword"; mediaType: "tv"; id: number; label: string }
  | { type: "special"; href: string; label: string };

export const BROWSE_TAGS: BrowseTag[] = [
  // Movie genres
  { type: "genre", mediaType: "movie", id: 28, label: "Action" },
  { type: "genre", mediaType: "movie", id: 35, label: "Comedy" },
  { type: "genre", mediaType: "movie", id: 18, label: "Drama" },
  { type: "genre", mediaType: "movie", id: 27, label: "Horror" },
  { type: "genre", mediaType: "movie", id: 10749, label: "Romance" },
  { type: "genre", mediaType: "movie", id: 878, label: "Sci-Fi" },
  { type: "genre", mediaType: "movie", id: 53, label: "Thriller" },
  { type: "genre", mediaType: "movie", id: 12, label: "Adventure" },
  { type: "genre", mediaType: "movie", id: 16, label: "Animation" },
  { type: "genre", mediaType: "movie", id: 80, label: "Crime" },
  { type: "genre", mediaType: "movie", id: 14, label: "Fantasy" },
  { type: "genre", mediaType: "movie", id: 99, label: "Documentary" },
  { type: "genre", mediaType: "movie", id: 9648, label: "Mystery" },
  { type: "genre", mediaType: "movie", id: 10751, label: "Family" },
  { type: "genre", mediaType: "movie", id: 36, label: "History" },
  { type: "genre", mediaType: "movie", id: 10402, label: "Music" },
  { type: "genre", mediaType: "movie", id: 37, label: "Western" },
  // TV genres
  { type: "genre", mediaType: "tv", id: 10759, label: "Action & Adventure" },
  { type: "genre", mediaType: "tv", id: 10765, label: "Sci-Fi & Fantasy" },
  { type: "genre", mediaType: "tv", id: 10762, label: "Kids" },
  { type: "genre", mediaType: "tv", id: 10763, label: "News" },
  { type: "genre", mediaType: "tv", id: 10764, label: "Reality" },
  // Keywords (TMDB keyword IDs)
  { type: "keyword", mediaType: "tv", id: 210024, label: "Anime" },
  { type: "keyword", mediaType: "movie", id: 9715, label: "Superhero" },
  { type: "keyword", mediaType: "tv", id: 9715, label: "Superhero" },
  // Special (custom discover URLs)
  {
    type: "special",
    href: "/app/search/discover?media_type=movie&genre=16&lang=ja",
    label: "Anime Films",
  },
  {
    type: "special",
    href: "/app/search/discover?media_type=movie&lang=hi",
    label: "Bollywood",
  },
];
