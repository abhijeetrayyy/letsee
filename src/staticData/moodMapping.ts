export const MOODS: Record<string, {
  label: string;
  genres: number[];
  keywords: string[];
  description: string;
  icon: string;
}> = {
  "feel-good": {
    label: "Feel Good",
    genres: [35, 10751, 10402],
    keywords: ["feel-good", "heartwarming", "uplifting"],
    description: "Light, happy, and uplifting",
    icon: "\u{1F60A}",
  },
  "thrilling": {
    label: "Thrilling",
    genres: [53, 80, 9648],
    keywords: ["suspense", "thriller", "mystery"],
    description: "Edge-of-your-seat tension",
    icon: "\u{1F525}",
  },
  "scary": {
    label: "Scary",
    genres: [27, 9648],
    keywords: ["horror", "creepy", "supernatural"],
    description: "For when you want a fright",
    icon: "\u{1F47B}",
  },
  "romantic": {
    label: "Romantic",
    genres: [10749, 35],
    keywords: ["romance", "love", "romantic comedy"],
    description: "Love is in the air",
    icon: "\u2764\uFE0F",
  },
  "thoughtful": {
    label: "Thoughtful",
    genres: [18, 36, 10752],
    keywords: ["thought-provoking", "drama", "emotional"],
    description: "Deep and meaningful stories",
    icon: "\u{1F9E0}",
  },
  "funny": {
    label: "Funny",
    genres: [35, 10751],
    keywords: ["comedy", "humor", "hilarious"],
    description: "Laugh-out-loud entertainment",
    icon: "\u{1F604}",
  },
  "action-packed": {
    label: "Action Packed",
    genres: [28, 12, 878],
    keywords: ["action", "adventure", "explosive"],
    description: "High-octane excitement",
    icon: "\u{1F4A5}",
  },
  "chill": {
    label: "Chill & Relaxed",
    genres: [99, 36, 16],
    keywords: ["relaxing", "beautiful", "nature"],
    description: "Slow down and unwind",
    icon: "\u{1F30A}",
  },
  "mind-bending": {
    label: "Mind Bending",
    genres: [878, 9648, 53],
    keywords: ["twist", "surreal", "mind-bending"],
    description: "Reality-bending plots",
    icon: "\u{1F300}",
  },
  "nostalgic": {
    label: "Nostalgic",
    genres: [18, 10749, 35],
    keywords: ["nostalgia", "classic", "retro"],
    description: "Trip down memory lane",
    icon: "\u{1F9F3}",
  },
};

export const RUNTIME_OPTIONS = [
  { value: "under-90", label: "Under 90 min", max: 90 },
  { value: "90-120", label: "90-120 min", min: 90, max: 120 },
  { value: "120-150", label: "2-2.5 hours", min: 120, max: 150 },
  { value: "over-150", label: "Over 2.5 hours", min: 150 },
];

export const DECADE_OPTIONS = [
  { value: "2020s", label: "2020s", gte: "2020-01-01" },
  { value: "2010s", label: "2010s", gte: "2010-01-01", lte: "2019-12-31" },
  { value: "2000s", label: "2000s", gte: "2000-01-01", lte: "2009-12-31" },
  { value: "1990s", label: "1990s", gte: "1990-01-01", lte: "1999-12-31" },
  { value: "1980s", label: "1980s", gte: "1980-01-01", lte: "1989-12-31" },
  { value: "70s-older", label: "1970s & older", lte: "1979-12-31" },
];

export const MEDIA_TYPE_OPTIONS = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
  { value: "both", label: "Either" },
];
