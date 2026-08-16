import { NextResponse } from "next/server";
import { notifyNewEpisodes } from "@/utils/jobs/newEpisodeNotifier";
import { jsonError } from "@/utils/apiResponse";

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
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return jsonError("Unauthorized", 401);
  }

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
