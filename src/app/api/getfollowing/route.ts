import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const requestClone = req.clone();
  const body = await requestClone.json();
  const { userId } = body;

  const supabase = await createClient();

  // Get user details from Supabase (authenticated user)
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json(
      { error: "User isn't logged in" },
      { status: 401 }
    );
  }
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("visibility")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const visibility = profile.visibility ?? "public";
  const viewerId = userData.user.id;
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Query to get emails of users followed by the specified user using the correct relationship
  const { data: connection, error: connectionError } = await supabase
    .from("user_connections")
    .select("followed_id, users!fk_followed(username)")
    .eq("follower_id", userId);

  if (connectionError) {
    console.error("Error fetching connections:", connectionError);
    return NextResponse.json(
      { error: "Error fetching connections" },
      { status: 500 }
    );
  }

  return NextResponse.json({ connection }, { status: 200 });
}
