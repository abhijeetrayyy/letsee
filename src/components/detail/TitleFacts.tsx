"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import EntityLinks from "@components/detail/EntityLinks";
import { buildBrowseUrl, type BrowseType } from "@/utils/browseUrl";
import { formatLongDate, parseTmdbDate, toIso } from "@/utils/person/dates";

/**
 * The reference block: everything TMDB knows, arranged so it can be skimmed and
 * left.
 *
 * Two problems this replaces. The first is drift — the facts grid was written
 * out by hand in `MovieDetailClient` and again in `TvDetailClient`, and the two
 * had already diverged in ways nobody chose: film showed Country, TV didn't;
 * TV showed Type, film had no equivalent; film's Studio linked out, TV's
 * Network linked out but its Studio was added later and separately. Every one
 * of those is a decision made twice.
 *
 * The second is shape. A `grid-cols-4` of tiny label/value pairs looks tidy
 * with four short values and falls apart with real ones: "Warner Bros.
 * Pictures, Legendary Pictures, Syncopy" in a quarter-column wraps to four
 * lines and shoves the row below it out of alignment. A definition list has one
 * value column, so a long value is simply a long line.
 *
 * The builders below are the whole point of the file. A component that takes
 * `Fact[]` can't drift; two call sites assembling their own arrays can, and
 * did.
 */

export type FactLink = { id: number; name: string; href: string };

export type Fact = {
  /** React key, and the handle an integrator can filter a row out by. */
  key: string;
  label: string;
  /** The value as text. A row needs this or `links`, otherwise it is dropped. */
  text?: string;
  /** Set alongside `text` for dates, so the value renders inside a `<time>`. */
  iso?: string;
  /** Entities that go somewhere. Rendered through `EntityLinks`. */
  links?: FactLink[];
  /** A dimmed trailing clause: "worldwide", "5.4× budget", "62 episodes". */
  hint?: string;
  /** Makes the hint itself a door — the decade beside a release date. */
  hintHref?: string;
};

/** TMDB always sends money in USD, verified against films priced in rupees:
 *  RRR is 69,000,000, not the 5,500,000,000 its ₹550cr budget would give. */
function formatMoney(amount?: number | null): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;

  // A fixed locale, not the runtime's. This renders on the server and again in
  // the browser, and the two can disagree about digit grouping — which React
  // reports as a hydration mismatch on a page that is otherwise static.
  const scaled = (value: number, suffix: string) => {
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `$${rounded.toLocaleString("en-US")}${suffix}`;
  };

  // The units matter more than they look. `(revenue / 1e6).toFixed(0)` — what
  // this page did before — prints "$0M" for anything under half a million, and
  // measured across 95 films three of them had exactly that: a real box-office
  // number rendered as zero.
  if (amount >= 1_000_000_000) return scaled(amount / 1_000_000_000, "B");
  if (amount >= 1_000_000) return scaled(amount / 1_000_000, "M");
  if (amount >= 1_000) return scaled(amount / 1_000, "K");
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatRuntime(minutes?: number | null): string | null {
  if (typeof minutes !== "number" || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Only ever a fallback. `spoken_languages` carries `english_name` and was
 * populated on 95 of 95 films sampled, so this covers the rows where TMDB has a
 * language code and nothing else. Both detail clients keep a private nine-entry
 * copy of this map; those become dead once they render facts from here.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", ml: "Malayalam",
  kn: "Kannada", bn: "Bengali", mr: "Marathi", pa: "Punjabi", ur: "Urdu",
  ja: "Japanese", ko: "Korean", zh: "Chinese", es: "Spanish", fr: "French",
  de: "German", it: "Italian", pt: "Portuguese", ru: "Russian", ar: "Arabic",
};

/** TMDB spells these out in full, and the full spelling is nobody's answer to
 *  "where is this from". */
const COUNTRY_SHORT: Record<string, string> = {
  "United States of America": "United States",
  "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
  "Korea, Republic of": "South Korea",
};

type SpokenLanguage = { iso_639_1?: string; english_name?: string; name?: string };
type NamedEntity = { id: number; name: string };

function compact(rows: (Fact | null | false | undefined)[]): Fact[] {
  const out: Fact[] = [];
  for (const row of rows) {
    if (!row) continue;
    const hasText = typeof row.text === "string" && row.text.trim() !== "";
    const hasLinks = (row.links?.length ?? 0) > 0;
    if (hasText || hasLinks) out.push(row);
  }
  return out;
}

function peopleFact(key: string, label: string, people?: NamedEntity[]): Fact | null {
  if (!people?.length) return null;
  return {
    key,
    label,
    links: people
      .filter((p) => p?.id && p.name)
      .map((p) => ({ id: p.id, name: p.name, href: `/app/person/${p.id}` })),
  };
}

function companyFact(key: string, label: string, type: BrowseType, companies?: NamedEntity[]): Fact | null {
  if (!companies?.length) return null;
  return {
    key,
    label,
    links: companies
      .filter((c) => c?.id && c.name)
      .map((c) => ({ id: c.id, name: c.name, href: buildBrowseUrl({ type, company: String(c.id) }) })),
  };
}

function dateFact(key: string, label: string, value: string | null | undefined, type: BrowseType): Fact | null {
  const parsed = parseTmdbDate(value);
  if (!parsed) return null;

  const decade = Math.floor(parsed.y / 10) * 10;
  const href = buildBrowseUrl({ type, decade: String(decade) });
  // `buildBrowseUrl` validates a decade against its own bounds and silently
  // drops one it won't accept — a future decade, or anything before 1870. What
  // is left is bare `/app/browse`, so the check is for a link that would go
  // somewhere other than where its label claims.
  const decadeLinked = href.includes("decade=");

  return {
    key,
    label,
    text: formatLongDate(parsed),
    iso: toIso(parsed),
    hint: decadeLinked ? `${decade}s` : undefined,
    hintHref: decadeLinked ? href : undefined,
  };
}

function languageFact(
  type: BrowseType,
  originalLanguage?: string,
  spoken?: SpokenLanguage[],
): Fact | null {
  const list = (spoken ?? []).filter((l) => l?.iso_639_1);
  // Original language first. TMDB's array order is alphabetical by code, which
  // puts English at the top of a Malayalam film that happens to have one
  // English scene.
  const ordered = [
    ...list.filter((l) => l.iso_639_1 === originalLanguage),
    ...list.filter((l) => l.iso_639_1 !== originalLanguage),
  ];
  const codes = ordered.map((l) => l.iso_639_1 as string);
  if (codes.length === 0 && originalLanguage) codes.push(originalLanguage);
  if (codes.length === 0) return null;

  const nameFor = (code: string) =>
    ordered.find((l) => l.iso_639_1 === code)?.english_name ??
    LANGUAGE_NAMES[code] ??
    code.toUpperCase();

  const shown = codes.slice(0, 3);
  const label = codes.length > 1 ? "Languages" : "Language";
  // The browse filter accepts a bare two-letter code and silently drops
  // anything else, which would leave a link pointing at unfiltered browse under
  // a label promising Malayalam. TMDB does emit the odd empty or malformed
  // code, so when any of them can't be trusted the whole row becomes text.
  if (!shown.every((code) => /^[a-z]{2}$/.test(code))) {
    return { key: "language", label, text: shown.map(nameFor).join(", ") };
  }

  return {
    key: "language",
    label,
    // Positional ids: a language has no numeric key of its own and
    // `EntityLinks` needs one. They are unique within this row, which is the
    // only place they are ever compared.
    links: shown.map((code, index) => ({
      id: index,
      name: nameFor(code),
      href: buildBrowseUrl({ type, lang: code }),
    })),
  };
}

function countryFact(names?: string[], countries?: { name?: string }[]): Fact | null {
  const resolved =
    names?.length ? names : (countries ?? []).map((c) => c?.name).filter((n): n is string => Boolean(n));
  if (resolved.length === 0) return null;
  const shown = resolved.map((n) => COUNTRY_SHORT[n] ?? n).slice(0, 3);
  return {
    key: "country",
    label: shown.length > 1 ? "Countries" : "Country",
    text: shown.join(", "),
    // No `country` facet exists on /app/browse, so this one stays text. A link
    // is only worth writing when it lands somewhere.
    hint: resolved.length > shown.length ? `+${resolved.length - shown.length} more` : undefined,
  };
}

function originalTitleFact(displayed?: string, original?: string): Fact | null {
  if (!original || !displayed || original.trim() === displayed.trim()) return null;
  // Worth a row on 26 of 95 films sampled, and far more of the ones this
  // catalogue is actually about — a Malayalam film's own title is the one its
  // audience uses.
  return { key: "original-title", label: "Original title", text: original };
}

export type MovieFactsSource = {
  title?: string;
  original_title?: string;
  original_language?: string;
  release_date?: string | null;
  runtime?: number | null;
  budget?: number | null;
  revenue?: number | null;
  status?: string | null;
  spoken_languages?: SpokenLanguage[];
  production_countries?: { name?: string }[];
  production_companies?: NamedEntity[];
};

/**
 * A film's facts.
 *
 * Money is the delicate part. Measured over 95 films: budget populated on 80%,
 * revenue on 79% — but that average hides who is missing. Split by original
 * language, English sits at 92/92% and Tamil at 40/45%, Malayalam at 55/50%.
 * So the fields are absent precisely where this app's catalogue is densest, and
 * a layout that assumes them leaves a hole rather than a row.
 *
 * There is no profit row and there will not be one. Two films in every language
 * group sampled carry a revenue with no budget at all, where a subtraction
 * would invent the entire result; and even with both numbers present, TMDB's
 * `revenue` is worldwide box-office gross, which a studio does not keep. The
 * ratio is the strongest honest claim available: it says what these two numbers
 * are to each other and nothing more.
 */
export function movieFacts(
  movie: MovieFactsSource,
  opts: { directors?: NamedEntity[]; countryNames?: string[] } = {},
): Fact[] {
  const budget = formatMoney(movie.budget);
  const revenue = formatMoney(movie.revenue);
  const hasBoth = (movie.budget ?? 0) > 0 && (movie.revenue ?? 0) > 0;
  const ratio = hasBoth ? (movie.revenue as number) / (movie.budget as number) : null;

  return compact([
    peopleFact("director", "Director", opts.directors),
    originalTitleFact(movie.title, movie.original_title),
    dateFact("released", "Released", movie.release_date, "movie"),
    // "Status: Released" is true of 94 films in 95 and tells nobody anything.
    // The one that isn't — Post Production, In Production, Rumored — is the
    // whole reason the field exists.
    movie.status && movie.status !== "Released"
      ? { key: "status", label: "Status", text: movie.status }
      : null,
    { key: "runtime", label: "Runtime", text: formatRuntime(movie.runtime) ?? undefined },
    languageFact("movie", movie.original_language, movie.spoken_languages),
    countryFact(opts.countryNames, movie.production_countries),
    companyFact("studio", "Studio", "movie", movie.production_companies),
    { key: "budget", label: "Budget", text: budget ?? undefined },
    {
      key: "revenue",
      label: "Box office",
      text: revenue ?? undefined,
      hint:
        ratio != null
          ? `worldwide · ${(Math.round(ratio * 10) / 10).toLocaleString("en-US")}× budget`
          : "worldwide",
    },
  ]);
}

export type TvFactsSource = {
  name?: string;
  original_name?: string;
  original_language?: string;
  first_air_date?: string | null;
  last_air_date?: string | null;
  in_production?: boolean;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  episode_run_time?: number[];
  last_episode_to_air?: { runtime?: number | null } | null;
  next_episode_to_air?: { air_date?: string | null } | null;
  type?: string | null;
  status?: string | null;
  networks?: NamedEntity[];
  created_by?: NamedEntity[];
  spoken_languages?: SpokenLanguage[];
  production_countries?: { name?: string }[];
  production_companies?: NamedEntity[];
};

/** TMDB's own word for a show that hasn't ended, which reads like a category
 *  rather than a state. The rest of its vocabulary — Ended, Canceled — is
 *  already plain English and is left alone. */
const TV_STATUS: Record<string, string> = { "Returning Series": "Returning" };

export function tvFacts(
  show: TvFactsSource,
  opts: { createdBy?: NamedEntity[]; countryNames?: string[] } = {},
): Fact[] {
  const seasons = show.number_of_seasons ?? 0;
  const episodes = show.number_of_episodes ?? 0;

  // `episode_run_time` was populated on 26 of 60 shows sampled;
  // `last_episode_to_air.runtime` on 49, and one or the other on 55. TMDB is
  // quietly retiring the first field, so the fallback is not a nicety — it is
  // the difference between 43% of shows carrying a runtime and 92%.
  const typical = (show.episode_run_time ?? []).find((n) => n > 0) ?? null;
  const lastEpisode = show.last_episode_to_air?.runtime;
  const fallback = typeof lastEpisode === "number" && lastEpisode > 0 ? lastEpisode : null;
  const runtime = formatRuntime(typical ?? fallback);

  return compact([
    peopleFact("created-by", "Created by", opts.createdBy ?? show.created_by),
    originalTitleFact(show.name, show.original_name),
    show.networks?.length
      ? {
          key: "network",
          label: show.networks.length > 1 ? "Networks" : "Network",
          links: show.networks
            .filter((n) => n?.id && n.name)
            .map((n) => ({ id: n.id, name: n.name, href: buildBrowseUrl({ type: "tv", network: String(n.id) }) })),
        }
      : null,
    companyFact("studio", "Studio", "tv", show.production_companies),
    dateFact("first-air", "First aired", show.first_air_date, "tv"),
    // Only when it says something the first date didn't. A show that ran one
    // day would otherwise print the same date twice under two labels.
    show.last_air_date && show.last_air_date !== show.first_air_date
      ? dateFact("last-air", show.in_production ? "Latest episode" : "Last aired", show.last_air_date, "tv")
      : null,
    // The one fact on this list a journal reader is actually waiting for.
    dateFact("next-episode", "Next episode", show.next_episode_to_air?.air_date, "tv"),
    seasons > 0
      ? {
          key: "seasons",
          label: seasons > 1 ? "Seasons" : "Season",
          text: String(seasons),
          hint: episodes > 0 ? `${episodes} episode${episodes === 1 ? "" : "s"}` : undefined,
        }
      : null,
    {
      key: "episode-length",
      label: "Episode length",
      text: runtime ?? undefined,
      // A finale routinely runs long — measured, six of 26 shows disagreed with
      // their own typical runtime by more than ten minutes. Where the number
      // came from is part of what it means.
      hint: runtime && typical == null ? "last episode" : undefined,
    },
    // Every scripted drama on TMDB is "Scripted", so the row is dead weight on
    // the shows that dominate the catalogue. Miniseries, Documentary, Reality
    // and Talk Show all change what you are looking at.
    show.type && show.type !== "Scripted" ? { key: "type", label: "Type", text: show.type } : null,
    show.status
      ? { key: "status", label: "Status", text: TV_STATUS[show.status] ?? show.status }
      : null,
    languageFact("tv", show.original_language, show.spoken_languages),
    countryFact(opts.countryNames, show.production_countries),
  ]);
}

function FactRow({ fact, stacked = false }: { fact: Fact; stacked?: boolean }) {
  const links = fact.links ?? [];
  // Built from the same array being rendered, so the lookup is total; the
  // fallback exists because `EntityLinks` promises its callback only an id and
  // a name, not the href that came in with them.
  const hrefs = new Map(links.map((l) => [l.id, l.href]));

  return (
    /**
     * Two shapes, because the row is asked to live at two widths.
     *
     * Side-by-side is right on a wide card, where an 8rem label column lines
     * every value up on one edge. It is wrong in the 304px hero rail: the label
     * takes 128px of it and leaves 142px for the value, which turned The
     * Matrix's three production companies into a four-line paragraph. Stacked,
     * the same value gets the full width and takes two.
     */
    <div className={stacked ? "py-2" : "grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 py-2 sm:grid-cols-[8rem_minmax(0,1fr)]"}>
      <dt className={`text-[10px] uppercase tracking-wider text-surface-500 ${stacked ? "" : "pt-0.5"}`}>{fact.label}</dt>
      <dd className={`min-w-0 text-sm text-surface-300 ${stacked ? "mt-0.5" : ""}`}>
        {links.length > 0 ? (
          // Three, not four. Anime series routinely list every regional
          // broadcaster that carried them — *Frieren* returns 29 networks, and
          // seven production companies is ordinary rather than exceptional. The
          // row is a summary with a door in it, not the list.
          <EntityLinks items={links} href={(item) => hrefs.get(item.id) || "/app/browse"} max={3} />
        ) : fact.iso ? (
          <time dateTime={fact.iso}>{fact.text}</time>
        ) : (
          fact.text
        )}
        {fact.hint && (
          <span className="text-surface-500">
            {" · "}
            {fact.hintHref ? (
              <Link href={fact.hintHref} className="transition-colors hover:text-brand-400">
                {fact.hint}
              </Link>
            ) : (
              fact.hint
            )}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * `variant` is the only layout decision left to the caller, and it exists
 * because the block is wanted in two places with two backgrounds: `hero` sits
 * over the backdrop where a bordered panel would fight the gradient, `card`
 * sits in the sidebar column alongside Keywords and matches its chrome exactly.
 */
export default function TitleFacts({
  facts,
  title = "Details",
  variant = "card",
  className = "",
}: {
  facts: Fact[];
  title?: string;
  variant?: "card" | "hero" | "grid";
  className?: string;
}) {
  if (facts.length === 0) return null;

  const list = (
    <dl className="divide-y divide-surface-800/40">
      {facts.map((fact) => (
        <FactRow key={fact.key} fact={fact} />
      ))}
    </dl>
  );

  /**
   * Bare and stacked, across as many columns as the page is wide.
   *
   * This is the shape that fixes the original complaint. The facts used to be
   * one column of short values stretched across 1336px — a 128px label, "2h
   * 16m", and a thousand pixels of nothing after it, six rows deep. Four
   * columns of 330px is the same list with the width actually spent.
   *
   * Stacked rather than label-beside-value, because at 330px an 8rem label
   * eats a quarter of the cell and wraps the studios into a paragraph.
   */
  if (variant === "grid") {
    return (
      <dl
        className={`grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 [&>div]:border-b [&>div]:border-surface-800/40 ${className}`}
      >
        {facts.map((fact) => (
          <FactRow key={fact.key} fact={fact} stacked />
        ))}
      </dl>
    );
  }

  if (variant === "hero") {
    // Capped rather than full-bleed: a two-word value on a 1400px row leaves the
    // label marooned at the far left of the screen.
    return <div className={`mt-6 max-w-xl ${className}`}>{list}</div>;
  }

  return (
    <div className={`rounded-xl border border-surface-800/50 bg-surface-900/30 p-4 ${className}`}>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
        <Info className="size-3.5" /> {title}
      </h3>
      {list}
    </div>
  );
}
