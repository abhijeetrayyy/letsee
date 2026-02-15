import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId } = body;

    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data?.user) {
      return NextResponse.json(
        { error: "User isn't logged in" },
        { status: 401 },
      );
    }

    const userId = data.user.id;

    // Check if item exists in currently_watching
    const { data: existingItem, error: fetchError } = await supabase
      .from("currently_watching")
      .select("item_id")
      .eq("user_id", userId)
      .eq("item_id", String(itemId))
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch watching list." },
        { status: 500 },
      );
    }

    if (!existingItem) {
      return NextResponse.json(
        { error: "Item not found in watching list" },
        { status: 404 },
      );
    }

    // Delete the item from currently_watching
    const { error: deleteError } = await supabase
      .from("currently_watching")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", String(itemId));

    if (deleteError) {
      console.error("Error deleting from watching:", deleteError);
      return NextResponse.json(
        { error: "Error removing from watching" },
        { status: 500 },
      );
    }

    // Decrement watching_count
    const { error: decrementError } = await supabase.rpc(
      "decrement_watching_count",
      {
        p_user_id: userId,
      },
    );
    if (decrementError) {
      console.error("Error decrementing watching_count:", decrementError);
    }

    return NextResponse.json(
      { message: "Removed from watching" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in deletewatchingButton POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
