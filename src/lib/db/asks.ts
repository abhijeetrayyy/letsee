/**
 * Ask your people (migration 110), read and written in the browser. An ask is
 * visible to you and, while open, to your people (RLS: `are_people`); an
 * answer is a pass tagged with the ask, readable by its two people.
 */
import { supabase } from "@/utils/supabase/client";
import type { RoomPerson } from "@/lib/db/rooms";

export type AskAnswer = { from: RoomPerson; itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null; note: string | null };
export type MyAsk = { id: number; question: string; createdAt: string; closesAt: string; closedAt: string | null; answers: AskAnswer[] };
export type AskForMe = { id: number; question: string; createdAt: string; closesAt: string; by: RoomPerson; answered: number };

async function people(ids: string[]): Promise<Map<string, RoomPerson>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from("users").select("id, username, avatar_url").in("id", ids).is("deleted_at", null);
  return new Map((data ?? []).filter((u) => u.username).map((u) => [u.id, { id: u.id, username: u.username as string, avatarUrl: u.avatar_url as string | null }]));
}

export async function createAsk(question: string): Promise<{ id: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_ask", { p_question: question });
  if (error) return { id: null, error: error.message.includes("three asks") ? "That's three asks today. Try again tomorrow." : error.message.includes("say a little more") ? "Say a little more." : "Couldn't ask. Check your connection." };
  return { id: typeof data === "number" ? data : Number(data), error: null };
}

export async function fetchMyAsks(me: string): Promise<MyAsk[]> {
  const { data: asks } = await supabase.from("asks").select("id, question, created_at, closes_at, closed_at").eq("user_id", me).order("created_at", { ascending: false }).limit(10);
  const ids = (asks ?? []).map((a) => a.id);
  const { data: answers } = ids.length
    ? await supabase.from("title_recommendations").select("ask_id, from_user_id, item_id, item_type, item_name, image_url, note, created_at").in("ask_id", ids).order("created_at", { ascending: true })
    : { data: [] };
  const who = await people([...new Set((answers ?? []).map((a) => a.from_user_id))]);
  return (asks ?? []).map((a) => ({
    id: a.id,
    question: a.question,
    createdAt: a.created_at,
    closesAt: a.closes_at,
    closedAt: a.closed_at,
    answers: (answers ?? [])
      .filter((r) => r.ask_id === a.id && who.has(r.from_user_id))
      .map((r) => ({ from: who.get(r.from_user_id)!, itemId: r.item_id, itemType: r.item_type === "tv" ? "tv" : "movie", itemName: r.item_name, imageUrl: r.image_url, note: r.note })),
  }));
}

/** Open asks from your people (RLS decides who), newest first, with how many you've answered. */
export async function fetchAsksForMe(me: string): Promise<AskForMe[]> {
  const { data: asks } = await supabase
    .from("asks")
    .select("id, user_id, question, created_at, closes_at")
    .neq("user_id", me)
    .is("closed_at", null)
    .gt("closes_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  if (!asks?.length) return [];
  const [who, { data: mine }] = await Promise.all([
    people([...new Set(asks.map((a) => a.user_id))]),
    supabase.from("title_recommendations").select("ask_id").eq("from_user_id", me).in("ask_id", asks.map((a) => a.id)),
  ]);
  return asks
    .filter((a) => who.has(a.user_id))
    .map((a) => ({ id: a.id, question: a.question, createdAt: a.created_at, closesAt: a.closes_at, by: who.get(a.user_id)!, answered: (mine ?? []).filter((m) => m.ask_id === a.id).length }));
}

export async function answerAsk(askId: number, t: { itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null }, note: string): Promise<"answered" | "enough" | "gone" | "error"> {
  const { data, error } = await supabase.rpc("answer_ask", {
    p_ask_id: askId,
    p_item_id: String(t.itemId),
    p_item_type: t.itemType,
    p_item_name: t.itemName,
    p_image_url: t.imageUrl,
    p_note: note,
  });
  if (error) return "error";
  return data === "answered" || data === "enough" ? data : "gone";
}

export async function closeAsk(me: string, id: number): Promise<boolean> {
  const { error } = await supabase.from("asks").update({ closed_at: new Date().toISOString() }).eq("id", id).eq("user_id", me);
  return !error;
}
