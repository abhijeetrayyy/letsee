import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { item_id } = body || {};
    if (!item_id) {
      return NextResponse.json(
        { error: "Item ID required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("recommendation")
      .delete()
      .eq("user_id", user.id)
      .eq("item_id", item_id);

    if (error) {
      console.error("Error removing recommendation:", error);
      return NextResponse.json(
        { error: "Failed to remove recommendation" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Recommendation removed" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Recommendation remove error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
