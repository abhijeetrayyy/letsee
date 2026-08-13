import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getUserStats } from "@/utils/userStats";

/**
 * GET /api/profile/stats/summary
 *
 * The same counters the profile header renders, for client components that
 * can't call getUserStats directly. The home sidebar used to derive its own
 * from /api/userPrefrence — which is why its hours figure disagreed with the
 * profile's.
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const stats = await getUserStats(supabase, userId);

  return jsonSuccess(stats, { maxAge: 0 });
}
