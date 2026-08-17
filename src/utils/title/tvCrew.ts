/**
 * The real crew of a series.
 *
 * Series-level `credits.crew` is a stub in the same way `credits.cast` is, and
 * worse at the top end: measured live, Grey's Anatomy returns **0** crew there
 * against **247** in `aggregate_credits`, so a show with twenty-one seasons of
 * crew rendered no Crew section at all. Breaking Bad returns 27 against 91.
 *
 * The two payloads are shaped differently. `credits.crew` is one row per job;
 * `aggregate_credits.crew` is one row per person carrying a `jobs` array and a
 * `total_episode_count`. Flattening back to one row per job is what lets
 * `groupCrew` and `keyCrew` consume this without either of them changing.
 *
 * Ordering is the reason this is worth more than a longer list. `groupCrew`
 * keeps six people per department in array order, and over a long run that
 * order means nothing — Grey's credits 97 different directors, so six of them
 * unranked is six names drawn from a hat. Ranking by episode count first makes
 * the six the people who actually shaped the run.
 */

export type AggregateCrewEntry = {
  id?: number;
  name?: string;
  profile_path?: string | null;
  department?: string;
  total_episode_count?: number;
  jobs?: { job?: string; episode_count?: number }[];
};

export type SeriesCrewMember = {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path?: string | null;
};

export function seriesCrew(
  aggregate: { crew?: AggregateCrewEntry[] } | undefined,
  fallback: SeriesCrewMember[] | undefined,
  perDepartment = 8,
): SeriesCrewMember[] {
  const rows = aggregate?.crew ?? [];

  // A show TMDB has no aggregate for still gets whatever `credits` held.
  if (rows.length === 0) return fallback ?? [];

  const ranked = rows
    .filter((c) => c.id && c.name)
    .sort((a, b) => (b.total_episode_count ?? 0) - (a.total_episode_count ?? 0));

  /**
   * Capped per department rather than overall, because a single cut by episode
   * count would keep ninety directors and drop the editor and the composer.
   * Those two work on every episode of a series and are formally credited on
   * almost none of them, so on raw episode count they sit near the bottom of a
   * list they belong at the top of — and they are exactly who `keyCrew` needs a
   * face for.
   */
  const takenPerDepartment = new Map<string, number>();
  const out: SeriesCrewMember[] = [];

  for (const person of ranked) {
    const department = person.department ?? "";
    const taken = takenPerDepartment.get(department) ?? 0;
    if (taken >= perDepartment) continue;
    takenPerDepartment.set(department, taken + 1);

    const jobs = (person.jobs ?? [])
      .filter((j) => j.job)
      .sort((a, b) => (b.episode_count ?? 0) - (a.episode_count ?? 0));

    const base = {
      id: person.id as number,
      name: person.name as string,
      department,
      profile_path: person.profile_path ?? null,
    };

    if (jobs.length === 0) {
      out.push(base);
      continue;
    }
    // One row per job — the shape `credits.crew` arrives in, and the one
    // `groupCrew` merges back down per person.
    for (const j of jobs) out.push({ ...base, job: j.job });
  }

  return out;
}
