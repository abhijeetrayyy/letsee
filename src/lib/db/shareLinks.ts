/**
 * Passes by link (migration 108). Everything goes through the database
 * functions: `share_links` is readable only by the person who made a row, and
 * the invited door sees a link only through `open_share_link`.
 */
import { supabase } from "@/utils/supabase/client";
import { cleanToken } from "@/lib/people/invite";

type From = { username: string; avatarUrl: string | null };
type Title = { itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null };

/** What the invited door shows for a link — never more than this. */
export type OpenedLink =
  | ({ kind: "pass"; note: string | null; from: From; expiresAt: string } & Title)
  | ({ kind: "viewing"; watchedOn: string; rewatch: boolean; place: string; company: number; from: From; expiresAt: string } & Title)
  | { kind: "list"; listName: string; listDescription: string | null; listCount: number; from: From; expiresAt: string };

export type ListLinkItem = Title & { note: string | null };

export async function createPassLink(t: { itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null }, note: string): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_pass_link", {
    p_item_id: t.itemId,
    p_item_type: t.itemType,
    p_item_name: t.itemName,
    p_image_url: t.imageUrl,
    p_note: note,
  });
  if (error) return { token: null, error: error.message.includes("too many") ? "That's a lot of links this hour. Try again in a while." : "Couldn't make the link. Check your connection." };
  return { token: typeof data === "string" ? data : null, error: null };
}

export async function openShareLink(raw: string | null): Promise<OpenedLink | null> {
  const token = cleanToken(raw);
  if (!token) return null;
  const { data } = await supabase.rpc("open_share_link", { p_token: token });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.from_username) return null;
  const from = { username: row.from_username, avatarUrl: row.from_avatar ?? null };
  if (row.kind === "list") {
    if (!row.list_name) return null;
    return { kind: "list", listName: row.list_name, listDescription: row.list_description ?? null, listCount: row.list_count ?? 0, from, expiresAt: row.expires_at };
  }
  if (!row.item_name) return null;
  const title = { itemId: row.item_id, itemType: (row.item_type === "tv" ? "tv" : "movie") as "movie" | "tv", itemName: row.item_name, imageUrl: row.image_url ?? null };
  if (row.kind === "viewing") {
    return { kind: "viewing", ...title, watchedOn: row.watched_on, rewatch: !!row.rewatch, place: row.place ?? "home", company: row.company ?? 0, from, expiresAt: row.expires_at };
  }
  return { kind: "pass", ...title, note: row.note ?? null, from, expiresAt: row.expires_at };
}

/** A list link's titles, in the list's order (up to 100). */
export async function openSharedListItems(raw: string | null): Promise<ListLinkItem[]> {
  const token = cleanToken(raw);
  if (!token) return [];
  const { data } = await supabase.rpc("open_shared_list_items", { p_token: token });
  return (Array.isArray(data) ? data : []).map((r) => ({ itemId: r.item_id, itemType: r.item_type === "tv" ? "tv" : "movie", itemName: r.item_name, imageUrl: r.image_url ?? null, note: r.note ?? null }));
}

/** A night from your own diary, as a link. */
export async function createViewingLink(viewingId: number): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_viewing_link", { p_viewing_id: viewingId });
  if (error) {
    const m = error.message;
    return {
      token: null,
      error: m.includes("too many") ? "That's a lot of links this hour. Try again in a while." : m.includes("no name") ? "That night's title has no name to show, so it can't be shared." : "Couldn't make the link. Check your connection.",
    };
  }
  return { token: typeof data === "string" ? data : null, error: null };
}

/** One of your lists, as a link — opens even when the list is private. */
export async function createListLink(listId: number): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_list_link", { p_list_id: listId });
  if (error) return { token: null, error: error.message.includes("too many") ? "That's a lot of links this hour. Try again in a while." : "Couldn't make the link. Check your connection." };
  return { token: typeof data === "string" ? data : null, error: null };
}

/** Keep a pass from a link: it lands in your Up next, from them. */
export async function claimShareLink(raw: string | null): Promise<"kept" | "yours" | "gone" | "error"> {
  const token = cleanToken(raw);
  if (!token) return "gone";
  const { data, error } = await supabase.rpc("claim_share_link", { p_token: token });
  if (error) return "error";
  return data === "kept" || data === "yours" ? data : "gone";
}

export type MyLink = {
  token: string;
  kind: "pass" | "viewing" | "list";
  listId: number | null;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  note: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  opened: number;
};

/** The links you've made, newest first — `share_links` is readable only by its maker. */
export async function fetchMyLinks(me: string): Promise<MyLink[]> {
  const { data } = await supabase
    .from("share_links")
    .select("token, kind, item_id, item_type, item_name, image_url, note, created_at, expires_at, revoked_at, opened_count, list_id, list:user_lists(name)")
    .eq("created_by", me)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => ({
    token: r.token,
    kind: r.kind === "viewing" ? "viewing" : r.kind === "list" ? "list" : "pass",
    listId: r.list_id ?? null,
    itemId: r.item_id ?? "",
    itemType: r.item_type === "tv" ? "tv" : "movie",
    itemName: r.item_name ?? (r.list as { name?: string } | null)?.name ?? "A list",
    imageUrl: r.image_url,
    note: r.note,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    opened: r.opened_count ?? 0,
  }));
}

/** Stop a link for good: whoever has it sees that it ran out. */
export async function revokeShareLink(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("revoke_share_link", { p_token: token });
  return !error && data === true;
}
