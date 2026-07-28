import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";

export async function GET(req: NextRequest) {
  let userId: string | null = req.nextUrl.searchParams.get("userId")?.trim() ?? null;
  const animeFlag = req.nextUrl.searchParams.get("anime") === "1";

  if (!userId) {
    userId = await getAuthUserId();
    if (!userId) return jsonError("Not authenticated", 401);
  }

  const supabase = await createClient();

  const { data: statusRows, error } = await supabase
    .from("user_media_status")
    .select("item_id, item_type, item_name, image_url, item_adult, genres, status, updated_at")
    .eq("user_id", userId)
    .eq("status", "watching")
    .order("updated_at", { ascending: false });

  if (error) return jsonError(error.message, 500);

  const items = (statusRows ?? [])
    .filter((item) => {
      if (animeFlag) {
        return (item.genres as string[])?.some(
          (g: string) => g.toLowerCase() === "animation"
        );
      }
      return true;
    })
    .map((r) => ({
      item_id: r.item_id,
      item_name: r.item_name,
      item_type: r.item_type,
      image_url: r.image_url,
      started_at: r.updated_at,
      item_adult: r.item_adult ?? false,
      genres: r.genres ?? [],
    }));

  return jsonSuccess({ items }, { maxAge: 0 });
}
