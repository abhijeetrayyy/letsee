/**
 * Sorting a person's credits into work and not-work.
 *
 * `combined_credits` mixes the filmography with talk-show drop-ins, awards
 * telecasts, reality guest spots and archive footage, and the mix is not a
 * rounding error: Christopher Nolan has 31 of 33 movie cast rows as "Self",
 * and unranked his own page led with *The Daily Show*, *The Tonight Show* and
 * *The Late Show* before it reached *Interstellar*.
 *
 * The naive fix is a "hide talk shows" toggle, and it is a trap. Jimmy Fallon's
 * Tonight Show (2,406 episodes), Late Night (375) and SNL cast run (119) every
 * one carry a character beginning "Self" — so any rule that hides Self credits
 * deletes his career from his own page. Hosting is not an interruption of the
 * work; for a host it IS the work.
 *
 * So nothing is hidden. Credits are BUCKETED, and every bucket is reachable.
 *
 *   performance — a role. The filmography.
 *   presenting  — hosting, or narrating a documentary. A job, shown as one.
 *   appearance  — turning up as yourself. Kept, counted, collapsed.
 *   archive     — old footage of them, used without their involvement.
 *
 * The asymmetry that governs every rule below: letting a talk show through is
 * a blemish, hiding a real starring role is a bug. So the function FAILS OPEN —
 * anything it cannot classify is a performance.
 */

export type Bucket = "performance" | "presenting" | "appearance" | "archive";

/** Talk, News, Reality, Documentary. */
const NONFICTION = new Set([10767, 10763, 10764, 99]);

const SELF = /^(self|him\s?self|her\s?self|themsel(f|ves))\b/i;
const ARCHIVE = /\barchive\b/i;

const ROLE_WORDS = "host|co-host|narrator|presenter|anchor|moderator|commentator|interviewer|panelist|contestant|judge";

/**
 * A presenting role must be the WHOLE character, not its first word.
 *
 * Anchoring on `^(host|judge|…)\b` alone matched "Judge Bumbleton" and
 * "Interviewer #2" as strongly as "Judge", quietly moving fictional characters
 * out of the filmography and into the collapsed section — the exact failure
 * this file exists to avoid. So: the bare word, optionally followed by
 * parentheticals like "(voice)"…
 */
const PRES_ROLE_WHOLE = new RegExp(`^(${ROLE_WORDS})\\b\\s*(\\([^()]*\\)\\s*)*$`, "i");
/** …or the word followed by a qualifier, as in "Narrator - India (voice)". */
const PRES_ROLE_QUALIFIED = new RegExp(`^(${ROLE_WORDS})\\b\\s*[-/–]`, "i");

/** Deliberately excludes "presenter" — see the ordering note below. */
const HOST_WORD = /\b(host|co-host|anchor|narrator|moderator)\b/i;
const GUEST_HOST = /\bguest\s+(co-)?(host|judge|panelist|presenter|anchor)\b/i;
const GUEST_WORD = /\b(guest|nominee|winner|presenter|panelist|contestant|interviewee|cameo|audience|attendee)\b/i;
const AWARD_NAME = /\b(awards?|oscars?|emmys?|globes?|baftas?|grammys?|ceremony|red carpet)\b/i;

export type CastLike = {
  character?: string;
  episode_count?: number;
  genre_ids?: number[];
  name?: string;
  title?: string;
  video?: boolean;
};

/**
 * Four orderings in here are load-bearing and were each found by measuring, not
 * by reasoning:
 *
 * 1. "presenter" lives in GUEST_WORD and NOT in HOST_WORD. Otherwise Tom
 *    Cruise's "Self - Winner / Presenter" at the Golden Globes, and ~15 more
 *    award-ceremony rows, get promoted into hosting *jobs*.
 * 2. GUEST_HOST is tested before HOST_WORD, or "Self - Guest Co-Host" and
 *    "Self - Guest Judge" become jobs — while "Self - Host & Musical Guest"
 *    correctly stays a job.
 * 3. The AWARD_NAME clause is required because award telecasts carry
 *    `genre_ids: []` — 49 TV rows across 30 shows have no genre at all,
 *    including the Oscars, the MTV Awards and Filmfare. Genre filtering alone
 *    lets every one of them through on every person page.
 * 4. The default is `performance`. `character` is not reliably English or even
 *    ASCII in this data — the sample contains Meryl Streep as "讲述" and a
 *    typo'd "jadges" — so an unclassifiable row is shown, never hidden.
 */
export function classifyCast(c: CastLike): Bucket {
  const ch = (c.character ?? "").trim();
  const eps = c.episode_count ?? 0;
  const genres = c.genre_ids ?? [];
  const title = c.name ?? c.title ?? "";
  const nonfiction = genres.some((g) => NONFICTION.has(g));

  if (ARCHIVE.test(ch)) return "archive";

  const presRole = PRES_ROLE_WHOLE.test(ch) || PRES_ROLE_QUALIFIED.test(ch);

  if (SELF.test(ch) || presRole) {
    if (GUEST_HOST.test(ch)) return "appearance";
    if (HOST_WORD.test(ch)) {
      /**
       * Narrating a documentary is a job. Narrating a scripted feature is a
       * performance — and routing it to `presenting` filed it beside talk-show
       * hosting gigs and pulled it out of the filmography altogether. Measured
       * across the cohort this releases 29 rows back to `performance`, every
       * one a scripted-fiction narration, while leaving genuine documentary
       * narration where it belongs.
       */
      return SELF.test(ch) || nonfiction ? "presenting" : "performance";
    }
    if (GUEST_WORD.test(ch)) return "appearance";
    // An unlabelled regular is a job: nobody does 20 episodes as a drop-in.
    if (eps >= 20) return "presenting";
    return "appearance";
  }

  // No character at all, on something that is not fiction.
  const awardish = AWARD_NAME.test(title) && !genres.some((g) => !NONFICTION.has(g));
  if (ch === "" && (nonfiction || awardish)) return "appearance";

  return "performance";
}

/**
 * Courtesy credits, which are not work.
 *
 * Measured live: Spielberg carries 20 of these (14 "Thanks", 5 "Presenter"
 * vanity cards, 1 "In Memory Of"), Nolan 4, Hanks 3, Cruise 2.
 */
export const COURTESY_JOBS = new Set([
  "Thanks",
  "Special Thanks",
  "In Memory Of",
  "Presenter",
  "Dedicatee",
]);

/**
 * Sub-signals worth showing on a row, parsed once.
 *
 * `video: true` is deliberately NOT a bucket. It marks video-first releases,
 * not only DVD featurettes — for a direct-to-video actor that is their entire
 * late career, and hard-hiding on it deleted named leads at billing order 0
 * before any other signal could save them. It earns a label, never a demotion.
 */
export function creditFlags(c: CastLike & { order?: number }) {
  const ch = c.character ?? "";
  return {
    voice: /\(voice\)/i.test(ch),
    uncredited: /\(uncredited\)/i.test(ch),
    video: c.video === true,
  };
}
