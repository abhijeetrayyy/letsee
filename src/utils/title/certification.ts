/**
 * Pick an age rating, and say whose it is.
 *
 * Both detail pages read the US entry and nothing else. Measured across fifteen
 * titles, the US rating differs from the Indian one on EVERY one of them —
 * PG-13 against UA, TV-MA against A, TV-14 against U — so the chip was
 * confidently wrong for an Indian reader on every title that had one.
 *
 * Worse for the titles that matter most to that reader: *Tumbbad* and
 * *Laapataa Ladies* carry an Indian certification and no US entry at all, so
 * the page showed no rating whatsoever for films that are certified.
 *
 * Falling back is right — a rating from somewhere beats none — but a foreign
 * rating passed off as local is not. So the source country travels with the
 * value and the caller labels it when it is not the reader's own.
 */

export type Certification = {
  value: string;
  /** ISO-3166-1 of whoever issued it. */
  country: string;
  /** True when this is the reader's own region, so the label can be dropped. */
  isLocal: boolean;
};

/** Ordered after the reader's own region: large English-language markets. */
const FALLBACKS = ["US", "GB", "CA", "AU"];

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Movies. `release_dates.results` is a list of countries, each holding several
 * dated releases, and only some of them carry a certification.
 */
export function movieCertification(
  releaseDates: { iso_3166_1?: string; release_dates?: { certification?: string }[] }[] | undefined,
  region: string,
): Certification | null {
  const pick = (code: string): string | null => {
    const entry = (releaseDates ?? []).find((r) => r.iso_3166_1 === code);
    for (const d of entry?.release_dates ?? []) {
      const c = clean(d.certification);
      if (c) return c;
    }
    return null;
  };
  return resolve(pick, releaseDates?.map((r) => r.iso_3166_1 ?? "") ?? [], region);
}

/** TV. `content_ratings.results` is flatter — one rating per country. */
export function tvCertification(
  contentRatings: { iso_3166_1?: string; rating?: string }[] | undefined,
  region: string,
): Certification | null {
  const pick = (code: string): string | null =>
    clean((contentRatings ?? []).find((r) => r.iso_3166_1 === code)?.rating);
  return resolve(pick, contentRatings?.map((r) => r.iso_3166_1 ?? "") ?? [], region);
}

function resolve(
  pick: (code: string) => string | null,
  allCodes: string[],
  region: string,
): Certification | null {
  const local = pick(region);
  if (local) return { value: local, country: region, isLocal: true };

  for (const code of FALLBACKS) {
    if (code === region) continue;
    const v = pick(code);
    if (v) return { value: v, country: code, isLocal: false };
  }

  // Anything at all beats an empty chip — measured necessary, since several
  // titles carry a rating in exactly one country and it is none of the above.
  for (const code of allCodes) {
    const v = code ? pick(code) : null;
    if (v) return { value: v, country: code, isLocal: false };
  }
  return null;
}
