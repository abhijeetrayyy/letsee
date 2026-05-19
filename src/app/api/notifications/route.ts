import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/notifications?page=1&limit=20
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Fetch notifications with actor info
  const { data: notifications, error, count } = await supabase
    .from("notifications")
    .select(`
      *,
      actor:users!actor_id (
        username,
        avatar_url
      )
    `, { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform: Supabase returns joined data as array; extract first element
  const transformed = (notifications ?? []).map((n: any) => ({
    ...n,
    actor: Array.isArray(n.actor) && n.actor.length > 0 ? n.actor[0] : null,
  }));

  // Get unread count
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / limit);

  return NextResponse.json({
    data: transformed,
    unreadCount: unreadCount ?? 0,
    totalItems,
    totalPages,
    page,
  });
}

// PATCH /api/notifications — mark notifications as read
// Body: { ids?: number[] } — if ids provided, mark those; otherwise mark all
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = body.ids;

  let query = supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id);

  if (Array.isArray(ids) && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
