import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

async function clubIdFromSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<number | null> {
  const { data } = await supabase.from("clubs").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

/** POST /api/clubs/[slug]/members — join. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const clubId = await clubIdFromSlug(supabase, (await ctx.params).slug);
  if (!clubId) return jsonError("Club not found", 404);

  const { error } = await supabase
    .from("club_members")
    .insert({ club_id: clubId, user_id: userId, status: "active", role: "member" });

  // 23505 = already a member, which is the state the caller wanted anyway.
  if (error && error.code !== "23505") {
    return jsonError(error.message, 500);
  }
  return jsonSuccess({ isMember: true });
}

/** DELETE /api/clubs/[slug]/members — leave. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const clubId = await clubIdFromSlug(supabase, (await ctx.params).slug);
  if (!clubId) return jsonError("Club not found", 404);

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", userId);

  if (error) return jsonError(error.message, 500);
  return jsonSuccess({ isMember: false });
}
