import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const userId = body?.user_id;
    if (!userId) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const viewerId = user?.id ?? null;
    const isOwner = viewerId === userId;

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("visibility")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const visibility = String(profile.visibility ?? "public").toLowerCase().trim();
    let canView = visibility === "public" || (viewerId && viewerId === userId);

    if (!canView && viewerId && visibility === "followers") {
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

    const recoResponse = await supabase
      .from("recommendation")
      .select("*")
      .eq("user_id", userId)
      .order("recommended_at", { ascending: false });

    if (recoResponse.error) {
      console.error("Error fetching recommendations:", recoResponse.error);
      return NextResponse.json(
        { error: "Failed to fetch recommendations" },
        { status: 500 }
      );
    }

    let watchedItems: any[] = [];
    if (isOwner) {
      const watchedResponse = await supabase
        .from("watched_items")
        .select("*")
        .eq("user_id", userId)
        .order("watched_at", { ascending: false })
        .limit(10);

      if (watchedResponse.error) {
        console.error("Error fetching watched items:", watchedResponse.error);
        return NextResponse.json(
          { error: "Failed to fetch watched items" },
          { status: 500 }
        );
      }
      watchedItems = watchedResponse.data || [];
    }

    return NextResponse.json(
      {
        recommendations: recoResponse.data || [],
        watchedItems,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
