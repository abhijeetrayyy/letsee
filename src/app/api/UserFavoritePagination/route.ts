// app/api/watched-movies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server"; // Adjust import if needed
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userID, page = 1, limit = 7 } = body;

    if (!userID) {
      return jsonError("User ID is required", 400);
    }

    const supabase = await createClient();
    const viewerId = await getAuthUserId();

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("visibility")
      .eq("id", userID)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonError("User not found", 404);
    }

    const visibility = String(profile.visibility ?? "public").toLowerCase().trim();
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
      return jsonError("Forbidden", 403);
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
    // ORDER BY is not optional here. LIMIT/OFFSET over an unordered query
    // returns rows in whatever order the plan happens to produce, and each page
    // is a separate query — so pages overlap. The profile renders its first 12
    // ordered by created_at desc and this returned heap order, which meant
    // those 12 reappeared further down the list while 12 other favourites were
    // never reachable at all. id breaks ties so the sort is total.
    const { data, error } = await supabase
      .from("favorite_items")
      .select("*")
      .eq("user_id", userID)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
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
    return jsonError("An error occurred", 500);
  }
}
