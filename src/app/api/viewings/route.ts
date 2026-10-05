import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { isPlace, normaliseDate, parseCompanions, recordViewing } from "@/utils/viewings";
import { writeStatus, type MediaStatus } from "@/utils/mediaStatus";

import { guard } from "@/lib/limits/guard";
/**
 * Log a viewing: "I watched this, on this day, here, with these people."
 *
 * Two facts are written in a fixed order. First the title becomes watched in
 * the library (status row plus the legacy mirror), exactly as a tap on
 * "Watched" would do it; then the viewing itself, which is the dated entry.
 * The order matters because the projection triggers from 095 write
 * `watched_items.watched_at` from the viewing, and there has to be a row for
 * them to write to.
 *
 * The status write is `writeStatus`, the same call the status route makes,
 * so the two can never disagree about what "watched" writes. That call also
 * creates a first viewing dated today when the title has none; the explicit
 * viewing below is then the second, and is marked a rewatch — unless it is
 * the same day, in which case the today-viewing is the one being logged and
 * is replaced rather than doubled.
 */
export async function POST(req: NextRequest) {
  const limited = await guard("write", req);
  if (limited) return limited;
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const itemId = body.itemId != null ? String(body.itemId).trim() : "";
  const itemType = body.itemType === "tv" ? "tv" : "movie";
  if (!itemId) return jsonError("itemId is required", 400);

  const itemName = typeof body.itemName === "string" ? body.itemName : "";
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  const genres = Array.isArray(body.genres) ? (body.genres as unknown[]).filter((g): g is string => typeof g === "string") : [];
  const adult = body.adult === true;

  const watchedOn = body.watchedOn == null ? null : normaliseDate(body.watchedOn);
  if (body.watchedOn != null && !watchedOn) return jsonError("watchedOn must be a date (yyyy-mm-dd) that is not in the future", 400);
  const place = isPlace(body.place) ? body.place : "home";
  const providerId = Number.isInteger(body.providerId) ? (body.providerId as number) : null;
  const companions = parseCompanions(body.companions);

  const supabase = await createClient();

  // A logged viewing means "watched". A series someone is part-way through is
  // the one exception: logging a viewing of it does not claim they finished.
  const { data: existing } = await supabase
    .from("user_media_status")
    .select("status")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .maybeSingle();
  const keepStatus =
    itemType === "tv" && existing && ["watching", "on_hold"].includes(existing.status as string);

  const status: MediaStatus = keepStatus ? (existing!.status as MediaStatus) : "watched";
  const statusError = await writeStatus(supabase, userId, {
    itemId,
    itemType,
    status,
    itemName,
    imageUrl,
    adult,
    genres,
  });
  if (statusError) return jsonError("Couldn't log that.", 500);

  /**
   * writeStatus may have just inserted a viewing dated today for a title that
   * had none. If the person is logging that same title with a date, that
   * auto row is this viewing, not a separate one: drop it so the log carries
   * the date and companions they chose, and `rewatch` is decided honestly.
   */
  if (!(existing && existing.status === "watched")) {
    await supabase
      .from("viewings")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .eq("watched_on", new Date().toISOString().slice(0, 10))
      .eq("rewatch", false)
      .eq("place", "home");
  }

  const { viewing, error } = await recordViewing(supabase, userId, {
    itemId,
    itemType,
    watchedOn,
    place,
    providerId,
    companions,
  });
  if (error) return jsonError(error, 500);

  return jsonSuccess({ ok: true, viewing });
}
