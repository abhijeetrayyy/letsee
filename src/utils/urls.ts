/**
 * Canonical paths for the things this app has pages for.
 *
 * ── Why the name belongs in the URL ────────────────────────────────────────
 *
 * `/app/movie/550` tells a person nothing and a search engine less. The title
 * is the single strongest on-page signal a film page has, and putting it in the
 * path puts it in the one place that survives being copied into a chat window,
 * a bookmark bar, or a search result. `/app/movie/550-fight-club` is legible
 * before it is loaded.
 *
 * ── Why the id stays ──────────────────────────────────────────────────────
 *
 * Letterboxd owns its own film records, so it can key on a slug alone. This app
 * is a view over TMDB: the id is the identity and the slug is a label. Keeping
 * both means a renamed film, a re-release, or a title in another language never
 * 404s — and it means no lookup table to keep in step.
 *
 * The id leads so the parser stays trivial and total: everything up to the
 * first dash is the id, and the rest is decoration. Which is why every page
 * already accepted this shape before any link produced it — six copies of a
 * `/^\d+/` match, one per route. `parseRouteId` is now the only one.
 *
 * ── Backwards compatible on purpose ───────────────────────────────────────
 *
 * `/app/movie/550` keeps working forever. Links already in the wild, in
 * someone's history, or in a DM sent last week resolve to the same page; the
 * canonical tag names the slugged form so an index consolidates on one URL
 * rather than treating the two as duplicates.
 */

/** Lowercase, hyphenated, ASCII-only, and short enough to stay readable. */
export function slugify(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    // Strip accents rather than dropping the letter: "Amélie" -> "amelie",
    // not "amlie".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * The numeric id out of a route param, whether or not it carries a slug.
 *
 * Returns null rather than NaN so callers have one thing to check. This
 * replaces six identical copies, one per route file.
 */
export function parseRouteId(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
}

function withSlug(id: string | number, name?: string | null): string {
  const slug = slugify(name);
  return slug ? `${id}-${slug}` : String(id);
}

export type TitleType = "movie" | "tv";

/** `/app/movie/550-fight-club` */
export function titlePath(
  itemType: TitleType | string | null | undefined,
  id: string | number,
  name?: string | null,
): string {
  const kind = itemType === "tv" ? "tv" : "movie";
  return `/app/${kind}/${withSlug(id, name)}`;
}

/** `/app/person/287-brad-pitt` */
export function personPath(id: string | number, name?: string | null): string {
  return `/app/person/${withSlug(id, name)}`;
}

/** `/app/tv/1396-breaking-bad/season/2` */
export function seasonPath(
  showId: string | number,
  seasonNumber: number | string,
  showName?: string | null,
): string {
  return `${titlePath("tv", showId, showName)}/season/${seasonNumber}`;
}

/** `/app/tv/1396-breaking-bad/season/2/episode/5` */
export function episodePath(
  showId: string | number,
  seasonNumber: number | string,
  episodeNumber: number | string,
  showName?: string | null,
): string {
  return `${seasonPath(showId, seasonNumber, showName)}/episode/${episodeNumber}`;
}

/** `/app/profile/ray` — already a name, so nothing to add. */
export function profilePath(username: string): string {
  return `/app/profile/${encodeURIComponent(username)}`;
}
