import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const requestClone = req.clone();
    const body = await requestClone.json();
    const { itemId } = body;

    const supabase = await createClient();

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        { error: "User isn't logged in" },
        { status: 401 }
      );
    }

    const userId = data.user.id;

    const { data: existingItem, error: fetchError } = await supabase
      .from("favorite_items")
      .select("item_id")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch favorites." },
        { status: 500 }
      );
    }

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await removeFromFavorite(userId, itemId);

    return NextResponse.json({ message: "Removed" }, { status: 200 });
  } catch (error) {
    console.error("Delete favorite error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

async function removeFromFavorite(userId: string, itemId: string) {
  const supabase = await createClient();
  // Delete the item from the watchlist
  const { error: deleteError } = await supabase
    .from("favorite_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);

  if (deleteError) {
    console.log("Error deleting item:", deleteError);
    throw deleteError;
  }

  // Decrement the watchlist count
  const { error: decrementError } = await supabase.rpc(
    "decrement_favorites_count",
    {
      p_user_id: userId,
    }
  );

  if (decrementError) {
    throw decrementError;
  }
}
