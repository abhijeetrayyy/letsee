import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

/**
 * The GET half moved to the browser — see `@/lib/db/social`. `clubs` is
 * world-readable and `club_members` is scoped by policy, so listing them never
 * needed a function.
 *
 * POST stays. Creating a club generates a slug, inserts a row and depends on
 * `trg_club_owner_on_create` to make the creator its owner; that is a write
 * with a shape, not a query, and it belongs somewhere the shape is enforced
 * once rather than in whichever client happens to call it.
 */
/** POST /api/clubs — create a club. The creator becomes its owner. */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const name = (body.name ?? "").trim();
  if (name.length < 3) return jsonError("Give the club a name (3+ characters)", 400);

  const supabase = await createClient();
  const base = slugify(name) || "club";
  // Slug is unique; disambiguate rather than failing in the user's face.
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: club, error } = await supabase
    .from("clubs")
    .insert({
      slug,
      name,
      description: (body.description ?? "").trim() || null,
      created_by: userId,
    })
    .select("id, slug, name, description, member_count")
    .single();

  if (error) return jsonError(error.message, 500);

  /**
   * The owner row is written by 083's AFTER INSERT trigger on `clubs`, in this
   * same transaction.
   *
   * It used to be inserted here, from the caller's own client — which is why
   * `club_members_insert_self` had to permit `role: 'owner'`, and why anyone
   * could POST themselves owner of any club straight to PostgREST. The policy
   * is now locked to `role = 'member'`, so the one place an owner row can be
   * created is the moment the club itself is.
   */
  return jsonSuccess({ club });
}
