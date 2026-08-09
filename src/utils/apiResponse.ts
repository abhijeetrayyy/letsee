import { NextResponse } from "next/server";

const DEFAULT_STALE_WHILE_REVALIDATE = 1800; // 30 min

export type ApiSuccessOptions = {
  status?: number;
  /**
   * Max age in seconds for shared/CDN Cache-Control. Defaults to 0 (not cached
   * by any shared/proxy cache) — most routes return data scoped to the current
   * request's cookies/session, and a public cache has no way to key that per
   * user. Only pass a positive value for routes returning the SAME response to
   * every visitor regardless of auth state (e.g. TMDB trending/genre lists).
   */
  maxAge?: number;
  /** Stale-while-revalidate in seconds. Only used when maxAge > 0. */
  staleWhileRevalidate?: number;
};

/**
 * Consistent success response for API routes.
 * Use for 200/201 with optional caching to improve UX and reduce load.
 */
export function jsonSuccess<T>(
  data: T,
  options: ApiSuccessOptions = {}
): NextResponse {
  const {
    status = 200,
    maxAge = 0,
    staleWhileRevalidate = DEFAULT_STALE_WHILE_REVALIDATE,
  } = options;

  const headers: HeadersInit = {
    "Cache-Control":
      maxAge > 0
        ? `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
        : "private, no-store",
  };

  return NextResponse.json(data, { status, headers });
}

/**
 * Consistent error response for API routes.
 * Clients can always read body.error for user-facing or fallback messages.
 */
export function jsonError(
  message: string,
  status: number = 500
): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
