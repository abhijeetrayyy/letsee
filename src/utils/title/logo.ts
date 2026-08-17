/**
 * The title as its own artwork, and the runtime as a phrase.
 *
 * TMDB carries a `logos` array on `images` — the film's actual wordmark, the
 * lettering the poster uses. Measured across twelve titles including four
 * Indian ones, every single one had at least one English (or untagged) logo:
 * 12/12. Tumbbad has exactly one and Parasite has exactly one, so the pool is
 * thin at the edges, but it is never empty. That is a high enough hit rate to
 * treat logo art as the normal case and plain type as the fallback.
 *
 * The measurement that shapes everything below is the SHAPE of these files.
 * Candidates ran from 1.25 to 24.53 wide, and what this module picks after the
 * rules below still spans 1.60 (Tumbbad, nearly square) to 9.36 (Inception, a
 * 4317x461 strip). A height cap alone therefore does not bound the element at
 * all: at 112px tall Inception's wordmark wants 1048px of width, three phone
 * screens. So the caller constrains both axes, and this module reports the
 * ratio so nothing downstream has to guess.
 */

export type TmdbLogo = {
  file_path?: string | null;
  /** "en", or null for wordmarks with no readable language at all. */
  iso_639_1?: string | null;
  aspect_ratio?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  width?: number | null;
  height?: number | null;
};

/** Either TMDB's `images` object or the `logos` array pulled off it. */
export type LogoSource = { logos?: TmdbLogo[] | null } | TmdbLogo[] | null | undefined;

export type TitleLogo = {
  url: string;
  /** width / height. Null only when TMDB reported neither ratio nor pixels. */
  aspectRatio: number | null;
};

const IMAGE_BASE = "https://image.tmdb.org/t/p";

/**
 * Past this, a wordmark stops being a title and becomes a rule across the
 * page. On a 343px phone column a 15.07 logo renders 23px tall and a 24.53 one
 * renders 14px — smaller than the body text under it. Such files are demoted
 * rather than dropped, because for some titles they are all there is; a
 * 14px-tall title beats no title. Measured, this changes the pick on exactly
 * one of twelve: Oppenheimer moves from the 15.07 strip to a 7.38 lockup.
 */
const MAX_ASPECT = 12;

function ratioOf(logo: TmdbLogo): number | null {
  if (typeof logo.aspect_ratio === "number" && logo.aspect_ratio > 0) return logo.aspect_ratio;
  const w = logo.width;
  const h = logo.height;
  if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) return w / h;
  return null;
}

/**
 * Pick the wordmark to render, or null when there is nothing usable.
 *
 * Ranked by TMDB's own vote average, which is the only quality signal the API
 * offers and which measurably picks the clean official lockup over fan uploads
 * on every title checked. Everything after that exists to make the result
 * DETERMINISTIC: this runs during SSR and again on the client, and a pick that
 * depended on array order or on ties resolving differently would swap the hero
 * image between the two renders.
 */
export function pickLogo(images: LogoSource): TitleLogo | null {
  const all = Array.isArray(images) ? images : (images?.logos ?? []);

  const usable = (all ?? []).filter(
    (l): l is TmdbLogo & { file_path: string } =>
      !!l &&
      typeof l.file_path === "string" &&
      l.file_path.trim().length > 0 &&
      // Untagged files are wordmarks with no lettering to translate, so they
      // read correctly for an English reader too.
      (l.iso_639_1 === "en" || l.iso_639_1 == null),
  );
  if (usable.length === 0) return null;

  const best = [...usable].sort((a, b) => {
    const wideA = (ratioOf(a) ?? 0) > MAX_ASPECT;
    const wideB = (ratioOf(b) ?? 0) > MAX_ASPECT;
    if (wideA !== wideB) return wideA ? 1 : -1;

    const vote = (b.vote_average ?? 0) - (a.vote_average ?? 0);
    if (vote !== 0) return vote;

    // Five titles tie at exactly 3.334 with one vote each, so the count
    // decides more often than it looks.
    const count = (b.vote_count ?? 0) - (a.vote_count ?? 0);
    if (count !== 0) return count;

    // Wider wins a tie, because width is a proxy for how tightly the file is
    // cropped. Wednesday has the same wordmark twice at identical votes: once
    // at 3.78, tight to the lettering, and once at 1.78, the same lettering
    // centred in a 16:9 canvas with transparent bands above and below. Padding
    // can only ever lower the ratio, so the wider file is the one that spends
    // the height cap on letters. (The absurd end is already sorted to the back
    // above, so this cannot reach for a 24-wide strip.)
    const shape = (ratioOf(b) ?? 0) - (ratioOf(a) ?? 0);
    if (shape !== 0) return shape;

    // TMDB serves .svg files unchanged at every size endpoint — verified: the
    // w500 and original URLs return byte-identical SVG — and an SVG with no
    // intrinsic width lays out at the replaced-element default in some
    // engines. A raster file of equal standing is the safer render.
    const svg = Number(isSvg(a.file_path)) - Number(isSvg(b.file_path));
    if (svg !== 0) return svg;

    return a.file_path.localeCompare(b.file_path);
  })[0];

  return { url: logoUrl(best.file_path), aspectRatio: ratioOf(best) };
}

function isSvg(path: string): boolean {
  return path.toLowerCase().endsWith(".svg");
}

/**
 * `w500` for raster, measured at 9-46KB against 16-138KB for the originals —
 * the largest sized bucket TMDB offers for logos, and enough for a wordmark
 * capped at 112px tall. Vector files ignore the bucket anyway, so they are
 * asked for whole.
 */
function logoUrl(filePath: string): string {
  const clean = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `${IMAGE_BASE}/${isSvg(clean) ? "original" : "w500"}${clean}`;
}

/**
 * 169 -> "2h 49m".
 *
 * Both detail pages inlined `${Math.floor(r / 60)}h ${r % 60}m`, which renders
 * a two-hour film as "2h 0m" and a 45-minute one as "0h 45m". A runtime is
 * read as a phrase, so the empty half is dropped.
 */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return null;
  const whole = Math.round(minutes);
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
