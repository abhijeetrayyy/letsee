import type { TitleGraph } from "./fetch";

/**
 * "Related people", computed — because TMDB has none.
 *
 * `/person/{id}/similar`, `/recommendations`, `/related` and `/lists` all
 * return 404 status_code 34. So the only honest answer is co-occurrence: who
 * keeps turning up on the same films.
 *
 * Two things make the difference between a useful list and a trivia list.
 *
 * The seeds are scripted work only. Unfiltered, Nicole Kidman ranks fifth on
 * Tom Cruise with eight co-occurrences, five of which are talk shows and award
 * broadcasts they merely both attended — which is not a collaboration, it is a
 * seating chart.
 *
 * And a big cast is damped. Two people in a four-hander worked together; two
 * people billed 12th and 14th in an ensemble of forty may never have met.
 */

export type Collaborator = {
  id: number;
  name: string;
  profilePath: string | null;
  score: number;
  count: number;
  /** What they did together, most recent first — the evidence for the claim. */
  titles: string[];
  role: "cast" | "crew";
  job?: string;
};

export function collaborators(
  graphs: TitleGraph[],
  personId: number,
  titleName: (g: TitleGraph) => string,
): { onScreen: Collaborator[]; behind: Collaborator[] } {
  type Acc = Omit<Collaborator, "score"> & { score: number; jobs: Map<string, number> };
  const cast = new Map<number, Acc>();
  const crew = new Map<number, Acc>();

  for (const g of graphs) {
    if (!g) continue;
    const damp = 1 / Math.log(6 + g.cast.length);
    const mine = g.cast.find((c) => c.id === personId);
    const name = titleName(g);

    for (const c of g.cast) {
      if (c.id === personId) continue;
      // Billing distance: a co-lead counts for much more than a bit part.
      const gap = mine ? Math.abs(c.order - mine.order) : 6;
      const add = damp * (1 / (1 + gap / 6));
      const e = cast.get(c.id) ?? {
        id: c.id, name: c.name, profilePath: c.profile_path, score: 0, count: 0,
        titles: [], role: "cast" as const, jobs: new Map<string, number>(),
      };
      e.score += add;
      e.count += 1;
      if (e.titles.length < 4) e.titles.push(name);
      cast.set(c.id, e);
    }

    for (const c of g.crew) {
      if (c.id === personId) continue;
      const e = crew.get(c.id) ?? {
        id: c.id, name: c.name, profilePath: c.profile_path, score: 0, count: 0,
        titles: [], role: "crew" as const, jobs: new Map<string, number>(),
      };
      e.score += damp * 0.9;
      e.count += 1;
      e.jobs.set(c.job, (e.jobs.get(c.job) ?? 0) + 1);
      if (e.titles.length < 4) e.titles.push(name);
      crew.set(c.id, e);
    }
  }

  const finish = (m: Map<number, Acc>): Collaborator[] =>
    [...m.values()]
      // Once is a coincidence. The list is about people who keep coming back.
      .filter((e) => e.count >= 2)
      .map((e) => {
        const job = [...e.jobs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const { jobs: _drop, ...rest } = e;
        return { ...rest, job };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

  return { onScreen: finish(cast), behind: finish(crew) };
}
