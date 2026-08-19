import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/clubs/[slug] — club, members, and the current pick. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const supabase = await createClient();
  const viewerId = await getAuthUserId();

  const { data: club } = await supabase
    .from("clubs")
    .select("id, slug, name, description, image_url, member_count, created_by, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!club) return jsonError("Club not found", 404);

  const [{ data: members }, { data: picks }] = await Promise.all([
    supabase
      .from("club_members")
      .select("user_id, role, status, joined_at, users!inner(username, avatar_url)")
      .eq("club_id", club.id)
      .eq("status", "active")
      .order("joined_at", { ascending: true })
      .limit(24),
    supabase
      .from("club_picks")
      .select("id, item_id, item_type, title, image_url, note, starts_at, ends_at")
      .eq("club_id", club.id)
      .lte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .limit(1),
  ]);

  /**
   * The viewer's own row, at any status.
   *
   * `members` above is filtered to `active`, which is right for the face pile
   * and wrong for answering "am I in?" now that 083 makes `pending` a state a
   * user can actually be in. Without this a pending request read as "not a
   * member", so the button said Join, the insert came back 23505, and the
   * request was invisible to the person who made it.
   */
  let viewerStatus: string | null = null;
  if (viewerId) {
    const { data: mine } = await supabase
      .from("club_members")
      .select("status")
      .eq("club_id", club.id)
      .eq("user_id", viewerId)
      .maybeSingle();
    viewerStatus = (mine?.status as string | undefined) ?? null;
  }

  const pick = picks?.[0] ?? null;
  const activePick = pick && new Date(pick.ends_at).getTime() > Date.now() ? pick : null;

  const normalized = (members ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      userId: m.user_id,
      username: (u as { username?: string })?.username ?? "user",
      avatarUrl: (u as { avatar_url?: string | null })?.avatar_url ?? null,
      role: m.role,
    };
  });

  return jsonSuccess({
    club,
    members: normalized,
    pick: activePick,
    isMember: viewerStatus === "active",
    membership: (viewerStatus ?? "none") as "none" | "pending" | "active" | "banned",
    isAdmin:
      !!viewerId &&
      normalized.some((m) => m.userId === viewerId && (m.role === "owner" || m.role === "moderator")),
  });
}
