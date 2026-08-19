import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  const requestClone = req.clone();
  const body = await requestClone.json();
  const { userId } = body;

  const supabase = await createClient();

  // Get user details from Supabase (authenticated user)
  const viewerId = await getAuthUserId();
  if (!viewerId) {
    return jsonError("User isn't logged in", 401);
  }
  if (!userId) {
    return jsonError("userId is required", 400);
  }

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

  if (!canView && visibility === "followers") {
    const { data: connection } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", userId)
      .maybeSingle();
    if (connection) {
      canView = true;
    }
  }

  if (!canView) {
    return jsonError("Forbidden", 403);
  }

  // Query to get emails of users followed by the specified user using the correct relationship
  const { data: connection, error: connectionError } = await supabase
    .from("user_connections")
    .select("followed_id, users!fk_followed(username)")
    .eq("follower_id", userId);

  if (connectionError) {
    console.error("Error fetching connections:", connectionError);
    return jsonError("Error fetching connections", 500);
  }

  return jsonSuccess({ connection });
}
