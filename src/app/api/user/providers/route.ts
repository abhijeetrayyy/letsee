import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

/** Guard against a client posting an unbounded array into the table. */
const MAX_PROVIDERS = 40;

type ProviderInput = { id: number; name?: string };

/**
 * GET /api/user/providers — the caller's streaming services and region.
 *
 * Region is returned even when no services are set, because the Tonight picker
 * needs it to fetch the right provider catalogue before the user has chosen
 * anything.
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const [providersRes, userRes] = await Promise.all([
    supabase
      .from("user_providers")
      .select("provider_id, provider_name")
      .eq("user_id", userId)
      .order("provider_name"),
    supabase.from("users").select("watch_region").eq("id", userId).maybeSingle(),
  ]);

  if (providersRes.error) {
    console.error("user/providers select:", providersRes.error);
    return jsonError("Failed to load your services", 500);
  }

  return jsonSuccess({
    region: userRes.data?.watch_region ?? "US",
    providers: (providersRes.data ?? []).map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
    })),
  });
}

/**
 * PUT /api/user/providers — replace the caller's service list and region.
 *
 * Replace rather than merge: the UI is a multi-select of everything the user
 * has, so an absent id means "I unsubscribed", which a merge would silently
 * ignore. Sending an empty array is legitimate and means "I have none" — the
 * resolver reads that as no availability constraint rather than as an error,
 * so a user who skips the picker still gets picks.
 */
export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const rawProviders = Array.isArray(body.providers) ? body.providers : null;
  if (!rawProviders) return jsonError("providers must be an array", 400);
  if (rawProviders.length > MAX_PROVIDERS) {
    return jsonError(`At most ${MAX_PROVIDERS} services`, 400);
  }

  // Accept either [{id, name}] or a bare [id] list, and drop anything that
  // isn't a usable TMDB provider id rather than failing the whole save.
  const seen = new Set<number>();
  const providers: ProviderInput[] = [];
  for (const entry of rawProviders) {
    const id = typeof entry === "number" ? entry : Number((entry as ProviderInput)?.id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    const name =
      typeof entry === "object" && entry !== null
        ? String((entry as ProviderInput).name ?? "").slice(0, 120)
        : "";
    providers.push({ id, name });
  }

  // ISO 3166-1 alpha-2, or leave whatever is already stored alone.
  const rawRegion = typeof body.region === "string" ? body.region.trim().toUpperCase() : null;
  const region = rawRegion && /^[A-Z]{2}$/.test(rawRegion) ? rawRegion : null;
  if (rawRegion !== null && region === null) {
    return jsonError("region must be a two-letter country code", 400);
  }

  const supabase = await createClient();

  if (region) {
    const { error } = await supabase
      .from("users")
      .update({ watch_region: region })
      .eq("id", userId);
    if (error) {
      console.error("user/providers region update:", error);
      return jsonError("Failed to save your region", 500);
    }
  }

  // Clear-then-insert. The table has no other columns worth preserving, and
  // RLS scopes both statements to this user.
  const { error: deleteError } = await supabase
    .from("user_providers")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("user/providers delete:", deleteError);
    return jsonError("Failed to save your services", 500);
  }

  if (providers.length > 0) {
    const { error: insertError } = await supabase.from("user_providers").insert(
      providers.map((p) => ({
        user_id: userId,
        provider_id: p.id,
        provider_name: p.name,
      })),
    );

    if (insertError) {
      console.error("user/providers insert:", insertError);
      return jsonError("Failed to save your services", 500);
    }
  }

  return jsonSuccess({ ok: true, region, providers });
}
