/**
 * Ranking "Because you love X" (see /api/because).
 *
 * Each candidate from TMDB's two lists scores for what it shares with the
 * favourite: being on TMDB's recommendations (2) or similar (1) list, the same
 * original language (2 — the strongest signal that it's the same kind of
 * cinema), an era within fifteen years (1), each genre in common (½), and how
 * known it is (up to about 2, by the log of its votes). Anything with a
 * handful of votes or no poster is a stub, and dropped.
 */
export type BecauseCandidate = {
  id?: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  original_language?: string | null;
  genre_ids?: number[];
  vote_count?: number | null;
};

export type BecauseItem = { id: number; type: "movie" | "tv"; title: string; posterPath: string; year: string | null };

type Seed = { id: number; language: string | null; year: number | null; genreIds: number[] };

const MIN_VOTES = 20;

export function rankBecause(seed: Seed, recommended: BecauseCandidate[], similar: BecauseCandidate[], type: "movie" | "tv", limit = 20): BecauseItem[] {
  const pool = new Map<number, { c: BecauseCandidate; score: number }>();
  const add = (c: BecauseCandidate, listScore: number) => {
    if (typeof c.id !== "number" || c.id === seed.id || !c.poster_path || (c.vote_count ?? 0) < MIN_VOTES) return;
    const prior = pool.get(c.id);
    if (prior) {
      prior.score += listScore;
      return;
    }
    const year = Number((c.release_date ?? c.first_air_date ?? "").slice(0, 4)) || null;
    const shared = (c.genre_ids ?? []).filter((g) => seed.genreIds.includes(g)).length;
    const score =
      listScore +
      (seed.language && c.original_language === seed.language ? 2 : 0) +
      (seed.year && year && Math.abs(seed.year - year) <= 15 ? 1 : 0) +
      shared * 0.5 +
      Math.log10(Math.max(1, c.vote_count ?? 1)) / 2;
    pool.set(c.id, { c, score });
  };
  recommended.forEach((c) => add(c, 2));
  similar.forEach((c) => add(c, 1));
  return [...pool.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c }) => ({
      id: c.id as number,
      type,
      title: (c.title ?? c.name ?? "").trim() || "Untitled",
      posterPath: c.poster_path as string,
      year: (c.release_date ?? c.first_air_date ?? "").slice(0, 4) || null,
    }));
}
