import { jsonError } from "@/utils/apiResponse";
import type { NextResponse } from "next/server";

/**
 * Guard a route that may only ever run on a developer's machine.
 *
 * The sibling of `guardCron`. Where that one proves the caller knows a secret,
 * this one proves the route is not reachable from the internet at all — which
 * is a stronger claim, and a cheaper one, because there is no secret to
 * configure and therefore no secret to leave unset. (`guardCron`'s own comment
 * is about exactly that failure mode: an unset environment variable used to be
 * the difference between "scheduled job" and "public button".)
 *
 * ── Two independent grounds ────────────────────────────────────────────────
 * Either one alone would do; both are checked so that neither has to be
 * trusted on its own.
 *
 *   1. `NODE_ENV === "production"` — a production build refuses outright,
 *      whatever any header claims. This is the one that holds if the route is
 *      ever deployed by accident.
 *   2. The request must arrive on loopback. `request.url`'s host is rewritten
 *      by proxies and is not trustworthy alone, so the `Host` header is
 *      checked too and **both** must be loopback.
 *
 * A route wearing this can ship to production and still answer 403 to
 * everyone, including its author. That is what makes it safe for an endpoint
 * that spends the TMDB key without authenticating anybody —
 * `tests/invariants/route-rules.test.ts` recognises this guard for that reason.
 */
export function guardLocalOnly(request: Request): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return jsonError("This endpoint only runs in local development.", 403);
  }

  if (!isLoopback(request.headers.get("host")) || !isLoopback(hostnameOf(request.url))) {
    return jsonError("This endpoint only answers on localhost.", 403);
  }

  return null;
}

function isLoopback(value: string | null | undefined): boolean {
  if (!value) return false;
  // Strip a trailing port, and mind IPv6's brackets ("[::1]:3000").
  const host = value.trim().toLowerCase().replace(/:\d+$/, "");
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
