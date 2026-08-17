/**
 * Ranking a body of work by what the person DID on it.
 *
 * The old formula was `vote_count × vote_average + popularity × 10`. Those are
 * different units bolted together: `vote_count` runs to six figures while
 * `popularity` is a decaying three-day traffic float, so one term always
 * swamped the other and which one won was arbitrary. Worse, every term
 * described the TITLE. Nothing described the person's part in it — so a
 * one-line cameo in a famous film outranked the film they carried, and
 * Spielberg's "Known For" was five uncredited cameos.
 *
 * `order`, `episode_count` and `job` were all sitting in the payload, unused.
 */

import type { Credit } from "./model";

/**
 * Billing order, the strongest available signal of what an actor did.
 *
 * TMDB's `order` is the credit-roll position: 0 is the lead. It is absent on
 * some rows, which lands mid-scale rather than at either extreme — an unknown
 * part should not beat a known lead nor lose to a known cameo.
 */
function castWeight(c: Credit): number {
  if (c.mediaType === "tv") {
    const e = c.episodeCount;
    if (e >= 50) return 1.0;
    if (e >= 20) return 0.85;
    if (e >= 6) return 0.6;
    if (e >= 2) return 0.35;
    return 0.15;
  }
  const o = c.order;
  if (o == null) return 0.5;
  if (o === 0) return 1.0;
  if (o <= 2) return 0.9;
  if (o <= 7) return 0.6;
  if (o <= 15) return 0.35;
  return 0.15;
}

/** Above-the-line jobs carry a title; the rest support it. */
const JOB_WEIGHT: Record<string, number> = {
  Director: 1.0,
  Screenplay: 0.9,
  Writer: 0.9,
  Story: 0.7,
  Producer: 0.7,
  "Executive Producer": 0.5,
  "Director of Photography": 0.8,
  Editor: 0.7,
  "Original Music Composer": 0.7,
  "Production Design": 0.6,
  "Casting": 0.4,
};

function crewWeight(c: Credit): number {
  let best = 0.3;
  for (const j of c.jobs) best = Math.max(best, JOB_WEIGHT[j] ?? 0.3);
  return best;
}

export function roleWeight(c: Credit): number {
  const acting = c.characters.length > 0 ? castWeight(c) : 0;
  const crew = c.isCrew ? crewWeight(c) : 0;
  return Math.max(acting, crew);
}

/**
 * `popularity` is deliberately absent.
 *
 * It is a rolling three-day TMDB metric, which makes a page cached for 24h
 * non-deterministic — the same request returns a different order depending on
 * when the cache filled. It contributed 0.13% of the score for Forrest Gump
 * and dominated two of Nolan's top twelve. `ln(1 + vote_count)` carries the
 * same "how known is this" signal without the churn.
 */
export function definingScore(c: Credit): number {
  return roleWeight(c) * Math.log1p(c.voteCount) * (c.voteAverage / 10);
}

/**
 * The pool that "Known for" ranks over, which depends on what the person does.
 *
 * Two corrections, both verified against live data:
 *
 * - A crew member's pool is titles whose `departments` CONTAINS their
 *   department, not titles whose (merged, single) department equals it.
 * - An actor's pool must include `presenting` at a discount, or Jimmy Fallon's
 *   page omits The Tonight Show — 2,406 episodes of it — because hosting is
 *   not a performance.
 */
export function definingWork(
  credits: Credit[],
  knownForDepartment: string | undefined,
  limit = 8,
): Credit[] {
  const kfd = knownForDepartment ?? "Acting";
  const scored: { c: Credit; s: number }[] = [];

  for (const c of credits) {
    if (c.bucket === "archive") continue;
    let discount = 1;
    if (kfd === "Acting") {
      if (c.bucket === "appearance") continue;
      if (c.bucket === "presenting") discount = 0.8;
      else if (c.characters.length === 0 && !c.isCrew) continue;
    } else {
      const inDept = c.departments.includes(kfd);
      if (!inDept && c.bucket !== "performance") continue;
      if (!inDept) discount = 0.6;
    }
    const s = definingScore(c) * discount;
    if (s > 0) scored.push({ c, s });
  }

  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
}

/**
 * The one-line summary under the name, derived rather than stored.
 *
 * It says "credits" and not "directing credits" on purpose. Naming the
 * department while counting every work title is a false claim — the first
 * draft told Spielberg's page he had "216 directing credits" when 216 was
 * every title he appears on in any capacity. The department is already stated
 * on the line above; this line is a count and a span, both true.
 *
 * `birthYear` clamps the span. Left unclamped, the measured output was Jimmy
 * Fallon "1944–2027" — thirty years before he was born — because archive
 * compilations and misdated rows leak into any date-derived aggregate. A
 * career cannot start before its owner.
 */
export function careerLine(credits: Credit[], birthYear: number | null): string | null {
  const work = credits.filter((c) => c.bucket === "performance" || c.bucket === "presenting");
  const years = work
    .map((c) => c.year)
    .filter((y): y is number => y != null && (birthYear == null || y >= birthYear));
  if (!years.length) return null;

  const from = Math.min(...years);
  const to = Math.max(...years);
  const n = work.length;

  return `${n} ${n === 1 ? "credit" : "credits"} · ${from === to ? from : `${from}–${to}`}`;
}
