import { jsonError } from "@/utils/apiResponse";
import type { NextResponse } from "next/server";

/**
 * Guard a cron endpoint. Returns a response to send, or null to proceed.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on every scheduled
 * invocation when that variable is set on the project, so a matching header is
 * the whole check.
 *
 * **This fails closed, and that is the point.** Every cron route in this app
 * previously wrote the guard as:
 *
 *   if (expectedToken && authHeader !== `Bearer ${expectedToken}`) return 401;
 *
 * — which is not a guard at all when `CRON_SECRET` is unset. It skips, and the
 * endpoint is open to anyone who can guess a path that is published in this
 * repository. `/api/cron/run-jobs` and `/api/cron/check-availability` both run
 * on the service-role client, and `/api/cron/purge-deleted` hard-deletes
 * accounts. An unset environment variable must not be the difference between
 * "scheduled job" and "public button".
 *
 * 503 rather than 401 when the variable is missing, because the caller did
 * nothing wrong — the deployment is misconfigured, and that should read
 * differently in a log than a bad token.
 */
export function guardCron(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return jsonError(
      "CRON_SECRET is not configured on this deployment, so scheduled jobs are disabled.",
      503,
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return jsonError("Unauthorized", 401);
  }

  return null;
}
