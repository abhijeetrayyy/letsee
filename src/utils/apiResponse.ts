import { NextResponse } from "next/server";

const DEFAULT_CACHE_MAX_AGE = 3600; // 1 hour
const DEFAULT_STALE_WHILE_REVALIDATE = 1800; // 30 min

export type ApiSuccessOptions = {
  status?: number;
  /** Max age in seconds for Cache-Control. Set 0 to skip. */
  maxAge?: number;
  /** Stale-while-revalidate in seconds. */
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
    maxAge = DEFAULT_CACHE_MAX_AGE,
    staleWhileRevalidate = DEFAULT_STALE_WHILE_REVALIDATE,
  } = options;

  const headers: HeadersInit = {};
  if (maxAge > 0) {
    headers["Cache-Control"] = `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
  }

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
