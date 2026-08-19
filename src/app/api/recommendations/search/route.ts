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
    const userId = await getAuthUserId();

    if (!userId) {
      return jsonError("Unauthorized", 401);
    }

    const { data, error } = await supabase
      .from("watched_items")
      // Not `select("*")`: migration 076 revoked SELECT on `review_text`, the
      // private diary, so a star select now answers 42501. Nothing here wants it.
      .select("id, user_id, item_id, item_name, item_type, image_url, item_adult, genres, watched_at, is_watched, public_review_text")
      .eq("user_id", userId)
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
