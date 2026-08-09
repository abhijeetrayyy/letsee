import { createClient } from "@/utils/supabase/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

/** GET /api/club-pick/current — the currently-active Club Pick, or null. Public, no auth required. */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("club_picks")
    .select("id, item_id, item_type, title, image_url, note, starts_at, ends_at")
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);

  const pick = data && new Date(data.ends_at).getTime() > Date.now() ? data : null;

  return jsonSuccess({ pick }, { maxAge: 300 });
}
