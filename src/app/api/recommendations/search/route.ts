import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body?.query;
    if (!query) {
      return NextResponse.json(
        { error: "Search query required" },
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

    const { data, error } = await supabase
      .from("watched_items")
      .select("*")
      .eq("user_id", user.id)
      .ilike("item_name", `%${query}%`)
      .order("item_name", { ascending: true })
      .limit(10);

    if (error) {
      console.error("Error searching watched items:", error);
      return NextResponse.json(
        { error: "Failed to search watched items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ results: data || [] }, { status: 200 });
  } catch (error) {
    console.error("Recommendation search error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
