import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { syncWatchedItem, fetchShowMeta } from "@/utils/tvMediaStatus";

const TV_STATUSES = ["watchlist", "watching", "watched", "on_hold", "dropped"] as const;
export type MediaStatus = (typeof TV_STATUSES)[number];

function isValidStatus(s: unknown): s is MediaStatus {
  return typeof s === "string" && TV_STATUSES.includes(s as MediaStatus);
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const showId = req.nextUrl.searchParams.get("showId")?.trim();
  const showIdsParam = req.nextUrl.searchParams.get("showIds")?.trim();

  if (showId) {
    const { data, error } = await supabase
      .from("user_media_status")
      .select("status")
      .eq("user_id", userId)
      .eq("item_id", showId)
      .eq("item_type", "tv")
      .maybeSingle();
    if (error) return jsonError("Failed to fetch status", 500);
    return jsonSuccess(
      { status: (data as { status?: string } | null)?.status ?? null },
      { maxAge: 0 }
    );
  }

  if (showIdsParam) {
    const ids = showIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return jsonSuccess({ statuses: {} }, { maxAge: 0 });
    const { data, error } = await supabase
      .from("user_media_status")
      .select("item_id, status")
      .eq("user_id", userId)
      .eq("item_type", "tv")
      .in("item_id", ids);
    if (error) return jsonError("Failed to fetch statuses", 500);
    const statuses: Record<string, string> = {};
    for (const row of (data ?? []) as { item_id: string; status: string }[]) {
      statuses[row.item_id] = row.status;
    }
    return jsonSuccess({ statuses }, { maxAge: 0 });
  }

  return jsonError("showId or showIds is required", 400);
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  let body: { showId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { showId, status } = body;
  if (!showId) return jsonError("showId is required", 400);
  if (!isValidStatus(status)) return jsonError("Invalid status", 400);

  const { error } = await supabase.from("user_media_status").upsert(
    {
      user_id: userId,
      item_id: showId,
      item_type: "tv",
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id,item_type" }
  );

  if (error) return jsonError(error.message, 500);

  // Keep watched_items in step, or a show marked watched from this control
  // can't be rated or reviewed and never reaches the profile.
  const show = await fetchShowMeta(showId);
  await syncWatchedItem(supabase, userId, showId, status === "watched", show);

  return jsonSuccess({ ok: true, status });
}
