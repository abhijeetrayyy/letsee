import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";

export async function GET(request: Request) {
  const supabase = await createClient();
  try {
    // Via getAuthUserId, so this verifies the token locally rather than
    // asking the auth server. This is the route the header's signed-in state
    // depends on, and it used to race the app's other parallel API calls to
    // redeem the refresh token — losing that race is what flipped the header
    // to "Log in" until a manual reload.
    const userId = await getAuthUserId();

    if (!userId) {
      return jsonSuccess({ status: "anon", user: null });
    }

    // Fetch additional user data from the "users" table
    const { data: userData, error: dbError } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (dbError) {
      return jsonSuccess({ status: "anon", user: null });
    }

    if (!userData || !userData.username) {
      return NextResponse.json(
        {
          status: "needs_profile",
          user: { id: userId, username: userData?.username ?? null },
        },
        { status: 200, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    return jsonSuccess({ status: "ok", user: userData });
  } catch (error) {
    console.error("API Error:", error);
    return jsonError("Internal Server Error", 500);
  }
}
