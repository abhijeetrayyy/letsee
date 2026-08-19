import { NextResponse } from "next/server";
import { checkWatchlistAvailability } from "@/utils/jobs/availabilityChecker";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { guardCron } from "@/utils/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CRON endpoint: checks streaming availability for all opted-in users' watchlists.
 * 
 * Vercel Cron config (vercel.json):
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/check-availability",
 *       "schedule": "0 12 * * 1"
 *     }
 *   ]
 * }
 * 
 * For security, this should be invoked only by Vercel Cron or a server-side scheduler.
 * It uses the Supabase service_role to bypass RLS.
 */
export async function GET(request: Request) {
  // Fail closed. This used to skip the check entirely when CRON_SECRET was
  // unset, which left a service-role endpoint open to anyone with the URL.
  const denied = guardCron(request);
  if (denied) return denied;

  try {
    const result = await checkWatchlistAvailability();
    return NextResponse.json({
      success: true,
      checked: result.checked,
      newAlerts: result.alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Availability check cron failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
