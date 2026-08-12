import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/user-lists/[id]/collaborators */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const listId = Number((await ctx.params).id);
  if (!Number.isInteger(listId)) return jsonError("Invalid list id", 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_list_collaborators")
    // Two FKs point at users (user_id and added_by), so name the column
    // explicitly or PostgREST can't pick one.
    .select("user_id, created_at, users:user_id(username, avatar_url)")
    .eq("list_id", listId);

  if (error) return jsonError(error.message, 500);

  return jsonSuccess({
    collaborators: (data ?? []).map((c) => {
      const u = Array.isArray(c.users) ? c.users[0] : c.users;
      return {
        userId: c.user_id,
        username: (u as { username?: string })?.username ?? "user",
        avatarUrl: (u as { avatar_url?: string | null })?.avatar_url ?? null,
      };
    }),
  });
}

/** POST /api/user-lists/[id]/collaborators — owner only (enforced by RLS). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const listId = Number((await ctx.params).id);
  if (!Number.isInteger(listId)) return jsonError("Invalid list id", 400);

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  if (!body.userId) return jsonError("userId is required", 400);
  if (body.userId === userId) return jsonError("You already own this list", 400);

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_list_collaborators")
    .insert({ list_id: listId, user_id: body.userId, added_by: userId });

  if (error) {
    if (error.code === "23505") return jsonSuccess({ ok: true, already: true });
    // RLS rejects non-owners
    return jsonError("Only the list owner can add collaborators", 403);
  }
  return jsonSuccess({ ok: true });
}

/** DELETE /api/user-lists/[id]/collaborators?userId= — owner, or leave yourself. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const listId = Number((await ctx.params).id);
  const target = req.nextUrl.searchParams.get("userId") ?? userId;
  if (!Number.isInteger(listId)) return jsonError("Invalid list id", 400);

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_list_collaborators")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", target);

  if (error) return jsonError(error.message, 500);
  return jsonSuccess({ ok: true });
}
