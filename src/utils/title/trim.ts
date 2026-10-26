/**
 * What a title page hands to the browser, cut to what its components read.
 *
 * Every prop a server page passes to a client component is serialised into the
 * page twice over — the data travels in the HTML for hydration, as well as
 * being rendered — so a field nobody reads is paid for on every uncached build,
 * in the cache, and on the wire. Measured 25 Oct 2026: Inception's page was
 * 306KB, 191KB of it that data, 130KB of it one component's props.
 *
 * The counts match the components: CastRow shows twenty, MediaGallery twelve
 * stills and eight posters.
 */
export const CAST_SHOWN = 20;
export const STILLS_SHOWN = 12;
export const POSTERS_SHOWN = 8;

type RawVideo = { key?: string; name?: string; site?: string; type?: string; official?: boolean };

/** VideoShelf reads these five. */
export function trimVideos(results: RawVideo[] | null | undefined): RawVideo[] {
  return (results ?? []).map((v) => ({ key: v.key, name: v.name, site: v.site, type: v.type, official: v.official }));
}

type RawRelease = { certification?: string; release_date?: string; type?: number; note?: string; descriptors?: unknown; iso_639_1?: string };
type RawCountry = { iso_3166_1?: string; release_dates?: RawRelease[] };

/**
 * The release rail and the identity line read a country's code and each
 * date's type, day, note and certification. `descriptors` and `iso_639_1` go,
 * and so do empty notes and certifications.
 */
export function trimReleaseDates(results: RawCountry[] | null | undefined): RawCountry[] {
  return (results ?? []).map((c) => ({
    iso_3166_1: c.iso_3166_1,
    release_dates: (c.release_dates ?? []).map((r) => ({
      release_date: r.release_date,
      type: r.type,
      ...(r.certification ? { certification: r.certification } : {}),
      ...(r.note?.trim() ? { note: r.note } : {}),
    })),
  }));
}

type RawReview = {
  id?: string;
  author?: string;
  author_details?: { name?: string; username?: string; rating?: number | null; avatar_path?: string | null };
  content?: string;
  created_at?: string;
  updated_at?: string;
  url?: string;
};

/** TmdbReviews reads the author, their rating, the words, the day and the link. All of them, kept. */
export function trimReviews(results: RawReview[] | null | undefined): RawReview[] {
  return (results ?? []).map((r) => ({
    id: r.id,
    author: r.author,
    author_details: { name: r.author_details?.name, username: r.author_details?.username, rating: r.author_details?.rating ?? null },
    content: r.content,
    created_at: r.created_at,
    url: r.url,
  }));
}
