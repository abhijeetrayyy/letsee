/**
 * Conversations, follow lists and clubs — the social reads a signed-in session
 * makes when it visits those pages.
 *
 * All three were routes whose body was a query plus a visibility check, and the
 * visibility check is the interesting part: it is re-read here to produce a
 * *message* ("this profile is private") rather than to enforce anything. The
 * enforcement is `profile_visible_to_viewer` in the row policy, which returns
 * no rows regardless of what this code concludes. An empty list and a forbidden
 * list look identical to RLS and must not look identical to a reader.
 */

import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";
import { canViewProfile } from "@/lib/db/profileGrid";

export type Conversation = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
  fromMe: boolean;
};

type ConversationRow = {
  partner_id: string;
  last_content: string | null;
  last_message_type: string | null;
  last_at: string;
  last_from_me: boolean;
  unread: number;
};

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data: rows, error } = await supabase.rpc("conversation_list", { p_user: userId });
  if (error) throw error;

  const blocked = await getBlockedUserIds(supabase, userId);
  const visible = ((rows ?? []) as ConversationRow[]).filter(
    (r) => r.partner_id !== userId && !blocked.has(r.partner_id),
  );
  if (visible.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .in(
      "id",
      visible.map((r) => r.partner_id),
    );
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  return visible.map((r) => {
    const u = byId.get(r.partner_id);
    const isCard = r.last_message_type === "cardmix";
    return {
      userId: r.partner_id,
      username: u?.username ?? "user",
      avatarUrl: u?.avatar_url ?? null,
      // A shared card with no note should read as a thing sent, not as an
      // empty line.
      lastMessage: (r.last_content ?? "").trim() || (isCard ? "Sent a title" : ""),
      lastAt: r.last_at,
      unread: Number(r.unread) || 0,
      fromMe: r.last_from_me,
    };
  });
}

export type Connection = { id: string; username: string | null };

/** Who `ownerId` follows, or who follows them, if the viewer may look. */
export async function fetchConnections(
  ownerId: string,
  viewerId: string | null,
  direction: "following" | "followers",
): Promise<Connection[]> {
  const { allowed, found } = await canViewProfile(ownerId, viewerId);
  if (!found) throw new Error("User not found");
  if (!allowed) throw new Error("Forbidden");

  const isFollowing = direction === "following";
  const { data, error } = await supabase
    .from("user_connections")
    .select(
      isFollowing
        ? "followed_id, users!fk_followed(username)"
        : "follower_id, users!fk_follower(username)",
    )
    .eq(isFollowing ? "follower_id" : "followed_id", ownerId);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown>;
    const user = r.users as { username?: string | null } | null;
    return {
      id: String(isFollowing ? r.followed_id : r.follower_id),
      username: user?.username ?? null,
    };
  });
}

export type Club = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  member_count: number;
  created_at: string;
  isMember: boolean;
};

/** Every club, with whether the viewer is in it. Works signed-out. */
export async function fetchClubs(viewerId: string | null): Promise<Club[]> {
  const { data: clubs, error } = await supabase
    .from("clubs")
    .select("id, slug, name, description, image_url, member_count, created_at")
    .order("member_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  let joined = new Set<number>();
  if (viewerId && clubs?.length) {
    const { data: mine } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", viewerId)
      .eq("status", "active");
    joined = new Set((mine ?? []).map((m) => m.club_id));
  }

  return (clubs ?? []).map((c) => ({ ...c, isMember: joined.has(c.id) })) as Club[];
}
