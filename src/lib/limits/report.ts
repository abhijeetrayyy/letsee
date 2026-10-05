import { createAdminClient } from "@/utils/supabase/server";

/**
 * The monitoring half of fair use: each time an address is put in the
 * penalty box (lib/limits/guard), one row in `limit_events` (migration 121)
 * and one warning in the function log. Only that moment is recorded — never
 * every refused request — so this stays a handful of rows, and the address is
 * a short hash.
 *
 * To see who's been hammering what, in the SQL editor:
 *
 *   select bucket, path, count(*), count(distinct key_hash), max(created_at)
 *     from limit_events where created_at > now() - interval '7 days'
 *    group by 1, 2 order by 3 desc;
 */
export async function reportPenalty(keyHash: string, bucket: string, path: string | null): Promise<void> {
  console.warn(`fair-use: ${keyHash} paused for 10 minutes (bucket ${bucket}${path ? `, ${path}` : ""})`);
  try {
    const { error } = await createAdminClient().from("limit_events").insert({ key_hash: keyHash, bucket, path });
    if (error) console.error("fair-use: could not record a penalty:", error.message);
  } catch (e) {
    console.error("fair-use: could not record a penalty:", (e as Error).message);
  }
}
