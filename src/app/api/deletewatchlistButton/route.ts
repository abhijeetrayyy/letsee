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

    await removeFromWatchList(userId, itemId);

    return NextResponse.json({ message: "Removed" }, { status: 200 });
  } catch (error) {
    console.error("Delete watchlist error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

async function removeFromWatchList(userId: string, itemId: string) {
  const supabase = await createClient();
  // Delete the item from the watchlist
  const { error: deleteError } = await supabase
    .from("user_watchlist")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);

  if (deleteError) {
    console.log("Error deleting item:", deleteError);
    throw deleteError;
  }

  // Decrement the watchlist count
  const { error: decrementError } = await supabase.rpc(
    "decrement_watchlist_count",
    {
      p_user_id: userId,
    }
  );

  if (decrementError) {
    throw decrementError;
  }
}
