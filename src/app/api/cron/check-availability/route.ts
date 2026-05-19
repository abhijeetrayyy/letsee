import { NextResponse } from "next/server";
import { checkWatchlistAvailability } from "@/utils/jobs/availabilityChecker";

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
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
