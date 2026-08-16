import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

const MAX_REVIEW = 5000;

function parseParams(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const showId = (p.get("showId") ?? "").trim();
  const seasonNumber = Number(p.get("seasonNumber"));
  return { showId, seasonNumber };
}

/**
 * GET /api/season-review?showId=&seasonNumber= — the caller's own review, plus
 * everyone else's public ones for that season.
 *
 * The two are selected separately and deliberately. 060's read policy lets a
 * permitted viewer see the whole row, private diary text included, so the
 * public list must never select `review_text` — the same trap the profile page
 * comments on for watched_items.
 */
export async function GET(req: NextRequest) {
  const { showId, seasonNumber } = parseParams(req);
  if (!showId || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return jsonError("showId and seasonNumber are required", 400);
  }

  const supabase = await createClient();
  const userId = await getAuthUserId();

  const [mineRes, publicRes] = await Promise.all([
    userId
      ? supabase
          .from("season_reviews")
          .select("score, review_text, public_review_text, updated_at")
          .eq("user_id", userId)
          .eq("show_id", showId)
          .eq("season_number", seasonNumber)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("season_reviews")
      // No review_text here. Ever.
      .select("user_id, score, public_review_text, updated_at, users!inner(username, avatar_url)")
      .eq("show_id", showId)
      .eq("season_number", seasonNumber)
      .not("public_review_text", "is", null)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const mine = mineRes.data
    ? {
        score: mineRes.data.score ?? null,
        reviewText: mineRes.data.review_text ?? "",
        publicReviewText: mineRes.data.public_review_text ?? "",
        updatedAt: mineRes.data.updated_at,
      }
    : null;

  const others = (publicRes.data ?? [])
    .filter((r) => r.user_id !== userId)
    .map((r) => {
      const author = r.users as unknown as { username?: string; avatar_url?: string | null };
      return {
        username: author?.username ?? "someone",
        avatarUrl: author?.avatar_url ?? null,
        score: r.score ?? null,
        text: r.public_review_text as string,
        updatedAt: r.updated_at,
      };
    });

  return jsonSuccess({ mine, others });
}

/**
 * PUT /api/season-review — save the caller's review of one season.
 *
 * Body: { showId, seasonNumber, score?, reviewText?, publicReviewText?, showName? }
 * Empty strings clear a field; omitted fields are left alone.
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

  const showId = body.showId != null ? String(body.showId).trim() : "";
  const seasonNumber = Number(body.seasonNumber);
  if (!showId || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return jsonError("showId and seasonNumber are required", 400);
  }

  const patch: Record<string, unknown> = {
    user_id: userId,
    show_id: showId,
    season_number: seasonNumber,
    updated_at: new Date().toISOString(),
  };

  if ("score" in body) {
    const score = Number(body.score);
    if (body.score === null || body.score === "") patch.score = null;
    else if (!Number.isInteger(score) || score < 1 || score > 10) {
      return jsonError("score must be 1–10", 400);
    } else patch.score = score;
  }

  for (const [key, column] of [
    ["reviewText", "review_text"],
    ["publicReviewText", "public_review_text"],
  ] as const) {
    if (!(key in body)) continue;
    const value = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    if (value.length > MAX_REVIEW) {
      return jsonError(`Reviews are capped at ${MAX_REVIEW} characters`, 400);
    }
    patch[column] = value || null;
  }

  if (typeof body.showName === "string" && body.showName.trim()) {
    patch.show_name = body.showName.trim().slice(0, 300);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("season_reviews")
    .upsert(patch, { onConflict: "user_id,show_id,season_number" });

  if (error) {
    console.error("season-review upsert:", error);
    return jsonError("Couldn't save that", 500);
  }

  return jsonSuccess({ ok: true });
}

/** DELETE /api/season-review?showId=&seasonNumber= */
export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const { showId, seasonNumber } = parseParams(req);
  if (!showId || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return jsonError("showId and seasonNumber are required", 400);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("season_reviews")
    .delete()
    .eq("user_id", userId)
    .eq("show_id", showId)
    .eq("season_number", seasonNumber);

  if (error) return jsonError("Couldn't remove that", 500);
  return jsonSuccess({ ok: true, removed: true });
}
