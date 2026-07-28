import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function GET(request: Request) {
  const supabase = await createClient();
  try {
    // Get the authenticated user from Supabase
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return jsonSuccess({ status: "anon", user: null });
    }

    // Fetch additional user data from the "users" table
    const { data: userData, error: dbError } = await supabase
      .from("users")
      .select("id, username")
      .eq("id", authUser.id)
      .limit(1)
      .maybeSingle();

    if (dbError) {
      return jsonSuccess({ status: "anon", user: null });
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

    return jsonSuccess({ status: "ok", user: userData });
  } catch (error) {
    console.error("API Error:", error);
    return jsonError("Internal Server Error", 500);
  }
}
