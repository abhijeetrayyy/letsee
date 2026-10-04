/**
 * The pass: telling someone to watch something (docs/design/RETHINK.md §6).
 *
 * A pass is sent as a title card in a message. Migration 097's trigger
 * `record_card_recommendation` turns every card into a row in
 * `title_recommendations`, which is what puts it in their Up next under
 * *From people*, closes it with a notification when they watch it, and shows
 * it in your room as an event. One insert, under the sender's own RLS.
 */
import { supabase } from "@/utils/supabase/client";
import type { Message } from "@/lib/db/rooms";

/** The trigger keeps 280 characters of the words in the recommendation. */
export const PASS_WORDS_MAX = 280;

export type PassTitle = { itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null };

/** TMDB paths stay paths; a full URL is cut to its path, as `sendCard` does. */
function imagePath(url: string | null): string {
  if (!url) return "";
  return url.startsWith("http") ? url.replace(/^https?:\/\/[^/]+/, "") : url;
}

export async function sendPass(
  me: string,
  to: string[],
  title: PassTitle,
  words: string,
): Promise<{ sent: Message[]; error: string | null }> {
  const content = words.trim().slice(0, PASS_WORDS_MAX);
  const rows = [...new Set(to)]
    .filter((id) => id !== me)
    .map((recipient) => ({
      sender_id: me,
      recipient_id: recipient,
      content,
      message_type: "cardmix" as const,
      metadata: {
        media_type: title.itemType,
        media_id: title.itemId,
        media_name: title.itemName,
        media_image: imagePath(title.imageUrl),
      },
    }));
  if (!rows.length) return { sent: [], error: "Pick someone to pass it to." };
  const { data, error } = await supabase
    .from("messages")
    .insert(rows)
    .select("id, sender_id, recipient_id, content, message_type, metadata, is_read, created_at");
  if (error) {
    console.error("sendPass:", error);
    return { sent: [], error: error.code === "23503" ? "That person isn't here any more." : "Couldn't pass that. Try again." };
  }
  return { sent: (data ?? []) as Message[], error: null };
}
