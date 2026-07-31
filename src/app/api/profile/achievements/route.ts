import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

/** GET /api/profile/achievements?userId= — unlocked badges for a profile. RLS (profile_visible_to_viewer OR self) gates visibility. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return jsonError("userId is required", 400);

  const { data, error } = await supabase
    .from("user_achievements")
    .select("achievement_id, unlocked_at, is_hidden, achievements (id, name, description, icon, category)")
    .eq("user_id", userId)
    .eq("is_hidden", false)
    .order("unlocked_at", { ascending: false });

  if (error) return jsonError(error.message, 500);

  const achievements = (data ?? [])
    .map((row) => {
      const a = Array.isArray(row.achievements) ? row.achievements[0] : row.achievements;
      if (!a) return null;
      return { id: a.id, name: a.name, description: a.description, icon: a.icon, category: a.category, unlockedAt: row.unlocked_at };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  return jsonSuccess({ achievements });
}
