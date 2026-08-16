import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

const MIN_YEAR = 2000;

/**
 * PUT /api/year-review — publish or unpublish one year's card.
 *
 * The only thing that can make a year public, and it only ever acts on the
 * caller's own row. Publishing here does not touch users.visibility: a
 * followers-only profile stays followers-only, and exactly one year's summary
 * becomes linkable. See 059_year_in_review.sql.
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

  const year = Number(body.year);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > new Date().getUTCFullYear() + 1) {
    return jsonError("Invalid year", 400);
  }
  if (typeof body.isPublic !== "boolean") {
    return jsonError("isPublic must be true or false", 400);
  }

  const supabase = await createClient();

  const { error } = await supabase.from("year_reviews").upsert(
    {
      user_id: userId,
      year,
      is_public: body.isPublic,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,year" },
  );

  if (error) {
    console.error("year-review upsert:", error);
    return jsonError("Couldn't save that", 500);
  }

  return jsonSuccess({ ok: true, year, isPublic: body.isPublic });
}
