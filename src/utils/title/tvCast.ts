/**
 * The real cast of a series.
 *
 * Series-level `credits` is a stub, and the size of the gap is the point:
 * measured live, Breaking Bad returns **8** cast members there against **348**
 * in `aggregate_credits`, and *Echo* returns 7 against 100. The eight are not
 * even the most important eight — `credits` has no notion of how much of the
 * show a person is actually in, so a guest star from one episode sits beside
 * the lead with nothing to separate them.
 *
 * `aggregate_credits` knows. Every entry carries `total_episode_count` and a
 * `roles` array, so the cast can be ordered by how much of the series someone
 * was in — which is what "main cast" means for television and cannot be
 * derived from billing order the way it can for a film.
 *
 * The payload is large (143KB on Breaking Bad against 9.6KB) and none of that
 * weight crosses to the browser: this reduces to the top twenty before the
 * component boundary.
 */

export type AggregateCastEntry = {
  id?: number;
  name?: string;
  profile_path?: string | null;
  total_episode_count?: number;
  roles?: { character?: string; episode_count?: number }[];
};

export type SeriesCastMember = {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  episodeCount: number;
};

export function seriesCast(
  aggregate: { cast?: AggregateCastEntry[] } | undefined,
  fallback: { id?: number; name?: string; character?: string; profile_path?: string | null }[] | undefined,
  limit = 20,
): SeriesCastMember[] {
  const rows = aggregate?.cast ?? [];

  if (rows.length > 0) {
    return rows
      .filter((c) => c.id && c.name)
      .map((c) => {
        // One actor can hold several roles across a long run — Tatiana
        // Maslany is a dozen characters on Orphan Black. The one they played
        // most is the one that identifies them.
        const roles = (c.roles ?? [])
          .filter((r) => r.character?.trim())
          .sort((a, b) => (b.episode_count ?? 0) - (a.episode_count ?? 0));
        const extra = roles.length > 1 ? ` +${roles.length - 1}` : "";
        return {
          id: c.id as number,
          name: c.name as string,
          character: roles[0]?.character ? `${roles[0].character}${extra}` : undefined,
          profile_path: c.profile_path ?? null,
          episodeCount: c.total_episode_count ?? 0,
        };
      })
      .sort((a, b) => b.episodeCount - a.episodeCount)
      .slice(0, limit);
  }

  // A show TMDB has no aggregate for at all still gets whatever `credits` had.
  return (fallback ?? [])
    .filter((c) => c.id && c.name)
    .slice(0, limit)
    .map((c) => ({
      id: c.id as number,
      name: c.name as string,
      character: c.character,
      profile_path: c.profile_path ?? null,
      episodeCount: 0,
    }));
}
