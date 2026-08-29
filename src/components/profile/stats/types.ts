/**
 * The shape `profile_taste_stats` (089) returns.
 *
 * Every score on both scales is 1–10. The app *shows* ratings as half-stars
 * (see utils/ratingScale.ts) but stores them as integers 1–10, which happens to
 * be the same scale TMDB publishes vote_average on — so the two histograms can
 * share an axis without either being rescaled, and a delta between them is in
 * real units rather than a ratio of two different rulers.
 */

export type ScoreBucket = {
  /** 1–10. */
  score: number;
  all: number;
  movie: number;
  tv: number;
};

export type Comparison = {
  count: number;
  avg_you: number | null;
  avg_crowd: number | null;
  avg_delta: number | null;
  /** Rated at least a full point above the crowd. */
  kinder: number;
  /** At least a full point below. */
  harsher: number;
  /** Within a point either way. */
  agrees: number;
  champions: ComparedTitle[];
  disappointments: ComparedTitle[];
};

export type ComparedTitle = {
  item_id: string;
  item_type: "movie" | "tv";
  title: string | null;
  you: number;
  crowd: number;
  delta: number;
};

export type GenreStat = {
  genre: string;
  count: number;
  rated_count: number;
  your_avg: number | null;
  crowd_avg: number | null;
  /** Averaged per title over `paired_count` titles, never avg minus avg. */
  paired_count: number;
  delta: number | null;
};

export type DecadeStat = {
  decade: number;
  count: number;
  your_avg: number | null;
  crowd_avg: number | null;
};

export type DriftPoint = {
  year: number;
  count: number;
  your_avg: number | null;
  crowd_avg: number | null;
};

export type ActivityPoint = {
  year: number;
  count: number;
  movie: number;
  tv: number;
};

export type TasteStats = {
  show_scores: boolean;
  is_owner: boolean;
  coverage: {
    watched_total: number;
    /** Titles carrying a usable TMDB score. */
    crowd_known: number;
    /** Not fetched yet. This number moves when the backfill runs. */
    crowd_pending: number;
    /** Fetched, but TMDB has no score to give: zero votes, or a dead id.
     *  This number never moves, so it must not be reported as progress. */
    crowd_unrated: number;
    /** Of the titles that can carry a score, the share that do. */
    crowd_pct: number;
  };
  /** null when the profile owner has chosen not to show their ratings. */
  you: {
    histogram: ScoreBucket[];
    count: number;
    movie_count: number;
    tv_count: number;
    average: number | null;
    median: number | null;
  } | null;
  crowd: {
    histogram: ScoreBucket[];
    count: number;
    average: number | null;
  };
  comparison: Comparison | null;
  genres: GenreStat[];
  decades: DecadeStat[];
  drift: DriftPoint[];
  activity: ActivityPoint[];
};

export type TitleRow = {
  item_id: string;
  item_type: "movie" | "tv";
  title: string | null;
  image_url: string | null;
  your_score: number | null;
  crowd_score: number | null;
  release_year: number | null;
  watched_at: string | null;
};

/** Which slice of the library a drill-through is asking about. */
export type TitleQuery = {
  source: "you" | "crowd";
  bucket?: number | null;
  type?: "movie" | "tv" | null;
  genre?: string | null;
  decade?: number | null;
  label: string;
};

export type MediaFilter = "all" | "movie" | "tv";

/** Read one series out of a bucket without a switch at every call site. */
export function bucketValue(bucket: ScoreBucket, filter: MediaFilter): number {
  return filter === "movie" ? bucket.movie : filter === "tv" ? bucket.tv : bucket.all;
}
