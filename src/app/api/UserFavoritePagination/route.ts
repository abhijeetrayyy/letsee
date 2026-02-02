// app/api/watched-movies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server"; // Adjust import if needed

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userID, page = 1, limit = 7 } = body;

    if (!userID) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user: viewer },
    } = await supabase.auth.getUser();
    const viewerId = viewer?.id ?? null;

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("visibility")
      .eq("id", userID)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const visibility = profile.visibility ?? "public";
    let canView = visibility === "public" || (viewerId && viewerId === userID);

    if (!canView && viewerId && visibility === "followers") {
      const { data: connection } = await supabase
        .from("user_connections")
        .select("id")
        .eq("follower_id", viewerId)
        .eq("followed_id", userID)
        .maybeSingle();
      if (connection) {
        canView = true;
      }
    }

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const pageNumber = Number(page);
    const itemsPerPage = Number(limit);
    const offset = (pageNumber - 1) * itemsPerPage;

    // Fetch total count
    const { count } = await supabase
      .from("favorite_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userID);

    // Fetch paginated results
    const { data, error } = await supabase
      .from("favorite_items")
      .select("*")
      .eq("user_id", userID)
      .range(offset, offset + itemsPerPage - 1);

    if (error) throw error;

    return NextResponse.json({
      data,
      page: pageNumber,
      totalPages: Math.ceil((count || 0) / itemsPerPage),
      totalItems: count,
      perloadLength: data.length,
    });
  } catch (error) {
    console.error("UserFavoritePagination error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
