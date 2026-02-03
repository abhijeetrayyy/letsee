import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

type DisplayItem = {
  position: number;
  item_id: string;
  item_type: "movie" | "tv";
  image_url: string | null;
  item_name: string;
};

/** GET /api/profile/favorite-display?userId=uuid — returns { items: DisplayItem[] } for that profile. Respects profile visibility. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return jsonError("Missing userId", 400);
  }

  const { data: viewer } = await supabase.auth.getUser();
  const viewerId = viewer?.user?.id ?? null;

  if (viewerId !== userId) {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("visibility")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !profile) {
      return jsonError("User not found", 404);
    }
    const visibility = String(profile.visibility ?? "public").toLowerCase().trim();
    let canView = visibility === "public" || viewerId === userId;
    if (!canView && viewerId && visibility === "followers") {
      const { data: conn } = await supabase
        .from("user_connections")
        .select("id")
        .eq("follower_id", viewerId)
        .eq("followed_id", userId)
        .maybeSingle();
      if (conn?.id) canView = true;
    }
    if (!canView) {
      return jsonError("Forbidden", 403);
    }
  }

  const { data: rows, error } = await supabase
    .from("user_favorite_display")
    .select("position, item_id, item_type, image_url, item_name")
    .eq("user_id", userId)
    .order("position", { ascending: true });

  if (error) {
    return jsonError(error.message || "Failed to fetch favorite display", 500);
  }

  const items: DisplayItem[] = (rows ?? []).map((r) => ({
    position: r.position,
    item_id: r.item_id,
    item_type: r.item_type as "movie" | "tv",
    image_url: r.image_url ?? null,
    item_name: r.item_name,
  }));

  return jsonSuccess({ items }, { maxAge: 60 });
}

/** PUT /api/profile/favorite-display — body: { items: { item_id, item_type, image_url?, item_name }[] } (up to 4). Owner only. */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return jsonError("Not logged in", 401);
  }

  let body: { items?: Array<{ item_id: string; item_type: string; image_url?: string; item_name: string }> };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const items = body.items ?? [];
  if (!Array.isArray(items) || items.length > 4) {
    return jsonError("items must be an array with at most 4 entries", 400);
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it?.item_id || !it?.item_name || (it.item_type !== "movie" && it.item_type !== "tv")) {
      return jsonError(`items[${i}] must have item_id, item_name, and item_type (movie|tv)`, 400);
    }
  }

  const userId = user.user.id;

  const { error: deleteError } = await supabase
    .from("user_favorite_display")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    return jsonError(deleteError.message || "Failed to update display", 500);
  }

  if (items.length === 0) {
    return jsonSuccess({ items: [] }, { maxAge: 0 });
  }

  const toInsert = items.map((it, idx) => ({
    user_id: userId,
    position: idx + 1,
    item_id: String(it.item_id),
    item_type: it.item_type as "movie" | "tv",
    image_url: it.image_url?.trim() || null,
    item_name: String(it.item_name),
  }));

  const { error: insertError } = await supabase
    .from("user_favorite_display")
    .insert(toInsert);

  if (insertError) {
    return jsonError(insertError.message || "Failed to save display", 500);
  }

  return jsonSuccess(
    { items: toInsert.map((r) => ({ position: r.position, item_id: r.item_id, item_type: r.item_type, image_url: r.image_url, item_name: r.item_name })) },
    { maxAge: 0 }
  );
}
