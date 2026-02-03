import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface User {
  username: string;
  about?: string;
  avatar_url?: string | null;
  watched_count: number;
  favorites_count: number;
  watchlist_count: number;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "User isn't logged in" },
        { status: 401 }
      );
    }

    const selectWithAvatar =
      "username, about, avatar_url, user_cout_stats (watched_count, favorites_count, watchlist_count)";
    const selectWithoutAvatar =
      "username, about, user_cout_stats (watched_count, favorites_count, watchlist_count)";

    let result = await supabase
      .from("users")
      .select(selectWithAvatar)
      .not("username", "is", null)
      .neq("username", "")
      .order("updated_at", { ascending: false })
      .limit(12);

    if (result.error && (result.error.message?.includes("avatar_url") || result.error.code === "42703")) {
      const fallback = await supabase
        .from("users")
        .select(selectWithoutAvatar)
        .not("username", "is", null)
        .neq("username", "")
        .order("updated_at", { ascending: false })
        .limit(12);
      result = { data: fallback.data, error: fallback.error } as typeof result;
    }

    if (result.error || !result.data) {
      console.error("Error fetching users:", result.error);
      return NextResponse.json(
        { error: "Error fetching users" },
        { status: 500 }
      );
    }

    const usersData = result.data;
    const users: User[] = usersData.map((row: Record<string, unknown>) => {
      const stats = (row.user_cout_stats as Record<string, number>) || {};
      const avatarUrl = "avatar_url" in row && row.avatar_url != null ? String(row.avatar_url) : null;
      return {
        username: String(row.username ?? ""),
        about: row.about != null ? String(row.about) : "",
        avatar_url: avatarUrl,
        watched_count: Number(stats.watched_count) || 0,
        favorites_count: Number(stats.favorites_count) || 0,
        watchlist_count: Number(stats.watchlist_count) || 0,
      };
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
