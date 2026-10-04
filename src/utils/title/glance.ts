import { parseTmdbDate, type ParsedDate } from "@/utils/person/dates";
import { formatRuntime } from "@/utils/title/logo";

/**
 * The short version of a title, in words a person would use.
 *
 * The owner asked for the detail pages to "show the information in a way that
 * is very interesting, very easy to understand". The information was all on
 * the page already — but as reference: "Box office $1B · 5.4× budget" three
 * folds down under "Details and release dates", the TMDB score hidden on phones,
 * "based on comic" as one keyword chip among eighteen, a series' length as an
 * episode count you multiply out yourself.
 *
 * So each fact here answers a question someone actually has before pressing
 * play — is it good, how long is it, when does it end tonight, is it finished,
 * do I have to watch something else first, stay for the credits? — as a short
 * label, one large answer and one plain line under it. Everything is computed
 * from data the page already fetches; nothing here makes a request.
 */

export type Glance = {
  key: string;
  /** What is being answered: "Rating", "Length". */
  label: string;
  /** The answer, short: "8.5", "2h 32m", "Part 2 of 3". */
  lead: string;
  /** Set small after the lead: "/10". */
  unit?: string;
  /** One plain line saying what the lead means. */
  note?: string | null;
  /** Where to go for more ("#collection"). */
  href?: string;
};

type Keyword = { id: number; name: string };

/* ── Numbers ── */

/**
 * TMDB always sends money in USD, verified against films priced in rupees:
 * RRR is 69,000,000, not the 5,500,000,000 its ₹550cr budget would give.
 *
 * A fixed locale, not the runtime's: this renders on the server and again in
 * the browser, and the two can disagree about digit grouping — which React
 * reports as a hydration mismatch on a page that is otherwise static.
 */
export function formatMoney(amount?: number | null): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const scaled = (value: number, suffix: string) => {
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `$${rounded.toLocaleString("en-US")}${suffix}`;
  };
  // `(revenue / 1e6).toFixed(0)` printed "$0M" for anything under half a
  // million; across 95 films, three real box-office numbers rendered as zero.
  if (amount >= 1_000_000_000) return scaled(amount / 1_000_000_000, "B");
  if (amount >= 1_000_000) return scaled(amount / 1_000_000, "M");
  if (amount >= 1_000) return scaled(amount / 1_000, "K");
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** "980", "4.2K", "34K", "1.2M" — a count read at a glance, not audited. */
export function compactCount(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 10_000) return `${(Math.round(n / 100) / 10).toLocaleString("en-US")}K`;
  if (n < 1_000_000) return `${Math.round(n / 1_000)}K`;
  return `${(Math.round(n / 100_000) / 10).toLocaleString("en-US")}M`;
}

/** "45 min", "1 hour", "49 hours", "472 hours". */
export function humanHours(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")} hour${hours === 1 ? "" : "s"}`;
}

/** How long n evenings is, said the way a person would: "9 nights", "2 months". */
export function nightsPhrase(n: number): string {
  if (n < 14) return `${n} night${n === 1 ? "" : "s"}`;
  if (n < 60) return `${Math.round(n / 7)} weeks`;
  if (n < 730) return `${Math.round(n / 30.4)} months`;
  return `${Math.round(n / 365)} years`;
}

/* ── Is it good? ── */

/** Below this, an average is a handful of people, not a reputation. */
const MIN_VOTES = 50;

export function ratingGlance(average?: number | null, count?: number | null): Glance | null {
  const avg = average ?? 0;
  const n = count ?? 0;
  if (avg <= 0 || n <= 0) return null;
  const votes = `${compactCount(n)} vote${n === 1 ? "" : "s"} on TMDB`;
  // TMDB's averages sit around 6.5 for anything with a following, so the
  // words are pitched against that rather than against the full 1–10 range.
  const word = n < MIN_VOTES ? null : avg >= 8 ? "Widely loved" : avg >= 7 ? "Well liked" : avg >= 6 ? "Mixed reactions" : "Mostly disliked";
  return {
    key: "rating",
    label: "Rating",
    lead: avg.toFixed(1),
    unit: "/10",
    note: word ? `${word} · ${votes}` : `Only ${votes} so far`,
  };
}

/* ── How long? ── */

/**
 * A film's length, and when it would end if you pressed play now. `endsAt` is
 * the reader's clock, so the caller supplies it only after mount — the server
 * and the browser are rarely in the same timezone.
 */
export function filmLengthGlance(runtime?: number | null, endsAt?: string | null): Glance | null {
  const lead = formatRuntime(runtime);
  if (!lead) return null;
  return { key: "length", label: "Length", lead, note: endsAt ? `Ends at ${endsAt} if you start now` : null };
}

/** "11:04 pm" for a film of `minutes` started at `now`, on the reader's clock. */
export function endTime(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}

/* ── Money ── */

/**
 * The ratio, never a profit. TMDB's `revenue` is worldwide gross, which a
 * studio does not keep, and two films in every language group sampled carry a
 * revenue with no budget at all — a subtraction would invent the result.
 */
export function moneyGlance(budget?: number | null, revenue?: number | null): Glance | null {
  const b = formatMoney(budget);
  const r = formatMoney(revenue);
  if (r && b) {
    const ratio = (revenue as number) / (budget as number);
    const times = ratio >= 10 ? Math.round(ratio).toLocaleString("en-US") : (Math.round(ratio * 10) / 10).toLocaleString("en-US");
    return {
      key: "money",
      label: "Box office",
      lead: r,
      note: ratio >= 1 ? `${times}× its ${b} budget` : `Less than its ${b} budget`,
    };
  }
  if (r) return { key: "money", label: "Box office", lead: r, note: "Worldwide" };
  if (b) return { key: "money", label: "Budget", lead: b };
  return null;
}

/* ── Where it comes from ── */

/**
 * TMDB's "based on …" keywords, by id, in the order to prefer when a title
 * carries two ("based on true story" and "based on novel or book" — the true
 * story is the more interesting half). Ids verified against TMDB's keyword
 * search; names drift, ids don't.
 */
const SOURCES: [number, string][] = [
  [9672, "A true story"],
  [328926, "A real person"],
  [14641, "A memoir"],
  [5565, "A real life"],
  [13141, "A manga"],
  [323477, "A manhwa"],
  [288474, "A webtoon"],
  [377176, "A webcomic"],
  [319900, "A light novel"],
  [318933, "A web novel"],
  [246466, "A young-adult novel"],
  [818, "A book"],
  [156866, "A short story"],
  [9717, "A comic"],
  [222243, "An anime"],
  [10244, "A cartoon"],
  [41645, "A video game"],
  [10181, "A play or musical"],
  [269769, "A TV series"],
  [179411, "A fairy tale"],
  [41011, "A song or poem"],
  [10542, "A toy"],
];
const SOURCE_IDS = new Set(SOURCES.map(([id]) => id));

export function basedOnGlance(keywords: Keyword[] = []): Glance | null {
  const ids = new Set(keywords.map((k) => k.id));
  const hit = SOURCES.find(([id]) => ids.has(id));
  return hit ? { key: "source", label: "Based on", lead: hit[1] } : null;
}

const AFTER_CREDITS = 179430;
const DURING_CREDITS = 179431;

/** The question every Marvel audience asks the person next to them. */
export function creditsGlance(keywords: Keyword[] = []): Glance | null {
  const ids = new Set(keywords.map((k) => k.id));
  const after = ids.has(AFTER_CREDITS);
  const during = ids.has(DURING_CREDITS);
  if (!after && !during) return null;
  const note = after && during ? "Scenes during and after them" : after ? "There's a scene after them" : "There's a scene during them";
  return { key: "credits", label: "The credits", lead: "Stay seated", note };
}

/**
 * The language, only when it isn't English. For most of the catalogue it's a
 * fact nobody asks; for anime, Korean drama or Malayalam cinema it's the first
 * thing someone wants to know.
 */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", ml: "Malayalam",
  kn: "Kannada", bn: "Bengali", mr: "Marathi", pa: "Punjabi", ur: "Urdu",
  ja: "Japanese", ko: "Korean", zh: "Chinese", es: "Spanish", fr: "French",
  de: "German", it: "Italian", pt: "Portuguese", ru: "Russian", ar: "Arabic",
};

export function languageGlance(
  code?: string | null,
  spoken: { iso_639_1?: string; english_name?: string }[] = [],
  countries: string[] = [],
): Glance | null {
  if (!code || code === "en") return null;
  const name = spoken.find((l) => l.iso_639_1 === code)?.english_name || LANGUAGE_NAMES[code];
  if (!name) return null;
  return {
    key: "language",
    label: "Language",
    lead: name,
    note: countries.length ? `Made in ${countries.slice(0, 2).join(" and ")}` : null,
  };
}

/* ── What it's about ── */

/**
 * Keywords that describe how a title is catalogued rather than what it is
 * about: its source (shown above as "Based on"), the credits scenes, the
 * franchise bookkeeping.
 */
const NOT_THEMES = new Set<number>([
  ...SOURCE_IDS,
  AFTER_CREDITS,
  DURING_CREDITS,
  9663, // sequel
  9675, // prequel
  9714, // remake
  180547, // marvel cinematic universe (mcu)
  210024, // anime — the language and genre already say it
]);

export function themes(keywords: Keyword[] = [], max = 6): Keyword[] {
  return keywords.filter((k) => k?.id && k.name && !NOT_THEMES.has(k.id)).slice(0, max);
}

/* ── Watch order ── */

/**
 * Where a film sits in its collection. `parts` arrive in release order from
 * /api/collection; until they do, the tile still says it belongs to one.
 */
export function collectionGlance(
  name: string | null | undefined,
  parts: { id: number; title: string }[] | null,
  currentId: number | string,
): Glance | null {
  if (!name) return null;
  const short = name.replace(/\s+collection$/i, "");
  if (!parts) return { key: "order", label: "Watch order", lead: "Part of a series", note: short, href: "#collection" };
  const i = parts.findIndex((p) => String(p.id) === String(currentId));
  if (i < 0 || parts.length < 2) return null;
  return {
    key: "order",
    label: "Watch order",
    lead: `Part ${i + 1} of ${parts.length}`,
    note: i === 0 ? `The first of ${short}` : `After ${parts[i - 1].title}`,
    href: "#collection",
  };
}

/* ── A series ── */

/** Minutes of aired episodes in one season, from TMDB's per-episode runtimes. */
export type SeasonRuntime = { s: number; aired: number; minutes: number };

export type Ep = { s: number; e: number };

/**
 * Each season's aired episodes and how long they run, from the season
 * payloads. A missing runtime is filled with that season's average (or the
 * show's, if the season has none); a show with no runtimes anywhere gets null
 * rather than a guess. Specials are left out, as they are everywhere else.
 */
export function seasonRuntimes(
  seasons: { s: number; count: number; episodes: { episode_number: number; runtime?: number | null }[] | null }[],
  lastAired: Ep | null,
): SeasonRuntime[] | null {
  if (!lastAired) return null;
  const rows = seasons
    .filter((x) => x.s > 0 && x.s <= lastAired.s)
    .map((x) => {
      const limit = x.s < lastAired.s ? Infinity : lastAired.e;
      const eps = x.episodes ? x.episodes.filter((ep) => ep.episode_number <= limit) : null;
      const aired = eps ? eps.length : Math.min(x.count, limit);
      const known = (eps ?? []).map((ep) => ep.runtime).filter((m): m is number => typeof m === "number" && m > 0);
      return { s: x.s, aired, known };
    });
  const all = rows.flatMap((r) => r.known);
  if (all.length === 0) return null;
  const overall = all.reduce((a, b) => a + b, 0) / all.length;
  return rows.map((r) => {
    const avg = r.known.length ? r.known.reduce((a, b) => a + b, 0) / r.known.length : overall;
    const missing = Math.max(0, r.aired - r.known.length);
    return { s: r.s, aired: r.aired, minutes: Math.round(r.known.reduce((a, b) => a + b, 0) + missing * avg) };
  });
}

export function seriesSizeGlance(
  seasonCount?: number | null,
  episodeCount?: number | null,
  runtimes?: SeasonRuntime[] | null,
): Glance | null {
  const episodes = episodeCount ?? 0;
  if (episodes <= 0) return null;
  const seasons = seasonCount ?? 0;
  const aired = (runtimes ?? []).reduce((n, r) => n + r.aired, 0);
  const minutes = (runtimes ?? []).reduce((n, r) => n + r.minutes, 0);
  const each = aired > 0 ? Math.round(minutes / aired) : null;
  const parts = [
    seasons > 0 ? `${seasons} season${seasons === 1 ? "" : "s"}` : null,
    each ? `about ${each} min each` : null,
  ].filter(Boolean);
  return {
    key: "size",
    label: "Episodes",
    lead: episodes.toLocaleString("en-US"),
    note: parts.length ? parts.join(" · ") : null,
  };
}

/**
 * How much of your life it is — or how much is left of it.
 *
 * `watched` is the reader's ticked episodes (`"s:e"`), present only when
 * they're signed in; without it this is the whole show.
 */
export function seriesTimeGlance(runtimes: SeasonRuntime[] | null | undefined, watched?: Set<string> | null): Glance | null {
  if (!runtimes?.length) return null;
  const total = runtimes.reduce((n, r) => n + r.minutes, 0);
  const aired = runtimes.reduce((n, r) => n + r.aired, 0);
  if (total <= 0 || aired <= 0) return null;

  let seenEps = 0;
  let leftEps = 0;
  let leftMinutes = 0;
  for (const r of runtimes) {
    let seen = 0;
    for (let e = 1; e <= r.aired; e++) if (watched?.has(`${r.s}:${e}`)) seen += 1;
    seenEps += seen;
    leftEps += r.aired - seen;
    leftMinutes += r.aired > 0 ? ((r.aired - seen) * r.minutes) / r.aired : 0;
  }

  if (seenEps > 0 && leftEps === 0) {
    return { key: "time", label: "Time spent", lead: humanHours(total), note: `All ${aired.toLocaleString("en-US")} episodes, watched` };
  }
  if (seenEps > 0) {
    return { key: "time", label: "Time left", lead: humanHours(leftMinutes), note: `${leftEps.toLocaleString("en-US")} episode${leftEps === 1 ? "" : "s"} to go` };
  }
  return {
    key: "time",
    label: "To watch it all",
    lead: humanHours(total),
    note: aired > 1 ? `Or ${nightsPhrase(aired)} at one a night` : null,
  };
}

type EpisodeStub = {
  season_number?: number | null;
  episode_number?: number | null;
  name?: string | null;
  air_date?: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A calendar day as an integer, zone-free (see NextEpisode). */
function dayIndex(p: ParsedDate): number {
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000);
}

/** "Fri 10 Oct", or "10 Oct 2013" when the year matters. */
export function shortDate(p: ParsedDate, withYear = false): string {
  if (withYear) return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
  const weekday = DAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return `${weekday} ${p.d} ${MONTHS[p.m - 1]}`;
}

function code(ep: EpisodeStub): string | null {
  const s = ep.season_number;
  const e = ep.episode_number;
  if (typeof s !== "number" || typeof e !== "number") return null;
  return `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}`;
}

/** TMDB's placeholder names say nothing the code doesn't. */
function realName(name?: string | null): string | null {
  const n = name?.trim();
  return n && !/^(episode|ep\.?)\s*\d+$/i.test(n) ? n : null;
}

/**
 * Is there more coming? The question asked of every series, answered in one
 * tile: the next episode and how soon, that it's coming back without a date,
 * or that it ended — when, where, after how long.
 *
 * `today` is the reader's date and arrives after mount; until then the tile
 * states the date itself rather than how far away it is.
 *
 * This replaces the NextEpisode card and keeps what it measured across 187
 * shows: `next_episode_to_air` exists for only 55% of them (82% of returning
 * shows, 0% of ended ones), but `last_episode_to_air` is there on every one —
 * so a returning show with no date still says it's coming back, and an ended
 * one says when, rather than both saying nothing. An unaired episode's
 * overview is never shown: it is routinely a plot synopsis.
 */
export function seriesStatusGlance(show: {
  status?: string | null;
  inProduction?: boolean | null;
  next?: EpisodeStub | null;
  last?: EpisodeStub | null;
  network?: string | null;
  seasons?: number | null;
  today: ParsedDate | null;
}): Glance | null {
  const next = show.next && (typeof show.next.season_number === "number" || show.next.air_date) ? show.next : null;
  const last = show.last && (typeof show.last.season_number === "number" || show.last.air_date) ? show.last : null;
  if (!next && !last) return null;

  if (next) {
    const date = parseTmdbDate(next.air_date);
    const days = date && show.today ? dayIndex(date) - dayIndex(show.today) : null;
    const lead =
      days == null
        ? date
          ? shortDate(date)
          : "Not dated yet"
        : days <= 0
          ? days === 0
            ? "Today"
            : "Just aired"
          : days === 1
            ? "Tomorrow"
            : days < 14
              ? `In ${days} days`
              : shortDate(date!, date!.y !== show.today!.y);
    const bits = [code(next), realName(next.name), days != null && days > 1 && days < 14 && date ? shortDate(date) : null].filter(Boolean);
    return { key: "status", label: "Next episode", lead, note: bits.join(" · ") || null };
  }

  const returning = show.status === "Returning Series" || show.status === "In Production" || show.inProduction === true;
  const lastDate = parseTmdbDate(last?.air_date);
  if (returning) {
    return {
      key: "status",
      label: "Status",
      lead: "Returning",
      note: lastDate ? `No date yet · last aired ${shortDate(lastDate, true)}` : "No date for the next episode yet",
    };
  }

  const seasons = show.seasons ?? 0;
  const where = [
    lastDate ? `In ${lastDate.y}` : null,
    show.network ? `on ${show.network}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const after = seasons > 0 ? `after ${seasons} season${seasons === 1 ? "" : "s"}` : null;
  const note = [where, after].filter(Boolean).join(", ");
  return {
    key: "status",
    label: "Status",
    lead: show.status === "Canceled" ? "Cancelled" : "Ended",
    note: note ? note.charAt(0).toUpperCase() + note.slice(1) : null,
  };
}

/**
 * A season's length and what's left of it, from its episodes' own runtimes
 * (a missing one counts as the season's average). Null when none is known.
 */
export function seasonTime(
  episodes: { episode_number: number; runtime?: number | null }[],
  isWatched: (episodeNumber: number) => boolean,
): { total: number; left: number } | null {
  const known = episodes.map((e) => e.runtime).filter((m): m is number => typeof m === "number" && m > 0);
  if (!known.length) return null;
  const avg = known.reduce((a, b) => a + b, 0) / known.length;
  let total = 0;
  let left = 0;
  for (const e of episodes) {
    const m = typeof e.runtime === "number" && e.runtime > 0 ? e.runtime : avg;
    total += m;
    if (!isWatched(e.episode_number)) left += m;
  }
  return { total: Math.round(total), left: Math.round(left) };
}
