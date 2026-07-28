import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { item_id, name, item_type, image, adult } = body || {};

    if (!item_id || !name || !item_type) {
      return jsonError("Missing required fields", 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Unauthorized", 401);
    }

    const { error } = await supabase.from("recommendation").insert({
      user_id: user.id,
      item_id,
      name,
      item_type,
      image,
      adult,
    });

    if (error) {
      console.error("Error adding recommendation:", error);
      return jsonError("Failed to add recommendation", 500);
    }

    const { data: updatedData } = await supabase
      .from("recommendation")
      .select("*")
      .eq("user_id", user.id)
      .order("recommended_at", { ascending: false });

    return NextResponse.json(
      { recommendations: updatedData || [] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Recommendation add error:", error);
    return jsonError("Internal Server Error", 500);
  }
}
