import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

async function clubFromSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<{ id: number; joinPolicy: string } | null> {
  const { data } = await supabase
    .from("clubs")
    .select("id, join_policy")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as number, joinPolicy: String(data.join_policy ?? "open") };
}

/** POST /api/clubs/[slug]/members — join. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const club = await clubFromSlug(supabase, (await ctx.params).slug);
  if (!club) return jsonError("Club not found", 404);

  /**
   * The club decides, not the caller.
   *
   * This used to send `status: "active"` unconditionally, which made
   * `join_policy = 'request'` decorative — 049 added the column and nothing
   * ever read it, so an approval-only club was joinable instantly. 083's
   * insert policy now derives the required status from the club, so sending
   * the wrong one is rejected rather than quietly honoured.
   */
  const status = club.joinPolicy === "open" ? "active" : "pending";

  const { error } = await supabase
    .from("club_members")
    .insert({ club_id: club.id, user_id: userId, status, role: "member" });

  // 23505 = already a member, which is the state the caller wanted anyway.
  if (error && error.code !== "23505") {
    return jsonError(error.message, 500);
  }
  return jsonSuccess({ isMember: status === "active", pending: status === "pending" });
}

/** DELETE /api/clubs/[slug]/members — leave. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const club = await clubFromSlug(supabase, (await ctx.params).slug);
  if (!club) return jsonError("Club not found", 404);

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", club.id)
    .eq("user_id", userId);

  if (error) return jsonError(error.message, 500);
  return jsonSuccess({ isMember: false });
}
