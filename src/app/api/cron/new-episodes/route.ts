import { NextResponse } from "next/server";
import { notifyNewEpisodes } from "@/utils/jobs/newEpisodeNotifier";
import { jsonError } from "@/utils/apiResponse";
import { guardCron } from "@/utils/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CRON: notify people about new episodes of shows they're watching.
 *
 * Scheduled from vercel.json. Follows the same shape as
 * /api/cron/check-availability — a plain function called directly rather than
 * anything routed through background_jobs, which has no registered handlers
 * (see the note in newEpisodeNotifier.ts).
 *
 * Guarded by CRON_SECRET. Note the guard is skipped when the variable is
 * unset, matching the existing cron routes: convenient locally, but it means
 * **CRON_SECRET must be set in production** or this endpoint is open to
 * anyone who guesses the path.
 */
export async function GET(request: Request) {
  // Fail closed. This used to skip the check entirely when CRON_SECRET was
  // unset, which left a service-role endpoint open to anyone with the URL.
  const denied = guardCron(request);
  if (denied) return denied;

  try {
    const result = await notifyNewEpisodes();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("New episode cron failed:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
