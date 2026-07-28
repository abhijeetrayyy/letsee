import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");

  if (itemId) {
    // Check specific item
    const { data } = await supabase
      .from("watchlist_alerts")
      .select("provider_name, alert_type, last_notified_at")
      .eq("user_id", userId)
      .eq("item_id", itemId);

    return jsonSuccess(data ?? [], { maxAge: 0 });
  }

  // Return all alerts for the user
  const { data, error } = await supabase
    .from("watchlist_alerts")
    .select("item_id, item_type, provider_name, alert_type, last_notified_at")
    .eq("user_id", userId)
    .order("last_notified_at", { ascending: false })
    .limit(50);

  if (error) return jsonError(error.message, 500);

  return jsonSuccess(data ?? [], { maxAge: 0 });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: { itemId?: string; itemType?: string; providerName?: string; alertType?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { itemId, itemType, providerName, alertType } = body;
  if (!itemId || !itemType || !providerName || !alertType) {
    return jsonError("itemId, itemType, providerName, and alertType are required", 400);
  }

  const validAlerts = ["added", "removed", "price_drop"];
  if (!validAlerts.includes(alertType)) {
    return jsonError(`alertType must be one of: ${validAlerts.join(", ")}`, 400);
  }

  const { error } = await supabase.from("watchlist_alerts").upsert(
    {
      user_id: userId,
      item_id: String(itemId),
      item_type: itemType,
      provider_name: providerName,
      alert_type: alertType,
      last_notified_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id,provider_name,alert_type" }
  );

  if (error) return jsonError(error.message, 500);

  return jsonSuccess({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  const providerName = url.searchParams.get("provider");
  const alertType = url.searchParams.get("type");

  if (!itemId) return jsonError("itemId is required", 400);

  let query = supabase
    .from("watchlist_alerts")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);

  if (providerName) query = query.eq("provider_name", providerName);
  if (alertType) query = query.eq("alert_type", alertType);

  const { error } = await query;

  if (error) return jsonError(error.message, 500);

  return jsonSuccess({ ok: true });
}
