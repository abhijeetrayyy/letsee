import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body?.query;
    if (!query) {
      return jsonError("Search query required", 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Unauthorized", 401);
    }

    const { data, error } = await supabase
      .from("watched_items")
      .select("*")
      .eq("user_id", user.id)
      .ilike("item_name", `%${query}%`)
      .order("item_name", { ascending: true })
      .limit(10);

    if (error) {
      console.error("Error searching watched items:", error);
      return jsonError("Failed to search watched items", 500);
    }

    return jsonSuccess({ results: data || [] });
  } catch (error) {
    console.error("Recommendation search error:", error);
    return jsonError("Internal Server Error", 500);
  }
}
