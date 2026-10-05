import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Once every N days" for what costs the most per call (migration 121):
 * downloading all your data, each format once every 15 days. The interval is
 * decided in the database, not here.
 */
export type QuotaAction = "export_json" | "export_letterboxd";

export const QUOTA_DAYS: Record<QuotaAction, number> = { export_json: 15, export_letterboxd: 15 };

/** Granted (and recorded), or refused with when it's next allowed. */
export async function takeQuota(supabase: SupabaseClient, action: QuotaAction): Promise<{ ok: true } | { ok: false; nextAt: string | null }> {
  const { data, error } = await supabase.rpc("take_quota", { p_action: action });
  // A database that can't answer doesn't get to lock anyone out for 15 days,
  // nor to wave everyone through: refuse this once, with no date.
  if (error) return { ok: false, nextAt: null };
  return data ? { ok: false, nextAt: String(data) } : { ok: true };
}

/** The download failed after the allowance was taken: give it back. */
export async function refundQuota(supabase: SupabaseClient, action: QuotaAction): Promise<void> {
  await supabase.rpc("refund_quota", { p_action: action });
}

export function quotaRefusal(action: QuotaAction, nextAt: string | null): Response {
  const when = nextAt ? new Date(nextAt) : null;
  const day = when ? when.toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : null;
  const error = day
    ? `You can download this once every ${QUOTA_DAYS[action]} days. Your next one is ready on ${day}.`
    : "Couldn't prepare your download just now. Try again in a moment.";
  const retryAfter = when ? Math.max(60, Math.ceil((when.getTime() - Date.now()) / 1000)) : 60;
  return new Response(JSON.stringify({ error, nextAt }), {
    status: when ? 429 : 503,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
  });
}
