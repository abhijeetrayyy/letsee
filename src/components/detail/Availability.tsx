"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { ChevronDown, Globe, ExternalLink } from "lucide-react";
import { useCountry } from "@/app/contextAPI/countryContext";
import { swrFetcher } from "@/utils/swrFetcher";

type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

type AvailableCountry = { code: string; name: string };

type AvailabilityData = {
  country: string;
  link: string | null;
  flatrate: Provider[];
  free: Provider[];
  ads: Provider[];
  rent: Provider[];
  buy: Provider[];
  availableCountries: AvailableCountry[];
};

const LOGO_BASE = "https://image.tmdb.org/t/p/original";

/**
 * Ordered by what it costs the reader, cheapest first, because that is the
 * order the question gets asked in: is it in something I already pay for, is it
 * free, or do I have to buy it tonight.
 *
 * Rent and buy stay on separate lines even though the same stores usually
 * appear in both — measured over eight titles in two regions, every buy
 * provider was also a rent provider everywhere both existed. Merging them was
 * tempting for exactly that reason, and Breaking Bad is why it would be wrong:
 * in the US it can be bought and cannot be rented, so a merged row would offer
 * a rental that does not exist.
 */
const OFFER_ROWS = [
  { key: "flatrate", label: "Streaming" },
  { key: "free", label: "Free" },
  { key: "ads", label: "Free with ads" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
] as const;

/**
 * Region names without shipping a 250-entry country table into the bundle, and
 * from ONE source: the API also names the regions it returns, but from a table
 * that calls the US "United States of America", so mixing the two would have
 * the heading and the menu naming the same place differently. The API name is
 * kept as the fallback for codes Intl cannot resolve.
 */
const regionDisplay =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function regionName(code: string, fallback?: string): string {
  try {
    return regionDisplay?.of(code) ?? fallback ?? code;
  } catch {
    return fallback ?? code;
  }
}

/**
 * "In United States" is what the raw region name gives you, and it reads like a
 * database field. The handful of names English wants an article in front of are
 * exactly the ones this product sees most, so the heading earns the word.
 */
const TAKES_ARTICLE = /\b(United|Netherlands|Philippines|Bahamas|Maldives|Gambia|Islands|Republic|Emirates)\b/;

function inRegion(name: string): string {
  return TAKES_ARTICLE.test(name) ? `the ${name}` : name;
}

/**
 * Which regions to put one tap away when the reader's own has nothing. Large
 * catalogues first, then everything else by name — an alphabetical list would
 * lead with Andorra and Albania, which is a list nobody scans.
 */
const QUICK_REGIONS = ["US", "IN", "GB", "CA", "AU", "AE", "SG", "DE", "FR", "JP", "BR", "ZA"];

function ProviderChip({
  provider,
  href,
  regionPhrase,
}: {
  provider: Provider;
  href: string;
  regionPhrase: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${provider.provider_name} — open in ${regionPhrase}`}
      className="group inline-flex items-center gap-2 rounded-xl border border-surface-700/50 bg-surface-900/60 py-1.5 pl-1.5 pr-3 transition-colors hover:border-brand-500/40 hover:bg-surface-800/70"
    >
      {provider.logo_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${LOGO_BASE}${provider.logo_path}`}
          alt=""
          loading="lazy"
          className="size-7 shrink-0 rounded-lg bg-white/5 object-contain"
        />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-800 text-[10px] font-semibold text-surface-400">
          {provider.provider_name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="text-xs font-medium text-surface-300 transition-colors group-hover:text-white">
        {provider.provider_name}
      </span>
    </a>
  );
}

export default function Availability({
  mediaId,
  mediaType,
}: {
  mediaId: number | string;
  mediaType: "movie" | "tv";
}) {
  const { country, setCountry } = useCountry();

  const { data, error, isLoading } = useSWR<AvailabilityData>(
    `/api/watch-providers?mediaId=${encodeURIComponent(String(mediaId))}&mediaType=${mediaType}&country=${country}`,
    swrFetcher,
    // Switching region should swap one panel for another, not blank the block
    // out and rebuild it — the old contents stay, dimmed, until the new region
    // answers.
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  /**
   * Everything the panel says describes the region the payload is FOR, not the
   * region just picked from the menu. While a switch is in flight those two
   * differ for a beat, and naming the new one over the old one's providers is
   * the exact failure this block was rebuilt to end.
   */
  const shownCountry = data?.country ?? country;
  const regionLabel = regionName(shownCountry);
  const regionPhrase = inRegion(regionLabel);
  const available = useMemo(() => data?.availableCountries ?? [], [data]);

  /**
   * The switcher lists only regions that actually carry the title, plus the
   * reader's own so the control never lies about where it is pointed. Choosing
   * one here writes through to the site-wide region, the same as the header
   * selector — an explicit choice is an explicit choice wherever it is made.
   */
  const regionOptions = useMemo(() => {
    const named = available.map((c) => ({ code: c.code, name: regionName(c.code, c.name) }));
    return named.some((c) => c.code === country)
      ? named
      : [{ code: country, name: regionName(country) }, ...named];
  }, [available, country]);

  const elsewhere = useMemo(() => {
    const others = available.filter((c) => c.code !== shownCountry);
    const quick = QUICK_REGIONS.map((code) => others.find((c) => c.code === code)).filter(
      (c): c is AvailableCountry => Boolean(c),
    );
    const rest = others.filter((c) => !QUICK_REGIONS.includes(c.code));
    return { all: others, quick: [...quick, ...rest].slice(0, 6) };
  }, [available, shownCountry]);

  const regionSwitcher = (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-surface-500">
      Region
      <span className="relative inline-flex items-center">
        <select
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="appearance-none rounded-lg border border-surface-700/60 bg-surface-900/80 py-1 pl-2.5 pr-7 text-xs text-surface-300 transition-colors hover:border-surface-600 hover:text-surface-100"
        >
          {regionOptions.map((c) => (
            <option key={c.code} value={c.code} className="bg-surface-900 text-surface-100">
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-surface-500" />
      </span>
    </label>
  );

  if (isLoading && !data) {
    return (
      <div className="card-accent animate-pulse rounded-2xl p-4 sm:p-5">
        <div className="h-3 w-28 rounded bg-surface-800" />
        <div className="mt-5 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-32 rounded-xl bg-surface-800" />
          ))}
        </div>
      </div>
    );
  }

  // Named after the region that was ASKED for, not the one on screen: when a
  // switch is what failed, the reader is owed the region they picked.
  if (error || !data) {
    return (
      <div className="card-accent rounded-2xl p-4 sm:p-5">
        <p className="text-sm text-surface-400">
          The availability lookup for {inRegion(regionName(country))} did not come back. Reload to try
          again.
        </p>
      </div>
    );
  }

  const rows = OFFER_ROWS.map((row) => ({ ...row, providers: data[row.key] ?? [] })).filter(
    (row) => row.providers.length > 0,
  );

  const settling = data.country !== country;

  const watchLink =
    data.link ??
    `https://www.themoviedb.org/${mediaType}/${mediaId}/watch?locale=${shownCountry}`;

  return (
    <div className="card-accent rounded-2xl p-4 sm:p-5">
      <p className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-surface-100">
        <Globe className="size-4 text-brand-400" />
        In {regionPhrase}
        {settling && (
          <span className="text-xs font-normal text-surface-500">
            checking {inRegion(regionName(country))}…
          </span>
        )}
      </p>

      {rows.length > 0 ? (
        <div
          className={`mt-3 divide-y divide-surface-800/70 transition-opacity ${
            settling ? "opacity-50" : ""
          }`}
        >
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:gap-4"
            >
              <span className="w-24 shrink-0 pt-2 text-[10px] uppercase tracking-wider text-surface-500">
                {row.label}
              </span>
              <div className="flex flex-wrap gap-2">
                {row.providers.map((provider) => (
                  <ProviderChip
                    key={`${row.key}-${provider.provider_id}`}
                    provider={provider}
                    href={watchLink}
                    regionPhrase={regionPhrase}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`mt-3 transition-opacity ${settling ? "opacity-50" : ""}`}>
          <p className="text-sm text-surface-300">
            No service in {regionPhrase} streams, rents or sells this.
          </p>

          {elsewhere.all.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs text-surface-500">
                {elsewhere.all.length === 1
                  ? "One region carries it:"
                  : `${elsewhere.all.length} other regions carry it:`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {elsewhere.quick.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCountry(c.code)}
                    className="rounded-lg border border-surface-700/50 bg-surface-900/60 px-3 py-1.5 text-xs text-surface-300 transition-colors hover:border-brand-500/40 hover:text-white"
                  >
                    {regionName(c.code, c.name)}
                  </button>
                ))}
              </div>
              {elsewhere.all.length > elsewhere.quick.length && (
                <p className="mt-2 text-[11px] text-surface-600">
                  The rest are in the region menu below.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-surface-500">
              TMDB has no provider listed for it in any region yet.
            </p>
          )}
        </div>
      )}

      {/* The control sits under the answer rather than beside the heading: next
          to "In India" a menu reading "India" is the same word twice, and the
          region is a setting, not the headline. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-surface-800/70 pt-3">
        {rows.length > 0 && (
          <a
            href={watchLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-surface-400 transition-colors hover:text-brand-400"
          >
            Every option in {regionPhrase}
            <ExternalLink className="size-3" />
          </a>
        )}
        <span className="ml-auto">{regionSwitcher}</span>
      </div>

      <p className="mt-2 text-[10px] text-surface-600">Availability from JustWatch via TMDB</p>
    </div>
  );
}
