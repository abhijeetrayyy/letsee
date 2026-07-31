const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export const NO_POSTER = "/no-photo.webp";
export const DEFAULT_AVATAR = "/avatar.svg";

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

/** Resolve a TMDB poster/still path (or already-absolute URL) to a displayable image URL. */
export function getPosterUrl(
  path: string | null | undefined,
  size: "w92" | "w154" | "w185" | "w342" | "w500" = "w185",
): string {
  if (!path?.trim()) return NO_POSTER;
  const value = path.trim();
  if (isAbsoluteUrl(value)) return value;
  const clean = value.startsWith("/") ? value.slice(1) : value;
  return `${TMDB_IMAGE_BASE}/${size}/${clean}`;
}

/** Resolve a user avatar URL, falling back to the shared default avatar. */
export function getAvatarUrl(url: string | null | undefined): string {
  if (!url?.trim()) return DEFAULT_AVATAR;
  return url.trim();
}
