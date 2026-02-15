import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, mediaType } = body;

    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data?.user) {
      return NextResponse.json(
        { error: "User isn't logged in" },
        { status: 401 },
      );
    }

    const userId = data.user.id;
    const itemIdStr = String(itemId);

    // ----- TV SHOWS: remove from user_tv_list -----
    if (mediaType === "tv") {
      const { data: existingItem, error: fetchError } = await supabase
        .from("user_tv_list")
        .select("show_id")
        .eq("user_id", userId)
        .eq("show_id", itemIdStr)
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

      const { error: deleteError } = await supabase
        .from("user_tv_list")
        .delete()
        .eq("user_id", userId)
        .eq("show_id", itemIdStr);

      if (deleteError) {
        console.error("Error deleting from user_tv_list:", deleteError);
        return NextResponse.json(
          { error: "Error removing from watching" },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { message: "Removed from watching" },
        { status: 200 },
      );
    }

    // ----- MOVIES: remove from currently_watching (unchanged) -----
    const { data: existingItem, error: fetchError } = await supabase
      .from("currently_watching")
      .select("item_id")
      .eq("user_id", userId)
      .eq("item_id", itemIdStr)
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

    const { error: deleteError } = await supabase
      .from("currently_watching")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemIdStr);

    if (deleteError) {
      console.error("Error deleting from watching:", deleteError);
      return NextResponse.json(
        { error: "Error removing from watching" },
        { status: 500 },
      );
    }

    // Decrement watching_count (only for movies using currently_watching)
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
