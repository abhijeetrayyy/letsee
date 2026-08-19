import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

/**
 * GET /api/title-audience?itemId=&itemType= — how many people here have seen
 * a title, plus a few public faces. Works signed-out.
 */
export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");
  const itemType = req.nextUrl.searchParams.get("itemType") === "tv" ? "tv" : "movie";
  if (!itemId) return jsonError("itemId is required", 400);

  const supabase = await createClient();
  const viewerId = await getAuthUserId();

  const { data, error } = await supabase.rpc("title_audience", {
    p_item_id: itemId,
    p_item_type: itemType,
    p_viewer: viewerId ?? null,
  });

  if (error) {
    console.error("title_audience:", error);
    return jsonError("Failed to load audience", 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return jsonSuccess({
    viewers: Number(row?.viewers ?? 0),
    totalUsers: Number(row?.total_users ?? 0),
    sample: row?.sample ?? [],
  });
}
