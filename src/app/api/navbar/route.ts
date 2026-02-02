import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  try {
    // Get the authenticated user from Supabase
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ status: "anon", user: null }, { status: 200 });
    }

    // Fetch additional user data from the "users" table
    const { data: userData, error: dbError } = await supabase
      .from("users")
      .select("id, username")
      .eq("id", authUser.id)
      .limit(1)
      .maybeSingle();

    if (dbError) {
      return NextResponse.json({ status: "anon", user: null }, { status: 200 });
    }

    if (!userData || !userData.username) {
      return NextResponse.json(
        {
          status: "needs_profile",
          user: { id: authUser.id, username: userData?.username ?? null },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ status: "ok", user: userData }, { status: 200 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
