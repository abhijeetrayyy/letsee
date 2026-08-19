import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { item_id } = body || {};
    if (!item_id) {
      return jsonError("Item ID required", 400);
    }

    const supabase = await createClient();
    const userId = await getAuthUserId();

    if (!userId) {
      return jsonError("Unauthorized", 401);
    }

    const { error } = await supabase
      .from("recommendation")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", item_id);

    if (error) {
      console.error("Error removing recommendation:", error);
      return jsonError("Failed to remove recommendation", 500);
    }

    return jsonSuccess({ message: "Recommendation removed" });
  } catch (error) {
    console.error("Recommendation remove error:", error);
    return jsonError("Internal Server Error", 500);
  }
}
