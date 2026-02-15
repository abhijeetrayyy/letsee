import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

const TV_STATUSES = [
  "watching",
  "completed",
  "on_hold",
  "dropped",
  "plan_to_watch",
  "rewatching",
] as const;
export type TvListStatus = (typeof TV_STATUSES)[number];

function isValidStatus(s: unknown): s is TvListStatus {
  return typeof s === "string" && TV_STATUSES.includes(s as TvListStatus);
}

/** GET ?showId=123 → { status } or ?showIds=1,2,3 → { statuses: { [showId]: status } } */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return jsonError("User isn't logged in", 401);
  }

  const showId = req.nextUrl.searchParams.get("showId")?.trim();
  const showIdsParam = req.nextUrl.searchParams.get("showIds")?.trim();

  if (showId) {
    const { data, error } = await supabase
      .from("user_tv_list")
      .select("status")
      .eq("user_id", user.id)
      .eq("show_id", showId)
      .maybeSingle();
    if (error) return jsonError("Failed to fetch status", 500);
    return jsonSuccess(
      { status: (data as { status?: string } | null)?.status ?? null },
      { maxAge: 0 },
    );
  }

  if (showIdsParam) {
    const ids = showIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return jsonSuccess({ statuses: {} }, { maxAge: 0 });
    const { data, error } = await supabase
      .from("user_tv_list")
      .select("show_id, status")
      .eq("user_id", user.id)
      .in("show_id", ids);
    if (error) return jsonError("Failed to fetch statuses", 500);
    const statuses: Record<string, string> = {};
    for (const row of (data ?? []) as { show_id: string; status: string }[]) {
      statuses[row.show_id] = row.status;
    }
    return jsonSuccess({ statuses }, { maxAge: 0 });
  }

  return jsonError("showId or showIds query parameter is required", 400);
}

/** PATCH { showId, status } — set TV list status for current user */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return jsonError("User isn't logged in", 401);
  }

  let body: { showId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const showId = body.showId != null ? String(body.showId).trim() : "";
  if (!showId) return jsonError("showId is required", 400);
  if (!isValidStatus(body.status))
    return jsonError("status must be one of: " + TV_STATUSES.join(", "), 400);

  const { error } = await supabase
    .from("user_tv_list")
    .upsert(
      {
        user_id: user.id,
        show_id: showId,
        status: body.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,show_id" },
    );

  if (error) return jsonError("Failed to update status", 500);
  return jsonSuccess({ status: body.status }, { maxAge: 0 });
}
