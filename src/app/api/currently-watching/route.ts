import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: "User isn't logged in" },
        { status: 401 },
      );
    }

    // If userId is provided, show that user's watching list (RLS handles visibility)
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId") || authData.user.id;

    const { data: items, error } = await supabase
      .from("currently_watching")
      .select("item_id, item_name, item_type, image_url, started_at")
      .eq("user_id", targetUserId)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Error fetching currently watching:", error);
      return NextResponse.json(
        { error: "Failed to fetch watching list" },
        { status: 500 },
      );
    }

    return NextResponse.json({ items: items ?? [] }, { status: 200 });
  } catch (error) {
    console.error("Error in currently-watching GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
