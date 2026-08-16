import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { deleteTake, getMyTake, parseIdentity, saveTake } from "@/utils/takes";

export const dynamic = "force-dynamic";

const MAX_BODY = 5000;

function identityFromQuery(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return parseIdentity({
    itemId: p.get("itemId"),
    itemType: p.get("itemType"),
    scope: p.get("scope"),
    seasonNumber: p.get("seasonNumber"),
    episodeNumber: p.get("episodeNumber"),
  });
}

/**
 * GET /api/takes?itemId=&itemType=&scope=&seasonNumber=&episodeNumber=
 *
 * The caller's own take, plus everyone else's public ones for the same thing.
 *
 * The two are fetched separately and deliberately. 065's read policy admits a
 * whole row once it is public and the profile is visible, so the *API* is what
 * keeps a private note private — the same trap 060 documents. The public query
 * therefore filters on `is_public` explicitly rather than trusting RLS to have
 * done it.
 */
export async function GET(req: NextRequest) {
  const id = identityFromQuery(req);
  if (!id) return jsonError("A valid itemId and scope are required", 400);

  const supabase = await createClient();
  const userId = await getAuthUserId();

  const [mine, publicRes] = await Promise.all([
    userId
      ? getMyTake(supabase, userId, id)
      : Promise.resolve({ take: null, privateNote: null }),
    supabase
      .from("takes")
      .select("user_id, score, body, updated_at, users!inner(username, avatar_url)")
      .eq("item_id", id.itemId)
      .eq("item_type", id.itemType)
      .eq("scope", id.scope)
      .eq("season_number", id.seasonNumber)
      .eq("episode_number", id.episodeNumber)
      .eq("is_public", true)
      .not("body", "is", null)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const others = (publicRes.data ?? [])
    .filter((r) => r.user_id !== userId)
    .map((r) => {
      const author = r.users as unknown as { username?: string; avatar_url?: string | null };
      return {
        username: author?.username ?? "someone",
        avatarUrl: author?.avatar_url ?? null,
        score: r.score ?? null,
        body: r.body as string,
        updatedAt: r.updated_at,
      };
    });

  return jsonSuccess({ mine: mine.take, privateNote: mine.privateNote, others });
}

/**
 * PUT /api/takes — save the caller's take.
 *
 * Body: { itemId, itemType, scope?, seasonNumber?, episodeNumber?,
 *         score?, body?, isPublic?, itemName?, imageUrl?, genres? }
 *
 * Clearing both the score and the text is a delete, not an empty row.
 */
export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const id = parseIdentity(raw);
  if (!id) return jsonError("A valid itemId and scope are required", 400);

  const text = typeof raw.body === "string" ? raw.body.trim() : "";
  if (text.length > MAX_BODY) {
    return jsonError(`Keep it under ${MAX_BODY} characters.`, 400);
  }

  const score =
    raw.score === null || raw.score === "" || raw.score === undefined ? null : Number(raw.score);
  const isPublic = raw.isPublic === true;

  const supabase = await createClient();

  // Clearing both the score and the text means "I have no take on this", which
  // is a removal rather than an empty row — takes_not_empty would reject it
  // anyway, and a constraint violation is a poor way to express intent.
  if (score === null && !text) {
    const err = await deleteTake(supabase, userId, id, isPublic);
    return err ? jsonError(err, 500) : jsonSuccess({ ok: true, removed: true });
  }

  const err = await saveTake(supabase, userId, id, {
    score,
    body: text,
    isPublic,
    watchedAt: typeof raw.watchedAt === "string" ? raw.watchedAt : null,
    itemName: typeof raw.itemName === "string" ? raw.itemName : "",
    imageUrl: typeof raw.imageUrl === "string" && raw.imageUrl.trim() ? raw.imageUrl : null,
    genres: Array.isArray(raw.genres) ? (raw.genres as unknown[]).map(String) : [],
  });

  return err ? jsonError(err, 400) : jsonSuccess({ ok: true });
}

/** DELETE /api/takes?itemId=&itemType=&scope=&…&isPublic= */
export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const id = identityFromQuery(req);
  if (!id) return jsonError("A valid itemId and scope are required", 400);

  const isPublic = req.nextUrl.searchParams.get("isPublic") === "true";
  const err = await deleteTake(await createClient(), userId, id, isPublic);
  return err ? jsonError(err, 500) : jsonSuccess({ ok: true, removed: true });
}
