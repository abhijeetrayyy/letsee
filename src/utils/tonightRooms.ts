import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who you share a room with, for Tonight.
 *
 * Tonight used to take only follows (either way), while a room opens on a
 * message — so Up next offered "Decide with… jojo" and Tonight then said
 * "follow them first". A room now counts too, with one condition: their
 * profile is public. Anyone can message anyone (only a block stops it), so a
 * message alone would let a stranger write once to a private account and then
 * read its watchlist through Tonight's reasons — the hole the follow rule was
 * written to close (see /api/tonight). A public profile shows its films to
 * everyone already, so admitting it exposes nothing new.
 *
 * "Share a room" is the database's own `is_my_person` (follows or messages,
 * either way, and no block either way). Not a read of `messages` and
 * `user_blocks` here: RLS shows you only the blocks you made, so a person who
 * had blocked you still looked like someone you'd talked to, and could be put
 * in your sessions (hardening review, 4 Oct 2026).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** At most this many people are checked per call: a room list, not a census. */
const MAX_CHECKED = 40;

/** Public, undeleted accounts among `ids`. */
async function publicOnes(supabase: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data } = await supabase.from("users").select("id").in("id", ids).eq("visibility", "public").is("deleted_at", null);
  return new Set((data ?? []).map((u) => u.id as string));
}

/** Of `ids` (public ones), those `is_my_person` says are yours. */
async function mine(supabase: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const checks = await Promise.all(
    ids.slice(0, MAX_CHECKED).map((id) =>
      supabase.rpc("is_my_person", { p_other: id }).then(
        ({ data }) => (data === true ? id : null),
        () => null,
      ),
    ),
  );
  return new Set(checks.filter((id): id is string => !!id));
}

/** People you've exchanged messages with (either way), newest first, whose profiles are public and who are yours. */
export async function roomPeople(supabase: SupabaseClient, me: string, limit = 400): Promise<string[]> {
  const { data } = await supabase
    .from("messages")
    .select("sender_id, recipient_id")
    .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  const order: string[] = [];
  for (const m of data ?? []) {
    const other = (m.sender_id === me ? m.recipient_id : m.sender_id) as string;
    if (other && other !== me && !order.includes(other)) order.push(other);
  }
  const open = await publicOnes(supabase, order.slice(0, MAX_CHECKED));
  const yours = await mine(supabase, [...open]);
  return order.filter((id) => yours.has(id));
}

/** Of `ids`, the ones that are yours (`is_my_person`) and whose profiles are public. Ids that aren't uuids never qualify. */
export async function roomedAmong(supabase: SupabaseClient, me: string, ids: string[]): Promise<Set<string>> {
  const valid = ids.filter((id) => UUID.test(id) && id !== me);
  if (!valid.length) return new Set();
  const open = await publicOnes(supabase, valid);
  return mine(supabase, [...open]);
}
